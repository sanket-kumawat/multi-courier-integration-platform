import { call } from "@orpc/server";
import { describe, expect, it } from "vitest";

import { appRouter } from "./index";

const testContext = {
	auth: null,
	session: null,
	requestId: "req_test",
};

describe("healthCheck", () => {
	it("returns the documented liveness payload", async () => {
		const result = await call(appRouter.healthCheck, undefined, {
			context: testContext,
		});

		expect(result.status).toBe("ok");
		expect(result.timestamp).toEqual(expect.any(String));
		expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
	});
});
