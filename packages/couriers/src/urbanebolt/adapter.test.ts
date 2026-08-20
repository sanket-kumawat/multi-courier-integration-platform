import { describe, expect, it, vi } from "vitest";
import type { AdapterContext, CreateShipmentInput } from "../contract";
import { CourierAuthFailedError, CourierUnavailableError } from "../errors";
import { UrbaneBoltAdapter } from "./adapter";
import authToken from "./fixtures/auth-token.json" with { type: "json" };
import cancelSuccess from "./fixtures/cancel-success.json" with {
	type: "json",
};
import manifestFailed from "./fixtures/manifest-failed.json" with {
	type: "json",
};
import manifestSuccess from "./fixtures/manifest-success.json" with {
	type: "json",
};
import trackHistory from "./fixtures/track-history.json" with { type: "json" };

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function sampleInput(): CreateShipmentInput {
	return {
		orderId: "OMS-2026-000142",
		serviceType: "NDD",
		payment: {
			mode: "COD",
			declaredValue: 1299,
			collectableValue: 1299,
			invoiceNumber: "INV-8891",
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
			phone: "9425018023",
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
			phone: "8320226438",
			email: "b@example.com",
			addressLine1: "2 Main",
			addressType: "Home",
			city: "Surat",
			state: "GJ",
			pincode: "395007",
			country: "IN",
		},
		returnAddress: {
			name: "Seller",
			phone: "9425018023",
			email: "s@example.com",
			addressLine1: "1 Main",
			addressType: "Seller",
			city: "Bengaluru",
			state: "KA",
			pincode: "560001",
			country: "IN",
		},
	};
}

const ctx: AdapterContext = {
	requestId: "req_test",
	orderId: "OMS-2026-000142",
};

function createAdapter(fetchMock: typeof fetch) {
	return new UrbaneBoltAdapter({
		baseUrl: "https://uat.urbanebolt.in",
		username: "user",
		password: "pass",
		customerCode: "CUST-1",
		fetch: fetchMock,
		sleep: async () => undefined,
		retryAttempts: 3,
		retryBaseMs: 1,
		retryMaxMs: 1,
		now: () => new Date("2026-08-20T12:00:00.000Z"),
	});
}

function routeFetch(handlers: {
	token?: () => Response;
	manifest?: () => Response;
	track?: () => Response;
	cancel?: () => Response;
}): typeof fetch {
	return vi.fn<typeof fetch>(async (input) => {
		const url = String(input);
		if (url.includes("/auth/getToken/")) {
			return (handlers.token ?? (() => jsonResponse(200, authToken)))();
		}
		if (url.includes("/services/manifest/")) {
			return (
				handlers.manifest ?? (() => jsonResponse(200, manifestSuccess))
			)();
		}
		if (url.includes("/services/tracking-pub/")) {
			return (handlers.track ?? (() => jsonResponse(200, trackHistory)))();
		}
		if (url.includes("/services/cancel/")) {
			return (handlers.cancel ?? (() => jsonResponse(200, cancelSuccess)))();
		}
		return jsonResponse(404, { message: "not found" });
	});
}

