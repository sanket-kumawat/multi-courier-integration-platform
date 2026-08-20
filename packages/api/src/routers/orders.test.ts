import {
	CourierRegistry,
	MockCourierAdapter,
} from "@multi-courier-integration-platform/couriers";
import { call } from "@orpc/server";
import { describe, expect, it } from "vitest";
import { createOrderSchema } from "../dto/orders";
import { validCreateOrder } from "../dto/orders.test";
import { BulkOrderService } from "../services/bulk";
import { CancelService } from "../services/cancel";
import { OrderService } from "../services/orders";
import { MemoryOrderStore } from "../services/persistence/memory";
import { TrackingService } from "../services/tracking";
import { appRouter } from "./index";

function testContext() {
	const registry = new CourierRegistry();
	registry.register(new MockCourierAdapter());
	const store = new MemoryOrderStore();
	return {
		auth: null,
		session: null,
		requestId: "req_test",
		log: undefined,
		orderService: new OrderService(registry, store),
		trackingService: new TrackingService(registry, store),
		cancelService: new CancelService(registry, store),
		bulkOrderService: new BulkOrderService(registry, store),
		courierRegistry: registry,
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

describe("trackOrder", () => {
	it("returns fresh history for a created mock shipment", async () => {
		const context = testContext();
		const body = createOrderSchema.parse(validCreateOrder());
		const created = await call(appRouter.createOrder, body, { context });

		const tracked = await call(
			appRouter.trackOrder,
			{ order_id: created.order_id },
			{ context },
		);

		expect(tracked.stale).toBe(false);
		expect(tracked.awb).toBe(created.awb);
		expect(tracked.history.length).toBeGreaterThanOrEqual(1);
		expect(tracked.history[0]?.status).toBe("CREATED");
	});

	it("maps a missing order to ORDER_NOT_FOUND", async () => {
		const context = testContext();
		await expect(
			call(appRouter.trackOrder, { order_id: "OMS-MISSING" }, { context }),
		).rejects.toMatchObject({
			code: "ORDER_NOT_FOUND",
			status: 404,
		});
	});
});

describe("cancelOrder", () => {
	it("cancels a created mock shipment", async () => {
		const context = testContext();
		const body = createOrderSchema.parse(validCreateOrder());
		const created = await call(appRouter.createOrder, body, { context });

		const cancelled = await call(
			appRouter.cancelOrder,
			{ order_id: created.order_id },
			{ context },
		);

		expect(cancelled.status).toBe("CANCELLED");
		expect(cancelled.order_id).toBe(created.order_id);
		expect(cancelled.cancelled_at).toEqual(expect.any(String));
	});

	it("maps a missing order to ORDER_NOT_FOUND", async () => {
		const context = testContext();
		await expect(
			call(appRouter.cancelOrder, { order_id: "OMS-MISSING" }, { context }),
		).rejects.toMatchObject({
			code: "ORDER_NOT_FOUND",
			status: 404,
		});
	});
});

describe("createBulkOrders", () => {
	it("returns 202-shaped QUEUED without waiting for courier I/O", async () => {
		const context = testContext();
		const accepted = await call(
			appRouter.createBulkOrders,
			{
				orders: [
					createOrderSchema.parse(validCreateOrder({ order_id: "BULK-001" })),
					createOrderSchema.parse(validCreateOrder({ order_id: "BULK-002" })),
				],
			},
			{ context },
		);

		expect(accepted.status).toBe("QUEUED");
		expect(accepted.accepted).toBe(2);
		expect(accepted.poll_url).toBe(`/api/v1/batches/${accepted.batch_id}`);

		const polled = await call(
			appRouter.getBatch,
			{ batch_id: accepted.batch_id },
			{ context },
		);
		expect(polled.status).toBe("QUEUED");
		expect(polled.results).toEqual([]);
	});

	it("rejects duplicate order_id values with VALIDATION_ERROR", async () => {
		const context = testContext();
		await expect(
			call(
				appRouter.createBulkOrders,
				{
					orders: [
						createOrderSchema.parse(validCreateOrder({ order_id: "BULK-001" })),
						createOrderSchema.parse(validCreateOrder({ order_id: "BULK-001" })),
					],
				},
				{ context },
			),
		).rejects.toMatchObject({
			code: "VALIDATION_ERROR",
			status: 400,
			message: "Duplicate order_id values in batch",
		});
	});
});

describe("getBatch", () => {
	it("maps a missing batch to ORDER_NOT_FOUND", async () => {
		const context = testContext();
		await expect(
			call(appRouter.getBatch, { batch_id: "bch_nonexistent" }, { context }),
		).rejects.toMatchObject({
			code: "ORDER_NOT_FOUND",
			status: 404,
			message: "Batch 'bch_nonexistent' not found",
		});
	});
});
