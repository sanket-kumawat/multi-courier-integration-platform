import {
	CourierRegistry,
	MockCourierAdapter,
} from "@multi-courier-integration-platform/couriers";
import { call } from "@orpc/server";
import { describe, expect, it } from "vitest";
import { createOrderSchema } from "../dto/orders";
import { validCreateOrder } from "../dto/orders.test";
import { OrderService } from "../services/order-service";
import { MemoryOrderStore } from "../services/order-store";
import { appRouter } from "./index";

function testContext() {
	const registry = new CourierRegistry();
	registry.register(new MockCourierAdapter());
	return {
		auth: null,
		session: null,
		requestId: "req_test",
		orderService: new OrderService(registry, new MemoryOrderStore()),
	};
}

describe("createOrder", () => {
	it("returns 201-shaped payload for mock and replays identically", async () => {
		const context = testContext();
		const body = createOrderSchema.parse(validCreateOrder());

		const created = await call(appRouter.createOrder, body, { context });
		expect(created.status).toBe("CREATED");
		expect(created.awb).toBe("MOCK-OMS-2026-000142");

		const replayed = await call(appRouter.createOrder, body, { context });
		expect(replayed).toEqual(created);
	});

	it("maps unknown courier to UNKNOWN_COURIER", async () => {
		const context = testContext();
		const body = createOrderSchema.parse(
			validCreateOrder({ courier_partner: "fastship" }),
		);

		await expect(
			call(appRouter.createOrder, body, { context }),
		).rejects.toMatchObject({
			code: "UNKNOWN_COURIER",
			status: 400,
		});
	});
});

describe("getOrder", () => {
	it("returns the persisted order", async () => {
		const context = testContext();
		const body = createOrderSchema.parse(validCreateOrder());
		const created = await call(appRouter.createOrder, body, { context });

		const fetched = await call(
			appRouter.getOrder,
			{ order_id: created.order_id },
			{ context },
		);
		expect(fetched).toEqual(created);
	});
});
