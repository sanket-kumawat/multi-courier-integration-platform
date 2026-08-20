import {
	CourierRegistry,
	MockCourierAdapter,
	UrbaneBoltAdapter,
} from "@multi-courier-integration-platform/couriers";
import { describe, expect, it, vi } from "vitest";
import { createOrderSchema } from "../../dto/orders";
import { validCreateOrder } from "../../dto/orders.test";
import { hashCreatePayload, OrderService } from "../orders";
import { MemoryOrderStore } from "../persistence/memory";
import { CancelService } from "./service";

function input(overrides: Record<string, unknown> = {}) {
	return createOrderSchema.parse(validCreateOrder(overrides));
}

function createServices() {
	const registry = new CourierRegistry();
	const adapter = new MockCourierAdapter();
	registry.register(adapter);
	const store = new MemoryOrderStore();
	return {
		adapter,
		store,
		orders: new OrderService(registry, store),
		cancel: new CancelService(registry, store),
	};
}

describe("CancelService.cancel", () => {
	it("cancels a CREATED mock shipment through the partner", async () => {
		const { orders, cancel, adapter } = createServices();
		const created = await orders.create(input(), { requestId: "req_create" });
		const spy = vi.spyOn(adapter, "cancel");

		const cancelled = await cancel.cancel(created.order_id, {
			requestId: "req_cancel",
		});

		expect(cancelled.status).toBe("CANCELLED");
		expect(cancelled.order_id).toBe(created.order_id);
		expect(cancelled.cancelled_at).toEqual(expect.any(String));
		expect(spy).toHaveBeenCalledTimes(1);
	});

	it("cancels PENDING locally without calling the courier", async () => {
		const { cancel, store, adapter } = createServices();
		const body = input({ order_id: "OMS-PENDING-1" });
		await store.insertPending({
			order: body,
			payloadHash: hashCreatePayload(body),
		});
		const spy = vi.spyOn(adapter, "cancel");

		const cancelled = await cancel.cancel("OMS-PENDING-1", {
			requestId: "req_cancel",
		});

		expect(cancelled.status).toBe("CANCELLED");
		expect(spy).not.toHaveBeenCalled();
	});

	it("cancels FAILED locally without calling the courier", async () => {
		const { orders, cancel, adapter } = createServices();
		await expect(
			orders.create(input({ order_id: "OMS-FAIL-1" }), {
				requestId: "req_create",
			}),
		).rejects.toMatchObject({ code: "COURIER_REJECTED" });
		const spy = vi.spyOn(adapter, "cancel");

		const cancelled = await cancel.cancel("OMS-FAIL-1", {
			requestId: "req_cancel",
		});

		expect(cancelled.status).toBe("CANCELLED");
		expect(spy).not.toHaveBeenCalled();
	});

	it("returns 409 CANCELLATION_NOT_ALLOWED after pickup", async () => {
		const { orders, cancel, store, adapter } = createServices();
		const created = await orders.create(input(), { requestId: "req_create" });
		const persisted = await store.findByOrderId(created.order_id);
		await store.applyTrack(persisted?.id ?? "", {
			status: "PICKED_UP",
			events: [
				{
					status: "PICKED_UP",
					partnerStatus: "Picked up",
					description: "Picked up from seller",
					location: null,
					occurredAt: new Date(),
					raw: { status: "PICKED_UP" },
				},
			],
			rawResponse: { status: "PICKED_UP" },
			requestId: "req_track",
			durationMs: 1,
		});
		const spy = vi.spyOn(adapter, "cancel");

		await expect(
			cancel.cancel(created.order_id, { requestId: "req_cancel" }),
		).rejects.toMatchObject({
			code: "CANCELLATION_NOT_ALLOWED",
			message:
				"Cannot cancel order with status 'PICKED_UP'. Cancellation is only allowed for PENDING, CREATED, or FAILED orders.",
			details: [{ field: "status", message: "Current status is 'PICKED_UP'" }],
		});
		expect(spy).not.toHaveBeenCalled();
	});

	it("replays CANCELLED without calling the partner again", async () => {
		const { orders, cancel, adapter } = createServices();
		const created = await orders.create(input(), { requestId: "req_create" });
		const spy = vi.spyOn(adapter, "cancel");
		const first = await cancel.cancel(created.order_id, {
			requestId: "req_1",
		});
		const second = await cancel.cancel(created.order_id, {
			requestId: "req_2",
		});

		expect(spy).toHaveBeenCalledTimes(1);
		expect(second).toEqual(first);
	});

	it("treats partner already-cancelled as success", async () => {
		const { orders, cancel, adapter } = createServices();
		const created = await orders.create(input(), { requestId: "req_create" });
		vi.spyOn(adapter, "cancel").mockResolvedValue({
			rawRequest: { awb: created.awb },
			rawResponse: { message: "Shipment already cancelled!" },
		});

		const cancelled = await cancel.cancel(created.order_id, {
			requestId: "req_cancel",
		});

		expect(cancelled.status).toBe("CANCELLED");
		const stored = await orders.get(created.order_id);
		expect(stored.status).toBe("CANCELLED");
	});

	it("throws ORDER_NOT_FOUND for an unknown id", async () => {
		const { cancel } = createServices();
		await expect(
			cancel.cancel("OMS-MISSING", { requestId: "req_cancel" }),
		).rejects.toMatchObject({
			code: "ORDER_NOT_FOUND",
			message: "Order 'OMS-MISSING' not found",
		});
	});
});

describe("CancelService.cancel urbanebolt", () => {
	it("cancels through the same service path with mocked HTTP", async () => {
		const fetchMock = vi.fn<typeof fetch>(async (url) => {
			const href = String(url);
			if (href.includes("/auth/getToken/")) {
				return new Response(
					JSON.stringify({
						access_token: "ub-token",
						expires_in: 86400,
						token_type: "Bearer",
					}),
					{ status: 200, headers: { "content-type": "application/json" } },
				);
			}
			if (href.includes("/services/cancel/")) {
				return new Response(
					JSON.stringify({ message: "Shipment already cancelled!" }),
					{ status: 200, headers: { "content-type": "application/json" } },
				);
			}
			return new Response(
				JSON.stringify({
					status: true,
					successResponse: [
						{
							awb: "200000001170",
							orderNumber: "OMS-UB-CANCEL",
							status: "Manifested",
						},
					],
					failedResponse: [],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		});

		const registry = new CourierRegistry();
		registry.register(new MockCourierAdapter());
		registry.register(
			new UrbaneBoltAdapter({
				username: "user",
				password: "pass",
				customerCode: "CUST-1",
				fetch: fetchMock,
				sleep: async () => undefined,
			}),
		);
		const store = new MemoryOrderStore();
		const orders = new OrderService(registry, store);
		const cancel = new CancelService(registry, store);
		await orders.create(
			input({ courier_partner: "urbanebolt", order_id: "OMS-UB-CANCEL" }),
			{ requestId: "req_create" },
		);

		const cancelled = await cancel.cancel("OMS-UB-CANCEL", {
			requestId: "req_cancel",
		});

		expect(cancelled.status).toBe("CANCELLED");
		expect(cancelled.order_id).toBe("OMS-UB-CANCEL");
		expect(
			vi
				.mocked(fetchMock)
				.mock.calls.some(([url]) => String(url).includes("/services/cancel/")),
		).toBe(true);
	});
});
