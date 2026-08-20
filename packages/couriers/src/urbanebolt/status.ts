import type { CanonicalStatus } from "../contract";

export function mapUrbaneBoltStatus(
	partnerStatus: string,
	options: { hasHistory?: boolean } = {},
): CanonicalStatus {
	const value = partnerStatus.toLowerCase();

	if (value.includes("out for delivery") || /\bofd\b/.test(value)) {
		return "OUT_FOR_DELIVERY";
	}
	if (value.includes("delivered")) {
		return "DELIVERED";
	}
	if (value.includes("rto")) {
		return "RTO";
	}
	if (value.includes("cancel")) {
		return "CANCELLED";
	}
	if (value.includes("pick")) {
		return "PICKED_UP";
	}
	if (value.includes("closed stage")) {
		return "DELIVERED";
	}
	if (options.hasHistory) {
		return "IN_TRANSIT";
	}
	if (
		value.includes("manifest") ||
		value.includes("created") ||
		value.length === 0
	) {
		return "CREATED";
	}
	return "IN_TRANSIT";
}
