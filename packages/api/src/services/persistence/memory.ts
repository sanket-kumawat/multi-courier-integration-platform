import type { CreateOrderInput } from "../../dto/orders";
import type {
	BatchSnapshot,
	BulkStore,
	ClaimedBatchItem,
	CompleteItemInput,
	EnqueueBulkInput,
	PersistedBatch,
	PersistedBatchItem,
} from "../bulk/store";
import type { ApplyCancelInput, CancelStore } from "../cancel/store";
import type {
	InsertPendingInput,
	MarkCreatedInput,
	MarkFailedInput,
	OrderStore,
} from "../orders/store";
import type { PersistedOrder } from "../shared/order";
import type {
	ApplyTrackInput,
	NewTrackingEvent,
	PersistedTrackingEvent,
	RecordTrackFailureInput,
	TrackingStore,
} from "../tracking/store";

type MemoryBatchItem = {
	id: string;
	batchId: string;
	orderId: string;
	position: number;
	status: PersistedBatchItem["status"];
	errorCode: string | null;
	errorMessage: string | null;
	orderUuid: string | null;
	claimedAt: Date | null;
	createdAt: Date;
	payload: CreateOrderInput;
};

function eventKey(event: {
	orderId: string;
	occurredAt: Date;
	partnerStatus: string;
}): string {
	return `${event.orderId}|${event.occurredAt.toISOString()}|${event.partnerStatus}`;
}

