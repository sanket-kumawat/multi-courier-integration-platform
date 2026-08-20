import {
	CourierRegistry,
	MockCourierAdapter,
} from "@multi-courier-integration-platform/couriers";
import { describe, expect, it, vi } from "vitest";
import { createOrderSchema } from "../dto/orders";
import { validCreateOrder } from "../dto/orders.test";
import type { AppError } from "../errors";
import { hashCreatePayload, OrderService } from "./order-service";
import { MemoryOrderStore } from "./order-store";

function createService() {
	const registry = new CourierRegistry();
	const adapter = new MockCourierAdapter();
	const createShipment = vi.spyOn(adapter, "createShipment");
	registry.register(adapter);
	const store = new MemoryOrderStore();
	return {
		service: new OrderService(registry, store),
		createShipment,
		store,
	};
}

function input(overrides: Record<string, unknown> = {}) {
	return createOrderSchema.parse(validCreateOrder(overrides));
}

describe("OrderService.create", () => {
	it("creates against mock and persists CREATED with an AWB", async () => {
		const { service } = createService();
		const created = await service.create(input(), { requestId: "req_test" });

		expect(created.status).toBe("CREATED");
		expect(created.courier_partner).toBe("mock");
		expect(created.order_id).toBe("OMS-2026-000142");
		expect(created.awb).toBe("MOCK-OMS-2026-000142");
		expect(created.courier_shipment_id).toBe("MOCK-SHIP-OMS-2026-000142");
		expect(created.internal_id).toEqual(expect.any(String));
	});

	it("replays an identical payload without calling the courier again", async () => {
		const { service, createShipment } = createService();
		const first = await service.create(input(), { requestId: "req_1" });
		const second = await service.create(input(), { requestId: "req_2" });

		expect(createShipment).toHaveBeenCalledTimes(1);
		expect(second).toEqual(first);
	});

	it("rejects a different payload for the same order_id with IDEMPOTENCY_CONFLICT", async () => {
		const { service, createShipment } = createService();
		await service.create(input(), { requestId: "req_1" });

		await expect(
			service.create(input({ package: { ...input().package, sku: "OTHER" } }), {
				requestId: "req_2",
			}),
		).rejects.toMatchObject({
			code: "IDEMPOTENCY_CONFLICT",
			message:
				"Order 'OMS-2026-000142' already exists with a different payload",
		});
		expect(createShipment).toHaveBeenCalledTimes(1);
	});

	it("rejects an unknown courier before any courier I/O", async () => {
		const { service, createShipment } = createService();

		await expect(
			service.create(input({ courier_partner: "fastship" }), {
				requestId: "req_test",
			}),
		).rejects.toMatchObject({
			code: "UNKNOWN_COURIER",
			message: "Courier partner 'fastship' is not supported",
			details: [
				{
					field: "courier_partner",
					message: "Supported couriers: mock",
				},
			],
		});
		expect(createShipment).toHaveBeenCalledTimes(0);
		expect(
			await service
				.get("OMS-2026-000142")
				.catch((error: AppError) => error.code),
		).toBe("ORDER_NOT_FOUND");
	});

	it("retries the partner when a matching row is still PENDING", async () => {
		const { service, createShipment, store } = createService();
		const body = input();
		await store.insertPending({
			order: body,
			payloadHash: hashCreatePayload(body),
		});

		const created = await service.create(body, { requestId: "req_retry" });

		expect(createShipment).toHaveBeenCalledTimes(1);
		expect(created.status).toBe("CREATED");
		expect(created.awb).toBe("MOCK-OMS-2026-000142");
	});

	it("marks the order FAILED when the courier rejects the shipment", async () => {
		const { service } = createService();
		const rejected = input({ order_id: "OMS-FAIL-1" });

		await expect(
			service.create(rejected, { requestId: "req_test" }),
		).rejects.toMatchObject({
			code: "COURIER_REJECTED",
		});

		const stored = await service.get("OMS-FAIL-1");
		expect(stored.status).toBe("FAILED");
		expect(stored.awb).toBeNull();
	});
});

describe("OrderService.get", () => {
	it("returns the persisted row after create", async () => {
		const { service } = createService();
		const created = await service.create(input(), { requestId: "req_test" });
		const fetched = await service.get(created.order_id);
		expect(fetched).toEqual(created);
	});

	it("throws ORDER_NOT_FOUND for an unknown id", async () => {
		const { service } = createService();
		await expect(service.get("OMS-2026-999999")).rejects.toMatchObject({
			code: "ORDER_NOT_FOUND",
			message: "Order 'OMS-2026-999999' not found",
		});
	});
});
