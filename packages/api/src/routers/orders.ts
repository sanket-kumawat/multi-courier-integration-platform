import {
	cancelOrderResponseSchema,
	createOrderSchema,
	getOrderInputSchema,
	orderResponseSchema,
	trackOrderResponseSchema,
} from "../dto/orders";
import { AppError } from "../errors";
import { publicProcedure } from "../index";
import type { CancelService } from "../services/cancel";
import type { OrderService } from "../services/orders";
import type { TrackingService } from "../services/tracking";

function requireOrderService(
	orderService: OrderService | undefined,
): OrderService {
	if (!orderService) {
		throw new AppError("INTERNAL_ERROR", "An unexpected error occurred");
	}
	return orderService;
}

function requireTrackingService(
	trackingService: TrackingService | undefined,
): TrackingService {
	if (!trackingService) {
		throw new AppError("INTERNAL_ERROR", "An unexpected error occurred");
	}
	return trackingService;
}

function requireCancelService(
	cancelService: CancelService | undefined,
): CancelService {
	if (!cancelService) {
		throw new AppError("INTERNAL_ERROR", "An unexpected error occurred");
	}
	return cancelService;
}

export const createOrder = publicProcedure
	.route({
		method: "POST",
		path: "/orders",
		summary: "Create order",
		description:
			"Create a single shipment through a registered courier partner. Idempotent on order_id.",
		tags: ["orders"],
		successStatus: 201,
		successDescription: "Shipment created",
	})
	.input(createOrderSchema)
	.output(orderResponseSchema)
	.handler(({ input, context }) =>
		requireOrderService(context.orderService).create(input, context),
	);

export const getOrder = publicProcedure
	.route({
		method: "GET",
		path: "/orders/{order_id}",
		summary: "Get order",
		description:
			"Return the persisted order by consumer order id. Does not call the courier.",
		tags: ["orders"],
		successDescription: "Persisted order",
	})
	.input(getOrderInputSchema)
	.output(orderResponseSchema)
	.handler(({ input, context }) =>
		requireOrderService(context.orderService).get(input.order_id),
	);

export const trackOrder = publicProcedure
	.route({
		method: "GET",
		path: "/orders/{order_id}/track",
		summary: "Track order",
		description:
			"Pull the latest shipment status from the courier and return append-only history.",
		tags: ["orders"],
		successDescription: "Tracking history",
	})
	.input(getOrderInputSchema)
	.output(trackOrderResponseSchema)
	.handler(({ input, context }) =>
		requireTrackingService(context.trackingService).track(
			input.order_id,
			context,
		),
	);

export const cancelOrder = publicProcedure
	.route({
		method: "POST",
		path: "/orders/{order_id}/cancel",
		summary: "Cancel order",
		description:
			"Cancel a shipment before pickup. PENDING and FAILED cancel locally; CREATED calls the courier.",
		tags: ["orders"],
		successDescription: "Shipment cancelled",
	})
	.input(getOrderInputSchema)
	.output(cancelOrderResponseSchema)
	.handler(({ input, context }) =>
		requireCancelService(context.cancelService).cancel(input.order_id, context),
	);
