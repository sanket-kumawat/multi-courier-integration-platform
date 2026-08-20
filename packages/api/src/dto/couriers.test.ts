import { describe, expect, it } from "vitest";
import { listCouriersResponseSchema } from "./couriers";

describe("listCouriersResponseSchema", () => {
	it("accepts the documented courier list", () => {
		expect(
			listCouriersResponseSchema.parse({
				couriers: ["mock", "urbanebolt"],
			}),
		).toEqual({ couriers: ["mock", "urbanebolt"] });
	});
});
