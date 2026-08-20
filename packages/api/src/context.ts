import type { CourierRegistry } from "@multi-courier-integration-platform/couriers";
import type { Request, Response } from "express";
import type { RequestLog } from "./observability";
import type { BulkOrderService } from "./services/bulk";
import type { CancelService } from "./services/cancel";
import type { OrderService } from "./services/orders";
import type { TrackingService } from "./services/tracking";

interface CreateContextOptions {
	req: Request;
	res?: Response;
	orderService?: OrderService;
	trackingService?: TrackingService;
	cancelService?: CancelService;
	bulkOrderService?: BulkOrderService;
	courierRegistry?: CourierRegistry;
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
	bulkOrderService,
	courierRegistry,
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
		log: readRequestLog(req),
		orderService,
		trackingService,
		cancelService,
		bulkOrderService,
		courierRegistry,
	};
}

function readRequestLog(req: Request): RequestLog | undefined {
	const log = (req as Request & { log?: RequestLog }).log;
	if (log && typeof log.set === "function") {
		return log;
	}
	return undefined;
}

export type Context = Awaited<ReturnType<typeof createContext>>;
