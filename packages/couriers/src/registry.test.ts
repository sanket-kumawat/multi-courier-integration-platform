import { describe, expect, it } from "vitest";
import type { CourierAdapter } from "./contract";
import { UnknownCourierError } from "./errors";
import { CourierRegistry } from "./registry";

function stubAdapter(id: string): CourierAdapter {
	return {
		id,
		createShipment: async () => {
			throw new Error("unused");
		},
		track: async () => {
			throw new Error("unused");
		},
		cancel: async () => {
			throw new Error("unused");
		},
		mapStatus: () => "IN_TRANSIT",
	};
}

describe("CourierRegistry", () => {
	it("returns registered adapters by id and lists them sorted", () => {
		const registry = new CourierRegistry();
		registry.register(stubAdapter("zeta"));
		registry.register(stubAdapter("mock"));

		expect(registry.list()).toEqual(["mock", "zeta"]);
		expect(registry.get("mock").id).toBe("mock");
		expect(registry.get("zeta").id).toBe("zeta");
	});

	it("throws UnknownCourierError for an unregistered partner before any courier I/O", () => {
		const registry = new CourierRegistry();
		registry.register(stubAdapter("mock"));

		try {
			registry.get("nope");
			expect.unreachable("expected UnknownCourierError");
		} catch (error) {
			expect(error).toBeInstanceOf(UnknownCourierError);
			const unknown = error as UnknownCourierError;
			expect(unknown.code).toBe("UNKNOWN_COURIER");
			expect(unknown.requested).toBe("nope");
			expect(unknown.available).toEqual(["mock"]);
			expect(unknown.message).toContain("nope");
		}
	});

	it("rejects duplicate registration of the same partner id", () => {
		const registry = new CourierRegistry();
		registry.register(stubAdapter("mock"));

		expect(() => registry.register(stubAdapter("mock"))).toThrow(
			/already registered/i,
		);
	});
});
