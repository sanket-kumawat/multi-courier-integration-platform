import {
	CourierRegistry,
	MockCourierAdapter,
} from "@multi-courier-integration-platform/couriers";
import { call } from "@orpc/server";
import { describe, expect, it } from "vitest";
import { appRouter } from "./index";

describe("listCouriers", () => {
	it("returns the injected registry ids in sorted order", async () => {
		const courierRegistry = new CourierRegistry();
		courierRegistry.register(new MockCourierAdapter());

		const result = await call(appRouter.listCouriers, undefined, {
			context: {
				auth: null,
				session: null,
				requestId: "req_test",
				orderService: undefined,
				trackingService: undefined,
				cancelService: undefined,
				bulkOrderService: undefined,
				log: undefined,
				courierRegistry,
			},
		});

		expect(result).toEqual({ couriers: ["mock"] });
	});
});
