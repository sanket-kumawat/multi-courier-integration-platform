import type { RouterClient } from "@orpc/server";

import { healthCheck } from "./health";

export const appRouter = {
	healthCheck,
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
