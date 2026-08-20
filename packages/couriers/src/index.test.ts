import { describe, expect, it } from "vitest";
import { registry } from "./index";

describe("built-in registry", () => {
	it("registers the mock adapter at module load", () => {
		expect(registry.list()).toEqual(["mock"]);
		expect(registry.get("mock").id).toBe("mock");
	});
});
