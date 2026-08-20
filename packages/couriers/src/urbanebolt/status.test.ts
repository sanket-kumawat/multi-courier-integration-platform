import { describe, expect, it } from "vitest";
import { mapUrbaneBoltStatus } from "./status";

describe("mapUrbaneBoltStatus", () => {
	it("maps observed partner strings onto the canonical enum", () => {
		expect(mapUrbaneBoltStatus("Delivered")).toBe("DELIVERED");
		expect(mapUrbaneBoltStatus("Out for delivery")).toBe("OUT_FOR_DELIVERY");
		expect(mapUrbaneBoltStatus("OFD")).toBe("OUT_FOR_DELIVERY");
		expect(mapUrbaneBoltStatus("Shipment already cancelled!")).toBe(
			"CANCELLED",
		);
		expect(mapUrbaneBoltStatus("Picked up")).toBe("PICKED_UP");
		expect(mapUrbaneBoltStatus("RTO Lock already applied!")).toBe("RTO");
		expect(mapUrbaneBoltStatus("Shipment already in closed stage!")).toBe(
			"DELIVERED",
		);
		expect(mapUrbaneBoltStatus("Manifested")).toBe("CREATED");
		expect(mapUrbaneBoltStatus("Reached hub", { hasHistory: true })).toBe(
			"IN_TRANSIT",
		);
	});
});
