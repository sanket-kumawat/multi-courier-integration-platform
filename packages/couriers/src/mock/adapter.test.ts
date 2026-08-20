import { describe, expect, it } from "vitest";
import type { AdapterContext, CreateShipmentInput } from "../contract";
import { CourierRejectedError } from "../errors";
import { MockCourierAdapter } from "./adapter";

function testContext(orderId: string): AdapterContext {
	return { requestId: "req_test", orderId };
}

function sampleInput(
	orderId: string,
	overrides: Partial<CreateShipmentInput> = {},
): CreateShipmentInput {
	return {
		orderId,
		serviceType: "NDD",
		payment: {
			mode: "PREPAID",
			declaredValue: 1299,
			collectableValue: 0,
			invoiceNumber: "INV-1",
			invoiceDate: "2026-08-19",
			invoiceValue: 1299,
		},
		pkg: {
			description: "Books",
			quantity: 1,
			pieces: 1,
			weightKg: 1.1,
			lengthCm: 12,
			breadthCm: 10,
			heightCm: 10,
		},
		shipper: {
			name: "Seller",
			phone: "9999999999",
			email: "s@example.com",
			addressLine1: "1 Main",
			addressType: "Seller",
			city: "Bengaluru",
			state: "KA",
			pincode: "560001",
			country: "IN",
		},
		consignee: {
			name: "Buyer",
			phone: "8888888888",
			email: "b@example.com",
			addressLine1: "2 Main",
			addressType: "Home",
			city: "Bengaluru",
			state: "KA",
			pincode: "560002",
			country: "IN",
		},
		returnAddress: {
			name: "Seller",
			phone: "9999999999",
			email: "s@example.com",
			addressLine1: "1 Main",
			addressType: "Seller",
			city: "Bengaluru",
			state: "KA",
			pincode: "560001",
			country: "IN",
		},
		...overrides,
	};
}

describe("MockCourierAdapter", () => {
	it("identifies as mock and creates a deterministic AWB without network I/O", async () => {
		const adapter = new MockCourierAdapter();
		const input = sampleInput("OMS-142");

		const result = await adapter.createShipment(
			input,
			testContext(input.orderId),
		);

		expect(adapter.id).toBe("mock");
		expect(result.awb).toBe("MOCK-OMS-142");
		expect(result.courierShipmentId).toBe("MOCK-SHIP-OMS-142");
		expect(result.partnerStatus).toBe("CREATED");
		expect(result.rawRequest).toEqual(input);
	});

	it("rejects create when orderId contains FAIL", async () => {
		const adapter = new MockCourierAdapter();
		const input = sampleInput("OMS-FAIL-9");

		await expect(
			adapter.createShipment(input, testContext(input.orderId)),
		).rejects.toMatchObject({
			name: "CourierRejectedError",
			code: "COURIER_REJECTED",
		});
		await expect(
			adapter.createShipment(input, testContext(input.orderId)),
		).rejects.toBeInstanceOf(CourierRejectedError);
	});

	it("throws CourierUnavailableError on track when orderId contains UNAVAILABLE", async () => {
		const adapter = new MockCourierAdapter();
		const input = sampleInput("OMS-UNAVAILABLE-1");
		const created = await adapter.createShipment(
			input,
			testContext(input.orderId),
		);

		await expect(
			adapter.track({ awb: created.awb }, testContext(input.orderId)),
		).rejects.toMatchObject({
			name: "CourierUnavailableError",
			code: "COURIER_UNAVAILABLE",
		});
	});

	it("cycles track CREATED → IN_TRANSIT → DELIVERED from elapsed time since create", async () => {
		let nowMs = Date.parse("2026-08-19T12:00:00.000Z");
		const adapter = new MockCourierAdapter({
			now: () => new Date(nowMs),
			phaseDurationMs: 60_000,
		});
		const input = sampleInput("OMS-TRACK");
		const created = await adapter.createShipment(
			input,
			testContext(input.orderId),
		);
		const ctx = testContext(input.orderId);

		const createdTrack = await adapter.track({ awb: created.awb }, ctx);
		expect(createdTrack.partnerStatus).toBe("CREATED");
		expect(adapter.mapStatus(createdTrack.partnerStatus)).toBe("CREATED");

		nowMs += 60_000;
		const transit = await adapter.track({ awb: created.awb }, ctx);
		expect(transit.partnerStatus).toBe("IN_TRANSIT");
		expect(adapter.mapStatus(transit.partnerStatus)).toBe("IN_TRANSIT");

		nowMs += 60_000;
		const delivered = await adapter.track({ awb: created.awb }, ctx);
		expect(delivered.partnerStatus).toBe("DELIVERED");
		expect(adapter.mapStatus(delivered.partnerStatus)).toBe("DELIVERED");
		expect(delivered.events.length).toBeGreaterThanOrEqual(1);
	});

	it("cancels a created shipment and refuses cancel after delivery", async () => {
		let nowMs = Date.parse("2026-08-19T12:00:00.000Z");
		const adapter = new MockCourierAdapter({
			now: () => new Date(nowMs),
			phaseDurationMs: 60_000,
		});
		const input = sampleInput("OMS-CANCEL");
		const created = await adapter.createShipment(
			input,
			testContext(input.orderId),
		);
		const ctx = testContext(input.orderId);

		await expect(
			adapter.cancel({ awb: created.awb }, ctx),
		).resolves.toMatchObject({
			rawRequest: { awb: created.awb },
		});

		const cancelledTrack = await adapter.track({ awb: created.awb }, ctx);
		expect(cancelledTrack.partnerStatus).toBe("CANCELLED");
		expect(adapter.mapStatus("CANCELLED")).toBe("CANCELLED");

		const deliveredInput = sampleInput("OMS-DELIVERED");
		const delivered = await adapter.createShipment(
			deliveredInput,
			testContext(deliveredInput.orderId),
		);
		nowMs += 120_000;

		await expect(
			adapter.cancel(
				{ awb: delivered.awb },
				testContext(deliveredInput.orderId),
			),
		).rejects.toMatchObject({
			code: "COURIER_REJECTED",
			message: "Cancellation window closed",
		});
	});

	it("maps unknown partner status strings to IN_TRANSIT", () => {
		const adapter = new MockCourierAdapter();
		expect(adapter.mapStatus("Reached hub")).toBe("IN_TRANSIT");
	});
});
