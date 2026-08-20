import type { CanonicalStatus } from "@multi-courier-integration-platform/couriers";

export const CANCELLABLE_STATUSES = ["PENDING", "CREATED", "FAILED"] as const;

export type CancellableStatus = (typeof CANCELLABLE_STATUSES)[number];

export function isCancellable(status: CanonicalStatus): boolean {
	return (CANCELLABLE_STATUSES as readonly string[]).includes(status);
}

export function cancellationNotAllowedMessage(status: CanonicalStatus): string {
	return `Cannot cancel order with status '${status}'. Cancellation is only allowed for PENDING, CREATED, or FAILED orders.`;
}
