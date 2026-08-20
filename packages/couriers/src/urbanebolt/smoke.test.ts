import { describe, expect, it } from "vitest";

/**
 * Manual UAT smoke — not run in CI.
 * URBANEBOLT_SMOKE=1 URBANEBOLT_USERNAME=… URBANEBOLT_PASSWORD=… URBANEBOLT_CUSTOMER_CODE=… pnpm test
 */
describe.skipIf(process.env.URBANEBOLT_SMOKE !== "1")(
	"UrbaneBolt UAT smoke",
	() => {
		it("authenticates against UAT", async () => {
			const { UrbaneBoltAdapter } = await import("./adapter");
			const adapter = new UrbaneBoltAdapter();
			await expect(
				adapter.track({ awb: "0" }, { requestId: "smoke", orderId: "smoke" }),
			).resolves.toBeDefined();
		});
	},
);
