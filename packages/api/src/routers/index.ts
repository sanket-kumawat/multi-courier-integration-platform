import type { RouterClient } from "@orpc/server";

import { healthCheck } from "./health";
import { cancelOrder, createOrder, getOrder, trackOrder } from "./orders";

export const appRouter = {
	healthCheck,
	createOrder,
	getOrder,
	trackOrder,
	cancelOrder,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
