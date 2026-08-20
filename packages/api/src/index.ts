import { os } from "@orpc/server";

import type { Context } from "./context";
import { toORPCError } from "./errors";

export const o = os.$context<Context>();

export const publicProcedure = o.use(async ({ next, context }) => {
	context.log?.set({ request_id: context.requestId });
	try {
		return await next();
	} catch (error) {
		const mapped = toORPCError(error, context.requestId);
		context.log?.set({
			error_type: mapped.code,
			code: mapped.code,
		});
		if (mapped.code === "INTERNAL_ERROR") {
			context.log?.error(error, {
				request_id: context.requestId,
				code: "INTERNAL_ERROR",
			});
		}
		throw mapped;
	}
});
