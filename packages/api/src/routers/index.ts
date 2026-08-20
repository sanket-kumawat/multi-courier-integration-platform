import type { RouterClient } from "@orpc/server";

import { healthCheck } from "./health";
import { createOrder, getOrder, trackOrder } from "./orders";

export const appRouter = {
	healthCheck,
	createOrder,
	getOrder,
	trackOrder,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