describe("UrbaneBoltAdapter", () => {
	it("authenticates once then creates a shipment from the manifest envelope", async () => {
		const fetchMock = routeFetch({});
		const adapter = createAdapter(fetchMock);
		const result = await adapter.createShipment(sampleInput(), ctx);

		expect(adapter.id).toBe("urbanebolt");
		expect(result.awb).toBe("200000001170");
		expect(result.courierShipmentId).toBe("OMS-2026-000142");
		expect(result.partnerStatus).toBe("Manifested");
		expect(JSON.stringify(result.rawRequest)).not.toContain(
			"test-access-token",
		);
		expect(fetchMock).toHaveBeenCalledTimes(2);

		await adapter.createShipment(sampleInput(), ctx);
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("refreshes the token on 401 and retries the original request once", async () => {
		let manifestCalls = 0;
		const fetchMock = routeFetch({
			manifest: () => {
				manifestCalls += 1;
				if (manifestCalls === 1) {
					return jsonResponse(401, { message: "expired" });
				}
				return jsonResponse(200, manifestSuccess);
			},
		});
		const adapter = createAdapter(fetchMock);
		const result = await adapter.createShipment(sampleInput(), ctx);

		expect(result.awb).toBe("200000001170");
		expect(fetchMock).toHaveBeenCalledTimes(4);
	});

	it("throws CourierAuthFailedError when 401 persists after refresh", async () => {
		const fetchMock = routeFetch({
			manifest: () => jsonResponse(401, { message: "denied" }),
		});
		const adapter = createAdapter(fetchMock);

		await expect(
			adapter.createShipment(sampleInput(), ctx),
		).rejects.toBeInstanceOf(CourierAuthFailedError);
	});

	it("maps partner 4xx to COURIER_REJECTED without leaking raw bodies", async () => {
		const fetchMock = routeFetch({
			manifest: () =>
				jsonResponse(422, {
					message: "<html>token=secret</html> pincode not serviceable",
				}),
		});
		const adapter = createAdapter(fetchMock);

		await expect(
			adapter.createShipment(sampleInput(), ctx),
		).rejects.toMatchObject({
			code: "COURIER_REJECTED",
			message: "Pincode not serviceable",
		});
	});

	it("maps HTTP 200 failedResponse to COURIER_REJECTED", async () => {
		const fetchMock = routeFetch({
			manifest: () => jsonResponse(200, manifestFailed),
		});
		const adapter = createAdapter(fetchMock);

		await expect(
			adapter.createShipment(sampleInput(), ctx),
		).rejects.toMatchObject({
			code: "COURIER_REJECTED",
			message: "Pincode not serviceable",
		});
	});

	it("retries 5xx then fails with CourierUnavailableError", async () => {
		const fetchMock = routeFetch({
			manifest: () => jsonResponse(502, { error: "bad gateway" }),
		});
		const adapter = createAdapter(fetchMock);

		await expect(
			adapter.createShipment(sampleInput(), ctx),
		).rejects.toBeInstanceOf(CourierUnavailableError);
		expect(fetchMock).toHaveBeenCalledTimes(4);
	});

	it("tracks using the public awb query and maps history", async () => {
		const fetchMock = routeFetch({});
		const adapter = createAdapter(fetchMock);
		const result = await adapter.track({ awb: "200000001170" }, ctx);

		expect(result.partnerStatus).toBe("In Transit");
		expect(result.events.length).toBeGreaterThanOrEqual(2);
		expect(adapter.mapStatus(result.partnerStatus)).toBe("IN_TRANSIT");
		const trackCall = vi
			.mocked(fetchMock)
			.mock.calls.find(([url]) => String(url).includes("tracking-pub"));
		expect(String(trackCall?.[0])).toContain("awb=200000001170");
	});

	it("cancels with { awbs } and treats already-cancelled as success", async () => {
		const fetchMock = routeFetch({
			cancel: () =>
				jsonResponse(200, { message: "Shipment already cancelled!" }),
		});
		const adapter = createAdapter(fetchMock);
		const result = await adapter.cancel({ awb: "200000001170" }, ctx);

		expect(result.rawResponse).toBeDefined();
		const cancelCall = vi
			.mocked(fetchMock)
			.mock.calls.find(([url]) => String(url).includes("/cancel/"));
		expect(JSON.parse(String(cancelCall?.[1]?.body))).toEqual({
			awbs: "200000001170",
		});
	});

	it("fails fast when credentials are missing", async () => {
		const fetchMock = routeFetch({});
		const adapter = new UrbaneBoltAdapter({
			fetch: fetchMock,
			sleep: async () => undefined,
		});

		await expect(
			adapter.createShipment(sampleInput(), ctx),
		).rejects.toBeInstanceOf(CourierAuthFailedError);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
