import { describe, expect, it } from "vitest";
import { CourierRejectedError } from "../errors";
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
import {
	isAlreadyCancelled,
	mapRejectedMessage,
	parseAuthToken,
	parseManifestResult,
	parseTrackResult,
	throwIfRejected,
} from "./parse";

describe("parseAuthToken", () => {
	it("reads access_token and caps TTL", () => {
		const parsed = parseAuthToken(
			authToken,
			Date.parse("2026-08-20T12:00:00.000Z"),
			3300,
		);
		expect(parsed.accessToken).toBe("test-access-token");
		expect(parsed.expiresAtMs).toBeLessThan(
			Date.parse("2026-08-20T12:00:00.000Z") + 3300 * 1000,
		);
	});
});

describe("parseManifestResult", () => {
	it("parses AWB from successResponse[0]", () => {
		expect(parseManifestResult(manifestSuccess)).toEqual({
			awb: "200000001170",
			courierShipmentId: "OMS-2026-000142",
			partnerStatus: "Manifested",
		});
	});

	it("parses a top-level array body as element 0", () => {
		expect(
			parseManifestResult([
				{ awb: "A1", orderNumber: "O1", status: "Manifested" },
			]),
		).toMatchObject({ awb: "A1", courierShipmentId: "O1" });
	});

	it("rejects a success envelope with no AWB", () => {
		expect(() =>
			parseManifestResult({ successResponse: [{ orderNumber: "O1" }] }),
		).toThrow(CourierRejectedError);
	});
});

describe("parseTrackResult", () => {
	it("maps travelHistory into canonical events", () => {
		const parsed = parseTrackResult(
			trackHistory,
			new Date("2026-08-20T00:00:00.000Z"),
		);
		expect(parsed.partnerStatus).toBe("In Transit");
		expect(parsed.events).toHaveLength(2);
		expect(parsed.events[0]?.description).toBe("Shipment manifested");
		expect(parsed.events[1]?.location).toBe("BLR");
	});
});

describe("partner error mapping", () => {
	it("maps failedResponse to an allowlisted message", () => {
		expect(mapRejectedMessage(manifestFailed)).toBe("Pincode not serviceable");
		expect(() => throwIfRejected(200, manifestFailed)).toThrow(
			CourierRejectedError,
		);
		expect(mapRejectedMessage("<html>secret token</html>")).toBe(
			"Courier rejected the request",
		);
	});

	it("treats already-cancelled cancel payloads as success", () => {
		expect(isAlreadyCancelled(cancelSuccess)).toBe(false);
		expect(isAlreadyCancelled({ message: "Shipment already cancelled!" })).toBe(
			true,
		);
	});
});
