import type {
	CourierAdapter,
	TrackEvent,
} from "@multi-courier-integration-platform/couriers";
import {
	CourierError,
	type CourierRegistry,
	CourierUnavailableError,
} from "@multi-courier-integration-platform/couriers";
import type { TrackOrderResponse } from "../../dto/orders";
import { AppError } from "../../errors";
import { mapCourierError } from "../shared/courier-errors";
import { nextCanonicalStatus } from "./status";
import type {
	NewTrackingEvent,
	PersistedOrder,
	PersistedTrackingEvent,
	TrackingStore,
} from "./store";

export type TrackingServiceContext = {
	requestId: string;
};

export class TrackingService {
	constructor(
		private readonly registry: CourierRegistry,
		private readonly db: TrackingStore,
	) {}

	async track(
		orderId: string,
		ctx: TrackingServiceContext,
	): Promise<TrackOrderResponse> {
		const order = await this.db.findByOrderId(orderId);
		if (!order) {
			throw new AppError("ORDER_NOT_FOUND", `Order '${orderId}' not found`);
		}
		if (!order.awb) {
			throw new AppError(
				"COURIER_UNAVAILABLE",
				"Courier partner is temporarily unavailable",
			);
		}

		const adapter = this.registry.get(order.courierPartner);
		const started = Date.now();
		try {
			const result = await adapter.track(
				{
					awb: order.awb,
					courierShipmentId: order.courierShipmentId ?? undefined,
				},
				{ requestId: ctx.requestId, orderId: order.orderId },
			);
			const incoming = toNewEvents(
				adapter,
				result.events,
				result.partnerStatus,
			);
			const nextStatus = incoming.reduce(
				(status, event) => nextCanonicalStatus(status, event.status),
				order.status,
			);
			const persisted = await this.db.applyTrack(order.id, {
				status: nextStatus,
				events: incoming,
				rawResponse: result.rawResponse,
				requestId: ctx.requestId,
				durationMs: Date.now() - started,
			});
			return toTrackResponse(persisted.order, persisted.events, false);
		} catch (error) {
			await this.db.recordTrackFailure(order.id, {
				errorCode:
					error instanceof CourierError ? error.code : "INTERNAL_ERROR",
				requestId: ctx.requestId,
				durationMs: Date.now() - started,
				httpStatus: error instanceof CourierUnavailableError ? 502 : undefined,
			});
			if (error instanceof CourierUnavailableError) {
				const events = await this.db.listTrackingEvents(order.id);
				return toTrackResponse(order, events, true);
			}
			throw mapCourierError(error);
		}
	}
}

function toNewEvents(
	adapter: CourierAdapter,
	events: TrackEvent[],
	partnerStatus: string,
): NewTrackingEvent[] {
	const source =
		events.length > 0
			? events
			: [
					{
						partnerStatus,
						description: partnerStatus,
						occurredAt: new Date(),
						raw: { partnerStatus },
					},
				];
	return source.map((event) => ({
		status: adapter.mapStatus(event.partnerStatus),
		partnerStatus: event.partnerStatus,
		description: event.description,
		location: event.location ?? null,
		occurredAt: event.occurredAt,
		raw: event.raw,
	}));
}

function toTrackResponse(
	order: PersistedOrder,
	events: PersistedTrackingEvent[],
	stale: boolean,
): TrackOrderResponse {
	if (!order.awb) {
		throw new AppError(
			"COURIER_UNAVAILABLE",
			"Courier partner is temporarily unavailable",
		);
	}
	return {
		order_id: order.orderId,
		courier_partner: order.courierPartner,
		awb: order.awb,
		status: order.status,
		stale,
		history: events.map((event) => ({
			status: event.status,
			occurred_at: event.occurredAt.toISOString(),
			description: event.description ?? event.partnerStatus,
			location: event.location,
		})),
	};
}
