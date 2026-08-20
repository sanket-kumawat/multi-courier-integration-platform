import { describe, expect, it } from "vitest";
import { cancellationNotAllowedMessage, isCancellable } from "./guards";

describe("cancel guards", () => {
	it("allows PENDING, CREATED, and FAILED", () => {
		expect(isCancellable("PENDING")).toBe(true);
		expect(isCancellable("CREATED")).toBe(true);
		expect(isCancellable("FAILED")).toBe(true);
	});

	it("blocks picked-up and later statuses", () => {
		expect(isCancellable("PICKED_UP")).toBe(false);
		expect(isCancellable("IN_TRANSIT")).toBe(false);
		expect(isCancellable("OUT_FOR_DELIVERY")).toBe(false);
		expect(isCancellable("DELIVERED")).toBe(false);
		expect(isCancellable("RTO")).toBe(false);
		expect(isCancellable("CANCELLED")).toBe(false);
		expect(cancellationNotAllowedMessage("PICKED_UP")).toContain("PICKED_UP");
	});
});
