import { describe, expect, it } from "vitest";
import { batchResponseSchema, bulkAcceptedSchema } from "./batches";

describe("bulkAcceptedSchema", () => {
	it("accepts the documented 202 payload", () => {
		expect(
			bulkAcceptedSchema.parse({
				batch_id: "bch_01J5A8B3C4D5E6F7G8H9",
				accepted: 2,
				status: "QUEUED",
				poll_url: "/api/v1/batches/bch_01J5A8B3C4D5E6F7G8H9",
			}),
		).toMatchObject({ accepted: 2, status: "QUEUED" });
	});
});

describe("batchResponseSchema", () => {
	it("keeps results empty while processing", () => {
		expect(
			batchResponseSchema.parse({
				batch_id: "bch_01J5A8B3C4D5E6F7G8H9",
				status: "PROCESSING",
				total: 100,
				succeeded: 42,
				failed: 3,
				pending: 55,
				created_at: "2026-08-19T12:40:00.000Z",
				updated_at: "2026-08-19T12:40:30.000Z",
				completed_at: null,
				results: [],
			}),
		).toMatchObject({ status: "PROCESSING", results: [] });
	});

	it("accepts completed per-order results including failures", () => {
		const parsed = batchResponseSchema.parse({
			batch_id: "bch_01J5A8B3C4D5E6F7G8H9",
			status: "COMPLETED",
			total: 2,
			succeeded: 1,
			failed: 1,
			pending: 0,
			created_at: "2026-08-19T12:40:00.000Z",
			updated_at: "2026-08-19T12:41:15.000Z",
			completed_at: "2026-08-19T12:41:15.000Z",
			results: [
				{
					order_id: "BULK-001",
					position: 0,
					success: true,
					awb: "MOCK-BULK-001",
					status: "CREATED",
					error: null,
				},
				{
					order_id: "BULK-FAIL-1",
					position: 1,
					success: false,
					awb: null,
					status: "FAILED",
					error: {
						code: "COURIER_REJECTED",
						message: "Courier rejected the request",
					},
				},
			],
		});
		expect(parsed.results).toHaveLength(2);
		expect(parsed.results[1]?.success).toBe(false);
	});
});
