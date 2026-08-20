import type { CanonicalStatus } from "@multi-courier-integration-platform/couriers";

export type PersistedOrder = {
	id: string;
	orderId: string;
	courierPartner: string;
	courierShipmentId: string | null;
	awb: string | null;
	status: CanonicalStatus;
	payloadHash: string;
	createdAt: Date;
	updatedAt: Date;
};
