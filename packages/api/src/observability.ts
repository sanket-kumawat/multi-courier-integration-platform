import type { AdapterLogger } from "@multi-courier-integration-platform/couriers";

export const WIDE_EVENTS = {
	ORDER_CREATE: "order.create",
	ORDER_TRACK: "order.track",
	ORDER_CANCEL: "order.cancel",
	ORDER_BULK_ACCEPT: "order.bulk.accept",
	COURIER_HTTP: "courier.http",
} as const;

export type RequestLog = {
	set(fields: Record<string, unknown>): void;
	error(error?: unknown, fields?: Record<string, unknown>): void;
};

export function adapterLoggerFrom(
	log: RequestLog | undefined,
): AdapterLogger | undefined {
	if (!log) {
		return undefined;
	}
	return {
		info(message, fields) {
			log.set({ event: message, ...fields });
		},
		warn(message, fields) {
			log.set({ event: message, level: "warn", ...fields });
		},
		error(message, fields) {
			log.error(undefined, { event: message, ...fields });
		},
	};
}
