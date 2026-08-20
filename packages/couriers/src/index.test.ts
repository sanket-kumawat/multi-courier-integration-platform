import { describe, expect, it } from "vitest";
import { registry } from "./index";

describe("built-in registry", () => {
	it("registers mock and urbanebolt adapters at module load", () => {
		expect(registry.list()).toEqual(["mock", "urbanebolt"]);
		expect(registry.get("mock").id).toBe("mock");
		expect(registry.get("urbanebolt").id).toBe("urbanebolt");
	});
});
