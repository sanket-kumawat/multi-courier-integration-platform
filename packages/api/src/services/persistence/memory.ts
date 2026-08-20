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

function eventKey(event: {
	orderId: string;
	occurredAt: Date;
	partnerStatus: string;
}): string {
	return `${event.orderId}|${event.occurredAt.toISOString()}|${event.partnerStatus}`;
}

export class MemoryOrderStore implements OrderStore, TrackingStore {
	private readonly byOrderId = new Map<string, PersistedOrder>();
	private readonly events = new Map<string, PersistedTrackingEvent[]>();
	private readonly eventKeys = new Set<string>();

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
		return updated;
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
