import type { RouterClient } from "@orpc/server";

import { getBatch } from "./batches";
import { healthCheck } from "./health";
import {
	cancelOrder,
	createBulkOrders,
	createOrder,
	getOrder,
	trackOrder,
} from "./orders";

export const appRouter = {
	healthCheck,
	createOrder,
	createBulkOrders,
	getOrder,
	trackOrder,
	cancelOrder,
	getBatch,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
