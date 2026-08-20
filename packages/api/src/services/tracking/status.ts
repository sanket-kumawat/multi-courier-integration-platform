import type { CanonicalStatus } from "@multi-courier-integration-platform/couriers";

const STATUS_RANK: Record<CanonicalStatus, number> = {
	PENDING: 0,
	FAILED: 0,
	CREATED: 1,
	PICKED_UP: 2,
	IN_TRANSIT: 3,
	OUT_FOR_DELIVERY: 4,
	DELIVERED: 5,
	CANCELLED: 6,
	RTO: 7,
};

export function nextCanonicalStatus(
	current: CanonicalStatus,
	incoming: CanonicalStatus,
): CanonicalStatus {
	if (incoming === current) {
		return current;
	}
	if (current === "DELIVERED" && incoming === "RTO") {
		return "RTO";
	}
	if (current === "DELIVERED" || current === "CANCELLED") {
		return current;
	}
	if (STATUS_RANK[incoming] < STATUS_RANK[current]) {
		return current;
	}
	return incoming;
}
