import type { Request, Response } from "express";
import type { CancelService } from "./services/cancel";
import type { OrderService } from "./services/orders";
import type { TrackingService } from "./services/tracking";

interface CreateContextOptions {
	req: Request;
	res?: Response;
	orderService?: OrderService;
	trackingService?: TrackingService;
	cancelService?: CancelService;
}

export function resolveRequestId(req: Request): string {
	const fromHeader = req.header("x-request-id")?.trim();
	if (fromHeader) {
		return fromHeader;
	}
	return crypto.randomUUID();
}

export async function createContext({
	req,
	res,
	orderService,
	trackingService,
	cancelService,
}: CreateContextOptions) {
	const fromLocals = res?.locals.requestId;
	const requestId =
		typeof fromLocals === "string" && fromLocals.length > 0
			? fromLocals
			: resolveRequestId(req);

	return {
		auth: null,
		session: null,
		requestId,
		orderService,
		trackingService,
		cancelService,
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
