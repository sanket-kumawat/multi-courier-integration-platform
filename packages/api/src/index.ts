import { os } from "@orpc/server";

import type { Context } from "./context";
import { toORPCError } from "./errors";

export const o = os.$context<Context>();

export const publicProcedure = o.use(async ({ next, context }) => {
	try {
		return await next();
	} catch (error) {
		throw toORPCError(error, context.requestId);
	}
});
