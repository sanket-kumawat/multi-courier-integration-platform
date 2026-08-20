import { call, ORPCError, ValidationError } from "@orpc/server";
import { describe, expect, it } from "vitest";
import {
	APP_ERROR_HTTP_STATUS,
	AppError,
	detailsFromValidationIssues,
	encodeErrorEnvelope,
	toORPCError,
} from "./errors";
import { publicProcedure } from "./index";

describe("AppError", () => {
	it("maps each public code to the documented HTTP status", () => {
		expect(new AppError("VALIDATION_ERROR", "bad").httpStatus).toBe(400);
		expect(new AppError("UNKNOWN_COURIER", "nope").httpStatus).toBe(400);
		expect(new AppError("UNSUPPORTED_SERVICE", "nope").httpStatus).toBe(400);
		expect(new AppError("ORDER_NOT_FOUND", "missing").httpStatus).toBe(404);
		expect(new AppError("IDEMPOTENCY_CONFLICT", "conflict").httpStatus).toBe(
			409,
		);
		expect(new AppError("CANCELLATION_NOT_ALLOWED", "late").httpStatus).toBe(
			409,
		);
		expect(new AppError("COURIER_REJECTED", "pin").httpStatus).toBe(422);
		expect(new AppError("COURIER_AUTH_FAILED", "auth").httpStatus).toBe(502);
		expect(new AppError("COURIER_UNAVAILABLE", "down").httpStatus).toBe(502);
		expect(new AppError("INTERNAL_ERROR", "bug").httpStatus).toBe(500);
		expect(APP_ERROR_HTTP_STATUS.ORDER_NOT_FOUND).toBe(404);
	});
});

describe("detailsFromValidationIssues", () => {
	it("formats nested and indexed paths as documented field names", () => {
		expect(
			detailsFromValidationIssues([
				{
					path: ["consignee", "pincode"],
					message: "Must be a 6-digit Indian pincode",
				},
				{ path: ["orders", 2, "courier_partner"], message: "Required" },
				{ path: [], message: "Invalid" },
			]),
		).toEqual([
			{
				field: "consignee.pincode",
				message: "Must be a 6-digit Indian pincode",
			},
			{ field: "orders[2].courier_partner", message: "Required" },
			{ field: "", message: "Invalid" },
		]);
	});
});

describe("toORPCError", () => {
	it("converts AppError into the public envelope payload", () => {
		const error = toORPCError(
			new AppError("ORDER_NOT_FOUND", "Order 'OMS-1' not found"),
			"req_test",
		);

		expect(error.code).toBe("ORDER_NOT_FOUND");
		expect(error.status).toBe(404);
		expect(error.message).toBe("Order 'OMS-1' not found");
		expect(error.data).toEqual({ request_id: "req_test", details: [] });
	});

	it("maps oRPC Zod validation failures to VALIDATION_ERROR", () => {
		const error = toORPCError(
			new ORPCError("BAD_REQUEST", {
				cause: new ValidationError({
					message: "Input validation failed",
					issues: [
						{
							path: ["package", "weight_kg"],
							message: "Must be a positive number",
						},
					],
				}),
			}),
			"req_test",
		);

		expect(error.code).toBe("VALIDATION_ERROR");
		expect(error.status).toBe(400);
		expect(error.message).toBe("Request validation failed");
		expect(error.data).toEqual({
			request_id: "req_test",
			details: [
				{ field: "package.weight_kg", message: "Must be a positive number" },
			],
		});
	});

	it("does not leak unexpected error messages to clients", () => {
		const error = toORPCError(
			new Error("Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 leaked"),
			"req_test",
		);

		expect(error.code).toBe("INTERNAL_ERROR");
		expect(error.status).toBe(500);
		expect(error.message).toBe("An unexpected error occurred");
		expect(error.data).toEqual({ request_id: "req_test", details: [] });
		expect(JSON.stringify(error.data)).not.toContain("Bearer");
	});
});

describe("publicProcedure error middleware", () => {
	it("maps thrown AppError to an ORPCError with the documented status", async () => {
		const failing = publicProcedure.handler(() => {
			throw new AppError("ORDER_NOT_FOUND", "Order 'OMS-1' not found");
		});

		await expect(
			call(failing, undefined, {
				context: {
					auth: null,
					session: null,
					requestId: "req_test",
					orderService: undefined,
					trackingService: undefined,
					cancelService: undefined,
					bulkOrderService: undefined,
				},
			}),
		).rejects.toMatchObject({
			code: "ORDER_NOT_FOUND",
			status: 404,
			message: "Order 'OMS-1' not found",
			data: { request_id: "req_test", details: [] },
		});
	});
});

describe("encodeErrorEnvelope", () => {
	it("returns the documented REST error envelope", () => {
		const error = toORPCError(
			new AppError(
				"UNKNOWN_COURIER",
				"Courier partner 'fastship' is not supported",
				[
					{
						field: "courier_partner",
						message: "Supported couriers: urbanebolt, mock",
					},
				],
			),
			"req_01J5A8B3C4D5E6F7G8H9",
		);

		expect(encodeErrorEnvelope(error)).toEqual({
			error: {
				code: "UNKNOWN_COURIER",
				message: "Courier partner 'fastship' is not supported",
				request_id: "req_01J5A8B3C4D5E6F7G8H9",
				details: [
					{
						field: "courier_partner",
						message: "Supported couriers: urbanebolt, mock",
					},
				],
			},
		});
	});

	it("sanitizes unknown oRPC codes instead of forwarding them", () => {
		const envelope = encodeErrorEnvelope(
			new ORPCError("SOME_INTERNAL_CODE", {
				message: "stack trace here",
				data: { request_id: "req_test" },
			}),
		);

		expect(envelope).toEqual({
			error: {
				code: "INTERNAL_ERROR",
				message: "An unexpected error occurred",
				request_id: "req_test",
				details: [],
			},
		});
	});
});
