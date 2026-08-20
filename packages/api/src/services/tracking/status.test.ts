import { describe, expect, it } from "vitest";
import { nextCanonicalStatus } from "./status";

describe("nextCanonicalStatus", () => {
	it("maps forward through the canonical enum and blocks regressions", () => {
		expect(nextCanonicalStatus("CREATED", "IN_TRANSIT")).toBe("IN_TRANSIT");
		expect(nextCanonicalStatus("IN_TRANSIT", "CREATED")).toBe("IN_TRANSIT");
		expect(nextCanonicalStatus("DELIVERED", "IN_TRANSIT")).toBe("DELIVERED");
		expect(nextCanonicalStatus("DELIVERED", "RTO")).toBe("RTO");
		expect(nextCanonicalStatus("CANCELLED", "IN_TRANSIT")).toBe("CANCELLED");
	});
});