export class MemoryOrderStore
	implements OrderStore, TrackingStore, CancelStore, BulkStore
{
	private readonly byOrderId = new Map<string, PersistedOrder>();
	private readonly byInternalId = new Map<string, PersistedOrder>();
	private readonly events = new Map<string, PersistedTrackingEvent[]>();
	private readonly eventKeys = new Set<string>();
	private readonly batches = new Map<string, PersistedBatch>();
	private readonly batchItems = new Map<string, MemoryBatchItem>();
	private writeLock = Promise.resolve();

	async insertPending(
		input: InsertPendingInput,
	): Promise<{ order: PersistedOrder; inserted: boolean }> {
		const existing = this.byOrderId.get(input.order.order_id);
		if (existing) {
			return { order: existing, inserted: false };
		}

		const now = new Date();
		const order: PersistedOrder = {
			id: crypto.randomUUID(),
			orderId: input.order.order_id,
			courierPartner: input.order.courier_partner,
			courierShipmentId: null,
			awb: null,
			status: "PENDING",
			payloadHash: input.payloadHash,
			createdAt: now,
			updatedAt: now,
		};
		this.byOrderId.set(order.orderId, order);
		this.byInternalId.set(order.id, order);
		this.events.set(order.id, []);
		return { order, inserted: true };
	}

	async findByOrderId(orderId: string): Promise<PersistedOrder | undefined> {
		return this.byOrderId.get(orderId);
	}

	async markCreated(
		id: string,
		input: MarkCreatedInput,
	): Promise<PersistedOrder> {
		const updated = this.patch(id, {
			status: input.status,
			awb: input.awb,
			courierShipmentId: input.courierShipmentId,
		});
		this.appendEvent(updated.id, {
			status: input.status,
			partnerStatus: input.partnerStatus,
			description: "Shipment manifested",
			location: null,
			occurredAt: updated.updatedAt,
			raw: input.rawResponse,
		});
		return updated;
	}

	async markFailed(
		id: string,
		_input: MarkFailedInput,
	): Promise<PersistedOrder> {
		return this.patch(id, { status: "FAILED" });
	}

	async listTrackingEvents(orderId: string): Promise<PersistedTrackingEvent[]> {
		return [...(this.events.get(orderId) ?? [])].sort(compareEvents);
	}

	async applyTrack(
		id: string,
		input: ApplyTrackInput,
	): Promise<{ order: PersistedOrder; events: PersistedTrackingEvent[] }> {
		const order = this.patch(id, { status: input.status });
		for (const event of input.events) {
			this.appendEvent(id, event);
		}
		return { order, events: await this.listTrackingEvents(id) };
	}

	async recordTrackFailure(
		_id: string,
		_input: RecordTrackFailureInput,
	): Promise<void> {}

	async cancelledAt(id: string): Promise<Date | undefined> {
		const cancelled = (await this.listTrackingEvents(id)).find(
			(event) => event.status === "CANCELLED",
		);
		return cancelled?.occurredAt;
	}

	async applyCancel(
		id: string,
		input: ApplyCancelInput,
	): Promise<{ order: PersistedOrder; cancelledAt: Date }> {
		const order = this.patch(id, { status: "CANCELLED" });
		this.appendEvent(id, {
			status: "CANCELLED",
			partnerStatus: input.partnerStatus,
			description: "Shipment cancelled",
			location: null,
			occurredAt: input.cancelledAt,
			raw: input.rawResponse ?? { status: "CANCELLED" },
		});
		return { order, cancelledAt: input.cancelledAt };
	}

	private appendEvent(orderId: string, input: NewTrackingEvent): void {
		const key = eventKey({
			orderId,
			occurredAt: input.occurredAt,
			partnerStatus: input.partnerStatus,
		});
		if (this.eventKeys.has(key)) {
			return;
		}
		this.eventKeys.add(key);
		const event: PersistedTrackingEvent = {
			id: crypto.randomUUID(),
			orderId,
			status: input.status,
			partnerStatus: input.partnerStatus,
			description: input.description,
			location: input.location,
			occurredAt: input.occurredAt,
		};
		const list = this.events.get(orderId) ?? [];
		list.push(event);
		this.events.set(orderId, list);
	}

	private patch(id: string, fields: Partial<PersistedOrder>): PersistedOrder {
		const current = [...this.byOrderId.values()].find((row) => row.id === id);
		if (!current) {
			throw new Error(`Order '${id}' not found`);
		}
		const updated: PersistedOrder = {
			...current,
			...fields,
			updatedAt: new Date(),
		};
		this.byOrderId.set(updated.orderId, updated);
		this.byInternalId.set(updated.id, updated);
		return updated;
	}

	async enqueue(input: EnqueueBulkInput): Promise<PersistedBatch> {
		return this.serialize(async () => {
			const now = new Date();
			const batch: PersistedBatch = {
				id: crypto.randomUUID(),
				status: "QUEUED",
				total: input.orders.length,
				succeeded: 0,
				failed: 0,
				createdAt: now,
				updatedAt: now,
				completedAt: null,
			};
			this.batches.set(batch.id, batch);

			for (const [position, entry] of input.orders.entries()) {
				const { order } = await this.insertPending({
					order: entry.order,
					payloadHash: entry.payloadHash,
					batchId: batch.id,
				});
				const item: MemoryBatchItem = {
					id: crypto.randomUUID(),
					batchId: batch.id,
					orderId: entry.order.order_id,
					position,
					status: "QUEUED",
					errorCode: null,
					errorMessage: null,
					orderUuid: order.id,
					claimedAt: null,
					createdAt: now,
					payload: entry.order,
				};
				this.batchItems.set(item.id, item);
			}

			return { ...batch };
		});
	}

	async getBatch(batchId: string): Promise<BatchSnapshot | undefined> {
		const batch = this.batches.get(batchId);
		if (!batch) {
			return undefined;
		}
		const items = [...this.batchItems.values()]
			.filter((item) => item.batchId === batchId)
			.sort((left, right) => left.position - right.position)
			.map((item) => this.toPersistedItem(item));
		return { batch: { ...batch }, items };
	}

	async reclaimStale(staleMs: number): Promise<number> {
		return this.serialize(async () => {
			const cutoff = Date.now() - staleMs;
			let reclaimed = 0;
			for (const item of this.batchItems.values()) {
				if (item.status !== "PROCESSING") {
					continue;
				}
				const claimedAt = item.claimedAt?.getTime() ?? 0;
				if (claimedAt > cutoff) {
					continue;
				}
				item.status = "QUEUED";
				item.claimedAt = null;
				reclaimed += 1;
			}
			return reclaimed;
		});
	}

	async claimQueued(limit: number): Promise<ClaimedBatchItem[]> {
		return this.serialize(async () => {
			const queued = [...this.batchItems.values()]
				.filter((item) => item.status === "QUEUED")
				.sort(
					(left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
				)
				.slice(0, Math.max(0, limit));
			const now = new Date();
			const claimed: ClaimedBatchItem[] = [];
			for (const item of queued) {
				item.status = "PROCESSING";
				item.claimedAt = now;
				const batch = this.batches.get(item.batchId);
				if (batch && batch.status === "QUEUED") {
					batch.status = "PROCESSING";
					batch.updatedAt = now;
				}
				claimed.push({
					id: item.id,
					batchId: item.batchId,
					orderId: item.orderId,
					position: item.position,
					payload: item.payload,
				});
			}
			return claimed;
		});
	}

	async completeItem(itemId: string, input: CompleteItemInput): Promise<void> {
		return this.serialize(async () => {
			const item = this.batchItems.get(itemId);
			if (!item || item.status === "SUCCEEDED" || item.status === "FAILED") {
				return;
			}
			const now = new Date();
			if (input.success) {
				item.status = "SUCCEEDED";
				item.errorCode = null;
				item.errorMessage = null;
			} else {
				item.status = "FAILED";
				item.errorCode = input.errorCode;
				item.errorMessage = input.errorMessage;
			}
			item.claimedAt = null;

			const batch = this.batches.get(item.batchId);
			if (!batch) {
				return;
			}
			if (input.success) {
				batch.succeeded += 1;
			} else {
				batch.failed += 1;
			}
			batch.updatedAt = now;
			if (batch.succeeded + batch.failed >= batch.total) {
				batch.status = "COMPLETED";
				batch.completedAt = now;
			} else if (batch.status === "QUEUED") {
				batch.status = "PROCESSING";
			}
		});
	}

	markItemClaimedAt(itemId: string, claimedAt: Date): void {
		const item = this.batchItems.get(itemId);
		if (!item) {
			throw new Error(`Batch item '${itemId}' not found`);
		}
		item.status = "PROCESSING";
		item.claimedAt = claimedAt;
	}

	private toPersistedItem(item: MemoryBatchItem): PersistedBatchItem {
		const order = item.orderUuid
			? this.byInternalId.get(item.orderUuid)
			: undefined;
		return {
			id: item.id,
			batchId: item.batchId,
			orderId: item.orderId,
			position: item.position,
			status: item.status,
			errorCode: item.errorCode,
			errorMessage: item.errorMessage,
			orderUuid: item.orderUuid,
			claimedAt: item.claimedAt,
			awb: order?.awb ?? null,
			orderStatus: order?.status ?? null,
		};
	}

	private serialize<T>(fn: () => Promise<T>): Promise<T> {
		const run = this.writeLock.then(fn, fn);
		this.writeLock = run.then(
			() => undefined,
			() => undefined,
		);
		return run;
	}
}

function compareEvents(
	left: PersistedTrackingEvent,
	right: PersistedTrackingEvent,
): number {
	const byTime = left.occurredAt.getTime() - right.occurredAt.getTime();
	if (byTime !== 0) {
		return byTime;
	}
	return left.id.localeCompare(right.id);
}
