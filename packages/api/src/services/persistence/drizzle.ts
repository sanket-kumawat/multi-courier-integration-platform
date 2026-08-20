import {
	courierApiCalls,
	type createDb,
	orderPackages,
	orderParties,
	orders,
	trackingEvents,
} from "@multi-courier-integration-platform/db";
import { asc, eq } from "drizzle-orm";
import type { CreateOrderInput } from "../../dto/orders";
import type {
	InsertPendingInput,
	MarkCreatedInput,
	MarkFailedInput,
	OrderStore,
} from "../orders/store";
import type { PersistedOrder } from "../shared/order";
import type {
	ApplyTrackInput,
	PersistedTrackingEvent,
	RecordTrackFailureInput,
	TrackingStore,
} from "../tracking/store";

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

export class DrizzleOrderStore implements OrderStore, TrackingStore {
	constructor(private readonly db: ReturnType<typeof createDb>) {}

	async insertPending(
		input: InsertPendingInput,
	): Promise<{ order: PersistedOrder; inserted: boolean }> {
		return this.db.transaction(async (tx) => {
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
		});
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
					lastCourierRequest: input.rawRequest,
					lastCourierResponse: input.rawResponse,
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
				requestPayload: input.rawRequest,
				responsePayload: input.rawResponse,
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
					lastCourierRequest: input.rawRequest,
					lastCourierResponse: input.rawResponse,
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
				requestPayload: input.rawRequest,
				responsePayload: input.rawResponse,
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
					lastCourierResponse: input.rawResponse,
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
				responsePayload: input.rawResponse,
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
