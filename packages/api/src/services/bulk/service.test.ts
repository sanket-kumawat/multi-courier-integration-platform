import {
	CourierRegistry,
	MockCourierAdapter,
	UrbaneBoltAdapter,
} from "@multi-courier-integration-platform/couriers";
import { describe, expect, it, vi } from "vitest";
import { createOrderSchema } from "../../dto/orders";
import { validCreateOrder } from "../../dto/orders.test";
import type { AppError } from "../../errors";
import { OrderService } from "../orders";
import { MemoryOrderStore } from "../persistence/memory";
import { BulkOrderService } from "./service";
import { BulkWorker } from "./worker";

function input(overrides: Record<string, unknown> = {}) {
	return createOrderSchema.parse(validCreateOrder(overrides));
}

function createBulk(registry = new CourierRegistry()) {
	if (registry.list().length === 0) {
		registry.register(new MockCourierAdapter());
	}
	const store = new MemoryOrderStore();
	const orderService = new OrderService(registry, store);
	return {
		registry,
		store,
		orderService,
		bulk: new BulkOrderService(registry, store),
		worker: new BulkWorker({
			store,
			orderService,
			concurrency: 10,
			staleMs: 1_000,
		}),
	};
}

async function drain(
	worker: BulkWorker,
	bulk: BulkOrderService,
	batchId: string,
) {
	for (let attempt = 0; attempt < 50; attempt += 1) {
		await worker.tick();
		const batch = await bulk.get(batchId);
		if (batch.status === "COMPLETED") {
			return batch;
		}
	}
	throw new Error(`Batch '${batchId}' did not complete`);
}

describe("BulkOrderService.enqueue", () => {
	it("returns 202-shaped QUEUED immediately without calling the courier", async () => {
		const registry = new CourierRegistry();
		const adapter = new MockCourierAdapter();
		const createShipment = vi.spyOn(adapter, "createShipment");
		registry.register(adapter);
		const { store, bulk } = createBulk(registry);
		const orders = [
			input({ order_id: "BULK-001" }),
			input({ order_id: "BULK-002" }),
		];

		const accepted = await bulk.enqueue({ orders }, { requestId: "req_bulk" });

		expect(accepted.status).toBe("QUEUED");
		expect(accepted.accepted).toBe(2);
		expect(accepted.poll_url).toBe(`/api/v1/batches/${accepted.batch_id}`);
		expect(createShipment).not.toHaveBeenCalled();

		const pending = await store.findByOrderId("BULK-001");
		expect(pending?.status).toBe("PENDING");
		expect(pending?.awb).toBeNull();

		const polled = await bulk.get(accepted.batch_id);
		expect(polled.status).toBe("QUEUED");
		expect(polled.results).toEqual([]);
		expect(polled.pending).toBe(2);
	});

	it("rejects duplicate order_id values in the same batch with VALIDATION_ERROR", async () => {
		const { bulk, store } = createBulk();

		await expect(
			bulk.enqueue(
				{
					orders: [
						input({ order_id: "BULK-001" }),
						input({ order_id: "BULK-002" }),
						input({ order_id: "BULK-001" }),
					],
				},
				{ requestId: "req_dup" },
			),
		).rejects.toMatchObject({
			code: "VALIDATION_ERROR",
			message: "Duplicate order_id values in batch",
			details: [
				{
					field: "orders[2].order_id",
					message: "Duplicate of orders[0].order_id: 'BULK-001'",
				},
			],
		});
		expect(await store.findByOrderId("BULK-001")).toBeUndefined();
	});

	it("rejects an unknown courier for the entire batch before any insert", async () => {
		const { bulk, store } = createBulk();

		await expect(
			bulk.enqueue(
				{
					orders: [
						input({ order_id: "BULK-001" }),
						input({
							order_id: "BULK-002",
							courier_partner: "fastship",
						}),
					],
				},
				{ requestId: "req_unknown" },
			),
		).rejects.toMatchObject({
			code: "UNKNOWN_COURIER",
			message: "Courier partner 'fastship' is not supported",
			details: [
				{
					field: "orders[1].courier_partner",
					message: "Supported couriers: mock",
				},
			],
		});
		expect(await store.findByOrderId("BULK-001")).toBeUndefined();
	});
});

describe("BulkOrderService.get", () => {
	it("throws ORDER_NOT_FOUND for a missing batch", async () => {
		const { bulk } = createBulk();
		await expect(bulk.get("bch_nonexistent")).rejects.toMatchObject({
			code: "ORDER_NOT_FOUND",
			message: "Batch 'bch_nonexistent' not found",
		});
	});
});

