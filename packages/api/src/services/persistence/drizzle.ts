import {
	redactUrl,
	redactValue,
} from "@multi-courier-integration-platform/couriers";
import {
	bulkBatches,
	bulkBatchItems,
	courierApiCalls,
	type createDb,
	orderPackages,
	orderParties,
	orders,
	shipmentActions,
	trackingEvents,
} from "@multi-courier-integration-platform/db";
import { and, asc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { type CreateOrderInput, createOrderSchema } from "../../dto/orders";
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
import type {
	CourierCallInput,
	CourierCallStore,
} from "../shared/courier-calls";
import type { PersistedOrder } from "../shared/order";
import type {
	ApplyTrackInput,
	PersistedTrackingEvent,
	RecordTrackFailureInput,
	TrackingStore,
} from "../tracking/store";

type Database = ReturnType<typeof createDb>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

function money(value: number): string {
	return value.toFixed(2);
}

function weight(value: number): string {
	return value.toFixed(3);
}

function dimension(value: number): string {
	return value.toFixed(2);
}

function toPersisted(row: typeof orders.$inferSelect): PersistedOrder {
	return {
		id: row.id,
		orderId: row.orderId,
		courierPartner: row.courierPartner,
		courierShipmentId: row.courierShipmentId,
		awb: row.awb,
		status: row.status,
		payloadHash: row.payloadHash,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

function toPersistedBatch(
	row: typeof bulkBatches.$inferSelect,
): PersistedBatch {
	return {
		id: row.id,
		status: row.status,
		total: row.total,
		succeeded: row.succeeded,
		failed: row.failed,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		completedAt: row.completedAt ?? null,
	};
}

function payloadFromSnapshot(snapshot: unknown): CreateOrderInput {
	const parsed = createOrderSchema.safeParse(snapshot);
	if (parsed.success) {
		return parsed.data;
	}
	return snapshot as CreateOrderInput;
}

function toPersistedEvent(
	row: typeof trackingEvents.$inferSelect,
): PersistedTrackingEvent {
	return {
		id: row.id,
		orderId: row.orderId,
		status: row.status,
		partnerStatus: row.partnerStatus,
		description: row.description,
		location: row.location,
		occurredAt: row.occurredAt,
	};
}

export class DrizzleOrderStore
	implements OrderStore, TrackingStore, CancelStore, BulkStore, CourierCallStore
{
	constructor(private readonly db: ReturnType<typeof createDb>) {}

	async insertPending(
		input: InsertPendingInput,
	): Promise<{ order: PersistedOrder; inserted: boolean }> {
		return this.db.transaction((tx) => this.writePending(tx, input));
	}

	async findByOrderId(orderId: string): Promise<PersistedOrder | undefined> {
		const row = await this.db.query.orders.findFirst({
			where: eq(orders.orderId, orderId),
		});
		return row ? toPersisted(row) : undefined;
	}

	async markCreated(
		id: string,
		input: MarkCreatedInput,
	): Promise<PersistedOrder> {
		return this.db.transaction(async (tx) => {
			const [updated] = await tx
				.update(orders)
				.set({
					status: input.status,
					awb: input.awb,
					courierShipmentId: input.courierShipmentId,
					lastCourierRequest: redactValue(input.rawRequest),
					lastCourierResponse: redactValue(input.rawResponse),
					lastErrorCode: null,
					updatedAt: new Date(),
				})
				.where(eq(orders.id, id))
				.returning();
			if (!updated) {
				throw new Error(`Order '${id}' not found`);
			}

			await tx.insert(trackingEvents).values({
				orderId: id,
				status: input.status,
				partnerStatus: input.partnerStatus,
				description: "Shipment manifested",
				occurredAt: new Date(),
				rawPayload: input.rawResponse,
			});

			await tx.insert(courierApiCalls).values({
				orderId: id,
				courierPartner: updated.courierPartner,
				operation: "CREATE",
				attempt: 1,
				requestUrl: `adapter://${updated.courierPartner}/create`,
				requestPayload: redactValue(input.rawRequest),
				responsePayload: redactValue(input.rawResponse),
				httpStatus: 200,
				durationMs: input.durationMs,
				requestId: input.requestId,
			});

			return toPersisted(updated);
		});
	}

	async markFailed(
		id: string,
		input: MarkFailedInput,
	): Promise<PersistedOrder> {
		return this.db.transaction(async (tx) => {
			const [updated] = await tx
				.update(orders)
				.set({
					status: "FAILED",
					lastCourierRequest: redactValue(input.rawRequest),
					lastCourierResponse: redactValue(input.rawResponse),
					lastErrorCode: input.errorCode,
					updatedAt: new Date(),
				})
				.where(eq(orders.id, id))
				.returning();
			if (!updated) {
				throw new Error(`Order '${id}' not found`);
			}

			await tx.insert(courierApiCalls).values({
				orderId: id,
				courierPartner: updated.courierPartner,
				operation: "CREATE",
				attempt: 1,
				requestUrl: `adapter://${updated.courierPartner}/create`,
				requestPayload: redactValue(input.rawRequest),
				responsePayload: redactValue(input.rawResponse),
				httpStatus: input.httpStatus ?? null,
				errorType:
					input.errorCode === "COURIER_UNAVAILABLE" ? "NETWORK" : "HTTP",
				durationMs: input.durationMs,
				requestId: input.requestId,
			});

			return toPersisted(updated);
		});
	}

	async listTrackingEvents(orderId: string): Promise<PersistedTrackingEvent[]> {
		const rows = await this.db.query.trackingEvents.findMany({
			where: eq(trackingEvents.orderId, orderId),
			orderBy: [asc(trackingEvents.occurredAt), asc(trackingEvents.createdAt)],
		});
		return rows.map(toPersistedEvent);
	}

	async applyTrack(
		id: string,
		input: ApplyTrackInput,
	): Promise<{ order: PersistedOrder; events: PersistedTrackingEvent[] }> {
		return this.db.transaction(async (tx) => {
			const [updated] = await tx
				.update(orders)
				.set({
					status: input.status,
					lastCourierResponse: redactValue(input.rawResponse),
					lastErrorCode: null,
					updatedAt: new Date(),
				})
				.where(eq(orders.id, id))
				.returning();
			if (!updated) {
				throw new Error(`Order '${id}' not found`);
			}

			if (input.events.length > 0) {
				await tx
					.insert(trackingEvents)
					.values(
						input.events.map((event) => ({
							orderId: id,
							status: event.status,
							partnerStatus: event.partnerStatus,
							description: event.description,
							location: event.location,
							occurredAt: event.occurredAt,
							rawPayload: event.raw,
						})),
					)
					.onConflictDoNothing({
						target: [
							trackingEvents.orderId,
							trackingEvents.occurredAt,
							trackingEvents.partnerStatus,
						],
					});
			}

			await tx.insert(courierApiCalls).values({
				orderId: id,
				courierPartner: updated.courierPartner,
				operation: "TRACK",
				attempt: 1,
				requestUrl: `adapter://${updated.courierPartner}/track`,
				responsePayload: redactValue(input.rawResponse),
				httpStatus: 200,
				durationMs: input.durationMs,
				requestId: input.requestId,
			});

			const rows = await tx.query.trackingEvents.findMany({
				where: eq(trackingEvents.orderId, id),
				orderBy: [
					asc(trackingEvents.occurredAt),
					asc(trackingEvents.createdAt),
				],
			});
			return {
				order: toPersisted(updated),
				events: rows.map(toPersistedEvent),
			};
		});
	}

	async recordTrackFailure(
		id: string,
		input: RecordTrackFailureInput,
	): Promise<void> {
		const existing = await this.db.query.orders.findFirst({
			where: eq(orders.id, id),
		});
		if (!existing) {
			throw new Error(`Order '${id}' not found`);
		}

		await this.db.insert(courierApiCalls).values({
			orderId: id,
			courierPartner: existing.courierPartner,
			operation: "TRACK",
			attempt: 1,
			requestUrl: `adapter://${existing.courierPartner}/track`,
			httpStatus: input.httpStatus ?? null,
			errorType: input.errorCode === "COURIER_UNAVAILABLE" ? "NETWORK" : "HTTP",
			durationMs: input.durationMs,
			requestId: input.requestId,
		});
	}

	async cancelledAt(id: string): Promise<Date | undefined> {
		const events = await this.listTrackingEvents(id);
		return events.find((event) => event.status === "CANCELLED")?.occurredAt;
	}

	async applyCancel(
		id: string,
		input: ApplyCancelInput,
	): Promise<{ order: PersistedOrder; cancelledAt: Date }> {
		return this.db.transaction(async (tx) => {
			const [updated] = await tx
				.update(orders)
				.set({
					status: "CANCELLED",
					lastCourierRequest: redactValue(input.rawRequest),
					lastCourierResponse: redactValue(input.rawResponse),
					lastErrorCode: null,
					updatedAt: input.cancelledAt,
				})
				.where(eq(orders.id, id))
				.returning();
			if (!updated) {
				throw new Error(`Order '${id}' not found`);
			}

			await tx
				.insert(trackingEvents)
				.values({
					orderId: id,
					status: "CANCELLED",
					partnerStatus: input.partnerStatus,
					description: "Shipment cancelled",
					occurredAt: input.cancelledAt,
					rawPayload: input.rawResponse ?? { status: "CANCELLED" },
				})
				.onConflictDoNothing({
					target: [
						trackingEvents.orderId,
						trackingEvents.occurredAt,
						trackingEvents.partnerStatus,
					],
				});

			await tx.insert(shipmentActions).values({
				orderId: id,
				type: "CANCEL",
				succeeded: true,
				requestPayload: redactValue(input.rawRequest),
				responsePayload: redactValue(input.rawResponse),
			});

			if (input.calledCourier) {
				await tx.insert(courierApiCalls).values({
					orderId: id,
					courierPartner: updated.courierPartner,
					operation: "CANCEL",
					attempt: 1,
					requestUrl: `adapter://${updated.courierPartner}/cancel`,
					requestPayload: redactValue(input.rawRequest),
					responsePayload: redactValue(input.rawResponse),
					httpStatus: 200,
					durationMs: input.durationMs,
					requestId: input.requestId,
				});
			}

			return { order: toPersisted(updated), cancelledAt: input.cancelledAt };
		});
	}

	async enqueue(input: EnqueueBulkInput): Promise<PersistedBatch> {
		return this.db.transaction(async (tx) => {
			const [batch] = await tx
				.insert(bulkBatches)
				.values({
					status: "QUEUED",
					total: input.orders.length,
				})
				.returning();
			if (!batch) {
				throw new Error("Failed to insert bulk batch");
			}

			for (const [position, entry] of input.orders.entries()) {
				const { order } = await this.writePending(tx, {
					order: entry.order,
					payloadHash: entry.payloadHash,
					batchId: batch.id,
				});
				await tx.insert(bulkBatchItems).values({
					batchId: batch.id,
					orderId: entry.order.order_id,
					position,
					status: "QUEUED",
					orderUuid: order.id,
				});
			}

			return toPersistedBatch(batch);
		});
	}

	async getBatch(batchId: string): Promise<BatchSnapshot | undefined> {
		const batch = await this.db.query.bulkBatches.findFirst({
			where: eq(bulkBatches.id, batchId),
			with: {
				items: {
					with: { order: true },
				},
			},
		});
		if (!batch) {
			return undefined;
		}

		const items: PersistedBatchItem[] = [...batch.items]
			.sort((left, right) => left.position - right.position)
			.map((item) => ({
				id: item.id,
				batchId: item.batchId,
				orderId: item.orderId,
				position: item.position,
				status: item.status,
				errorCode: item.errorCode,
				errorMessage: item.errorMessage,
				orderUuid: item.orderUuid,
				claimedAt: item.claimedAt,
				awb: item.order?.awb ?? null,
				orderStatus: item.order?.status ?? null,
			}));

		return { batch: toPersistedBatch(batch), items };
	}

	async reclaimStale(staleMs: number): Promise<number> {
		const cutoff = new Date(Date.now() - staleMs);
		const rows = await this.db
			.update(bulkBatchItems)
			.set({
				status: "QUEUED",
				claimedAt: null,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(bulkBatchItems.status, "PROCESSING"),
					or(
						isNull(bulkBatchItems.claimedAt),
						lt(bulkBatchItems.claimedAt, cutoff),
					),
				),
			)
			.returning({ id: bulkBatchItems.id });
		return rows.length;
	}

	async claimQueued(limit: number): Promise<ClaimedBatchItem[]> {
		if (limit <= 0) {
			return [];
		}

		return this.db.transaction(async (tx) => {
			const rows = await tx
				.select()
				.from(bulkBatchItems)
				.where(eq(bulkBatchItems.status, "QUEUED"))
				.orderBy(asc(bulkBatchItems.createdAt))
				.limit(limit)
				.for("update", { skipLocked: true });

			if (rows.length === 0) {
				return [];
			}

			const ids = rows.map((row) => row.id);
			const now = new Date();
			await tx
				.update(bulkBatchItems)
				.set({
					status: "PROCESSING",
					claimedAt: now,
					updatedAt: now,
				})
				.where(inArray(bulkBatchItems.id, ids));

			const batchIds = [...new Set(rows.map((row) => row.batchId))];
			await tx
				.update(bulkBatches)
				.set({ status: "PROCESSING", updatedAt: now })
				.where(
					and(
						inArray(bulkBatches.id, batchIds),
						eq(bulkBatches.status, "QUEUED"),
					),
				);

			const orderIds = rows
				.map((row) => row.orderUuid)
				.filter((id): id is string => id !== null);
			const orderRows =
				orderIds.length > 0
					? await tx.select().from(orders).where(inArray(orders.id, orderIds))
					: [];
			const ordersById = new Map(orderRows.map((row) => [row.id, row]));

			return rows.map((row) => {
				const order = row.orderUuid ? ordersById.get(row.orderUuid) : undefined;
				return {
					id: row.id,
					batchId: row.batchId,
					orderId: row.orderId,
					position: row.position,
					payload: payloadFromSnapshot(order?.requestSnapshot),
				};
			});
		});
	}

	async completeItem(itemId: string, input: CompleteItemInput): Promise<void> {
		await this.db.transaction(async (tx) => {
			const item = await tx.query.bulkBatchItems.findFirst({
				where: eq(bulkBatchItems.id, itemId),
			});
			if (!item || item.status === "SUCCEEDED" || item.status === "FAILED") {
				return;
			}

			const now = new Date();
			await tx
				.update(bulkBatchItems)
				.set({
					status: input.success ? "SUCCEEDED" : "FAILED",
					errorCode: input.success ? null : input.errorCode,
					errorMessage: input.success ? null : input.errorMessage,
					claimedAt: null,
					updatedAt: now,
				})
				.where(eq(bulkBatchItems.id, itemId));

			const [batch] = await tx
				.update(bulkBatches)
				.set(
					input.success
						? {
								succeeded: sql`${bulkBatches.succeeded} + 1`,
								updatedAt: now,
							}
						: {
								failed: sql`${bulkBatches.failed} + 1`,
								updatedAt: now,
							},
				)
				.where(eq(bulkBatches.id, item.batchId))
				.returning();
			if (!batch) {
				return;
			}

			if (batch.succeeded + batch.failed >= batch.total) {
				await tx
					.update(bulkBatches)
					.set({
						status: "COMPLETED",
						completedAt: now,
						updatedAt: now,
					})
					.where(eq(bulkBatches.id, batch.id));
			}
		});
	}

	async appendCourierCall(input: CourierCallInput): Promise<void> {
		await this.db.insert(courierApiCalls).values({
			orderId: input.orderUuid ?? null,
			courierPartner: input.courierPartner,
			operation: input.operation,
			attempt: input.attempt,
			requestUrl: redactUrl(input.requestUrl),
			requestPayload: redactValue(input.requestPayload),
			responsePayload: redactValue(input.responsePayload),
			httpStatus: input.httpStatus ?? null,
			errorType: input.errorType ?? null,
			durationMs: input.durationMs,
			requestId: input.requestId,
		});
	}

	private async writePending(
		tx: Transaction,
		input: InsertPendingInput,
	): Promise<{ order: PersistedOrder; inserted: boolean }> {
		const [inserted] = await tx
			.insert(orders)
			.values({
				orderId: input.order.order_id,
				courierPartner: input.order.courier_partner,
				status: "PENDING",
				serviceType: input.order.service_type,
				paymentMode: input.order.payment.mode,
				declaredValue: money(input.order.payment.declared_value),
				collectableValue: money(input.order.payment.collectable_value),
				invoiceNumber: input.order.payment.invoice_number,
				invoiceDate: input.order.payment.invoice_date,
				invoiceValue: money(input.order.payment.invoice_value),
				payloadHash: input.payloadHash,
				requestSnapshot: input.order as unknown as Record<string, unknown>,
				batchId: input.batchId,
			})
			.onConflictDoNothing({ target: orders.orderId })
			.returning();

		if (!inserted) {
			const existing = await tx.query.orders.findFirst({
				where: eq(orders.orderId, input.order.order_id),
			});
			if (!existing) {
				throw new Error(
					`Order '${input.order.order_id}' missing after conflict`,
				);
			}
			return { order: toPersisted(existing), inserted: false };
		}

		await tx
			.insert(orderParties)
			.values([
				partyRow(inserted.id, "SHIPPER", input.order.shipper),
				partyRow(inserted.id, "CONSIGNEE", input.order.consignee),
				partyRow(inserted.id, "RETURN", input.order.return_address),
			]);
		await tx.insert(orderPackages).values({
			orderId: inserted.id,
			position: 1,
			description: input.order.package.description,
			sku: input.order.package.sku,
			quantity: input.order.package.quantity,
			pieces: input.order.package.pieces,
			weightKg: weight(input.order.package.weight_kg),
			lengthCm: dimension(input.order.package.length_cm),
			breadthCm: dimension(input.order.package.breadth_cm),
			heightCm: dimension(input.order.package.height_cm),
		});

		return { order: toPersisted(inserted), inserted: true };
	}
}

function partyRow(
	orderId: string,
	role: "SHIPPER" | "CONSIGNEE" | "RETURN",
	party: CreateOrderInput["shipper"],
) {
	return {
		orderId,
		role,
		name: party.name,
		phone: party.phone,
		email: party.email,
		addressLine1: party.address_line1,
		addressType: party.address_type,
		city: party.city,
		state: party.state,
		pincode: party.pincode,
		country: party.country,
	};
}
