import {
	createOrderSchema,
	getOrderInputSchema,
	orderResponseSchema,
} from "../dto/orders";
import { AppError } from "../errors";
import { publicProcedure } from "../index";
import type { OrderService } from "../services/order-service";

function requireOrderService(
	orderService: OrderService | undefined,
): OrderService {
	if (!orderService) {
		throw new AppError("INTERNAL_ERROR", "An unexpected error occurred");
	}
	return orderService;
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