describe("BulkWorker", () => {
	it("processes mixed partners on the same OrderService path", async () => {
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
			return new Response(
				JSON.stringify({
					status: true,
					successResponse: [
						{
							awb: "200000001170",
							orderNumber: "BULK-UB-1",
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
		const { bulk, worker } = createBulk(registry);

		const accepted = await bulk.enqueue(
			{
				orders: [
					input({ order_id: "BULK-MOCK-1", courier_partner: "mock" }),
					input({ order_id: "BULK-UB-1", courier_partner: "urbanebolt" }),
				],
			},
			{ requestId: "req_mixed" },
		);
		const completed = await drain(worker, bulk, accepted.batch_id);

		expect(completed.status).toBe("COMPLETED");
		expect(completed.succeeded).toBe(2);
		expect(completed.failed).toBe(0);
		expect(completed.results).toEqual([
			expect.objectContaining({
				order_id: "BULK-MOCK-1",
				position: 0,
				success: true,
				awb: "MOCK-BULK-MOCK-1",
				status: "CREATED",
				error: null,
			}),
			expect.objectContaining({
				order_id: "BULK-UB-1",
				position: 1,
				success: true,
				awb: "200000001170",
				status: "CREATED",
				error: null,
			}),
		]);
	});

	it("completes a 95/5 partial-success batch with per-order reasons", async () => {
		const { bulk, worker } = createBulk();
		const orders = Array.from({ length: 20 }, (_, index) =>
			input({
				order_id:
					index === 19
						? "BULK-FAIL-19"
						: `BULK-${String(index).padStart(3, "0")}`,
			}),
		);

		const accepted = await bulk.enqueue({ orders }, { requestId: "req_95" });
		const completed = await drain(worker, bulk, accepted.batch_id);

		expect(completed.status).toBe("COMPLETED");
		expect(completed.succeeded).toBe(19);
		expect(completed.failed).toBe(1);
		expect(completed.pending).toBe(0);
		expect(completed.results).toHaveLength(20);
		expect(completed.results.filter((row) => row.success)).toHaveLength(19);
		expect(completed.results[19]).toMatchObject({
			order_id: "BULK-FAIL-19",
			position: 19,
			success: false,
			awb: null,
			status: "FAILED",
			error: {
				code: "COURIER_REJECTED",
				message: "Courier rejected the request",
			},
		});
	});

	it("reclaims stale PROCESSING items after a worker crash", async () => {
		const { store, bulk, worker } = createBulk();
		const accepted = await bulk.enqueue(
			{ orders: [input({ order_id: "BULK-CRASH-1" })] },
			{ requestId: "req_crash" },
		);

		const claimed = await store.claimQueued(1);
		expect(claimed).toHaveLength(1);
		store.markItemClaimedAt(claimed[0]?.id ?? "", new Date(Date.now() - 5_000));

		const inflight = await bulk.get(accepted.batch_id);
		expect(inflight.status).toBe("PROCESSING");
		expect(inflight.results).toEqual([]);

		const completed = await drain(worker, bulk, accepted.batch_id);
		expect(completed.status).toBe("COMPLETED");
		expect(completed.succeeded).toBe(1);
		expect(completed.results[0]).toMatchObject({
			order_id: "BULK-CRASH-1",
			success: true,
			awb: "MOCK-BULK-CRASH-1",
		});
	});

	it("caps in-flight courier calls at BULK_CONCURRENCY", async () => {
		const registry = new CourierRegistry();
		const adapter = new MockCourierAdapter();
		const original = adapter.createShipment.bind(adapter);
		let inflight = 0;
		let maxInflight = 0;
		vi.spyOn(adapter, "createShipment").mockImplementation(
			async (shipment, ctx) => {
				inflight += 1;
				maxInflight = Math.max(maxInflight, inflight);
				await new Promise((resolve) => setTimeout(resolve, 20));
				try {
					return await original(shipment, ctx);
				} finally {
					inflight -= 1;
				}
			},
		);
		registry.register(adapter);
		const store = new MemoryOrderStore();
		const orderService = new OrderService(registry, store);
		const bulk = new BulkOrderService(registry, store);
		const worker = new BulkWorker({
			store,
			orderService,
			concurrency: 2,
			staleMs: 1_000,
		});

		const accepted = await bulk.enqueue(
			{
				orders: Array.from({ length: 6 }, (_, index) =>
					input({ order_id: `BULK-CONC-${index}` }),
				),
			},
			{ requestId: "req_conc" },
		);
		await drain(worker, bulk, accepted.batch_id);

		expect(maxInflight).toBeLessThanOrEqual(2);
		expect(maxInflight).toBeGreaterThan(1);
	});

	it("marks an idempotency conflict as a failed item without failing the batch", async () => {
		const { bulk, worker, orderService } = createBulk();
		await orderService.create(input({ order_id: "BULK-IDEM-1" }), {
			requestId: "req_first",
		});

		const accepted = await bulk.enqueue(
			{
				orders: [
					input({
						order_id: "BULK-IDEM-1",
						package: { ...input().package, sku: "OTHER" },
					}),
				],
			},
			{ requestId: "req_conflict" },
		);
		const completed = await drain(worker, bulk, accepted.batch_id);

		expect(completed.status).toBe("COMPLETED");
		expect(completed.failed).toBe(1);
		expect(completed.results[0]).toMatchObject({
			success: false,
			status: "FAILED",
			error: { code: "IDEMPOTENCY_CONFLICT" },
		});
	});
});

describe("BulkOrderService unknown-courier isolation", () => {
	it("does not persist a batch when validation fails", async () => {
		const { bulk } = createBulk();
		const error = await bulk
			.enqueue({ orders: [] }, { requestId: "req_empty" })
			.catch((caught: AppError) => caught);
		expect(error).toMatchObject({
			code: "VALIDATION_ERROR",
			details: [
				{
					field: "orders",
					message: "Array must contain between 1 and 100 elements",
				},
			],
		});
	});
});
