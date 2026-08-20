import type { CourierRegistry } from "@multi-courier-integration-platform/couriers";
import type { CancelOrderResponse } from "../../dto/orders";
import { AppError } from "../../errors";
import { mapCourierError } from "../shared/courier-errors";
import { cancellationNotAllowedMessage, isCancellable } from "./guards";
import type { CancelStore } from "./store";

export type CancelServiceContext = {
	requestId: string;
};

export class CancelService {
	constructor(
		private readonly registry: CourierRegistry,
		private readonly db: CancelStore,
	) {}

	async cancel(
		orderId: string,
		ctx: CancelServiceContext,
	): Promise<CancelOrderResponse> {
		const order = await this.db.findByOrderId(orderId);
		if (!order) {
			throw new AppError("ORDER_NOT_FOUND", `Order '${orderId}' not found`);
		}

		if (order.status === "CANCELLED") {
			const cancelledAt =
				(await this.db.cancelledAt(order.id)) ?? order.updatedAt;
			return toCancelResponse(order.orderId, cancelledAt);
		}

		if (!isCancellable(order.status)) {
			throw new AppError(
				"CANCELLATION_NOT_ALLOWED",
				cancellationNotAllowedMessage(order.status),
				[{ field: "status", message: `Current status is '${order.status}'` }],
			);
		}

		const cancelledAt = new Date();
		if (order.status !== "CREATED" || !order.awb) {
			const persisted = await this.db.applyCancel(order.id, {
				cancelledAt,
				partnerStatus: "CANCELLED",
				requestId: ctx.requestId,
				durationMs: 0,
				calledCourier: false,
			});
			return toCancelResponse(persisted.order.orderId, persisted.cancelledAt);
		}

		const adapter = this.registry.get(order.courierPartner);
		const started = Date.now();
		try {
			const result = await adapter.cancel(
				{
					awb: order.awb,
					courierShipmentId: order.courierShipmentId ?? undefined,
				},
				{ requestId: ctx.requestId, orderId: order.orderId },
			);
			const persisted = await this.db.applyCancel(order.id, {
				cancelledAt,
				partnerStatus: "CANCELLED",
				rawRequest: result.rawRequest,
				rawResponse: result.rawResponse,
				requestId: ctx.requestId,
				durationMs: Date.now() - started,
				calledCourier: true,
			});
			return toCancelResponse(persisted.order.orderId, persisted.cancelledAt);
		} catch (error) {
			throw mapCourierError(error);
		}
	}
}

function toCancelResponse(
	orderId: string,
	cancelledAt: Date,
): CancelOrderResponse {
	return {
		order_id: orderId,
		status: "CANCELLED",
		cancelled_at: cancelledAt.toISOString(),
	};
}
