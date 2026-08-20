import {
	CourierRegistry,
	CourierUnavailableError,
	MockCourierAdapter,
} from "@multi-courier-integration-platform/couriers";
import { describe, expect, it, vi } from "vitest";
import { createOrderSchema } from "../../dto/orders";
import { validCreateOrder } from "../../dto/orders.test";
import { hashCreatePayload, OrderService } from "../orders";
import { MemoryOrderStore } from "../persistence/memory";
import { TrackingService } from "./service";

function input(overrides: Record<string, unknown> = {}) {
	return createOrderSchema.parse(validCreateOrder(overrides));
}

function createServices(options?: {
	now?: () => Date;
	phaseDurationMs?: number;
}) {
	const registry = new CourierRegistry();
	const adapter = new MockCourierAdapter(options);
	registry.register(adapter);
	const store = new MemoryOrderStore();
	return {
		adapter,
		store,
		orders: new OrderService(registry, store),
		tracking: new TrackingService(registry, store),
	};
}

describe("TrackingService.track", () => {
	it("appends mapped events before returning a fresh history", async () => {
		let now = new Date();
		const { orders, tracking, store } = createServices({
			now: () => now,
			phaseDurationMs: 60_000,
		});
		const created = await orders.create(input(), { requestId: "req_create" });
		now = new Date(now.getTime() + 61_000);

		const tracked = await tracking.track(created.order_id, {
			requestId: "req_track",
		});

		expect(tracked.stale).toBe(false);
		expect(tracked.awb).toBe("MOCK-OMS-2026-000142");
		expect(tracked.status).toBe("IN_TRANSIT");
		expect(tracked.history.map((event) => event.status)).toEqual([
			"CREATED",
			"IN_TRANSIT",
		]);
		expect(tracked.history[1]).toMatchObject({
			description: "Reached hub",
			status: "IN_TRANSIT",
		});

		const persisted = await store.findByOrderId(created.order_id);
		const events = await store.listTrackingEvents(persisted?.id ?? "");
		expect(events.map((event) => event.status)).toEqual([
			"CREATED",
			"IN_TRANSIT",
		]);
	});

	it("returns 200 stale:true from DB history when the courier is down", async () => {
		const { orders, tracking, adapter } = createServices();
		const created = await orders.create(input(), { requestId: "req_create" });
		vi.spyOn(adapter, "track").mockRejectedValue(new CourierUnavailableError());

		const tracked = await tracking.track(created.order_id, {
			requestId: "req_track",
		});

		expect(tracked.stale).toBe(true);
		expect(tracked.status).toBe("CREATED");
		expect(tracked.history).toEqual(
			expect.arrayContaining([expect.objectContaining({ status: "CREATED" })]),
		);
	});

	it("throws COURIER_UNAVAILABLE when the order was never manifested", async () => {
		const { tracking, store, adapter } = createServices();
		const body = input({ order_id: "OMS-PENDING-1" });
		await store.insertPending({
			order: body,
			payloadHash: hashCreatePayload(body),
		});
		const track = vi.spyOn(adapter, "track");

		await expect(
			tracking.track("OMS-PENDING-1", { requestId: "req_track" }),
		).rejects.toMatchObject({
			code: "COURIER_UNAVAILABLE",
			message: "Courier partner is temporarily unavailable",
		});
		expect(track).not.toHaveBeenCalled();
	});

	it("throws ORDER_NOT_FOUND for an unknown consumer id", async () => {
		const { tracking } = createServices();
		await expect(
			tracking.track("OMS-MISSING", { requestId: "req_track" }),
		).rejects.toMatchObject({
			code: "ORDER_NOT_FOUND",
			message: "Order 'OMS-MISSING' not found",
		});
	});

	it("does not move status backwards from DELIVERED except RTO", async () => {
		const { orders, tracking, adapter } = createServices();
		const created = await orders.create(input(), { requestId: "req_create" });
		vi.spyOn(adapter, "track")
			.mockResolvedValueOnce({
				partnerStatus: "DELIVERED",
				events: [
					{
						partnerStatus: "DELIVERED",
						description: "Delivered",
						occurredAt: new Date("2026-08-19T18:00:00.000Z"),
						raw: { status: "DELIVERED" },
					},
				],
				rawResponse: { status: "DELIVERED" },
			})
			.mockResolvedValueOnce({
				partnerStatus: "CREATED",
				events: [
					{
						partnerStatus: "CREATED",
						description: "Shipment manifested",
						occurredAt: new Date("2026-08-19T19:00:00.000Z"),
						raw: { status: "CREATED" },
					},
				],
				rawResponse: { status: "CREATED" },
			})
			.mockResolvedValueOnce({
				partnerStatus: "RTO",
				events: [
					{
						partnerStatus: "RTO",
						description: "Return to origin",
						occurredAt: new Date("2026-08-19T20:00:00.000Z"),
						raw: { status: "RTO" },
					},
				],
				rawResponse: { status: "RTO" },
			});

		expect(
			(await tracking.track(created.order_id, { requestId: "req_1" })).status,
		).toBe("DELIVERED");
		expect(
			(await tracking.track(created.order_id, { requestId: "req_2" })).status,
		).toBe("DELIVERED");
		expect(
			(await tracking.track(created.order_id, { requestId: "req_3" })).status,
		).toBe("RTO");
	});
});
