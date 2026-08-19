import { call } from "@orpc/server";
import { describe, expect, it } from "vitest";

import { appRouter } from "./index";

describe("healthCheck", () => {
	it("returns OK", async () => {
		await expect(
			call(appRouter.healthCheck, undefined, {
				context: { auth: null, session: null },
			}),
		).resolves.toBe("OK");
	});
});
