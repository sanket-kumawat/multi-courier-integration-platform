import type { CanonicalStatus } from "@multi-courier-integration-platform/couriers";
import type { CreateOrderInput } from "../../dto/orders";
import type { PersistedOrder } from "../shared/order";

export type { PersistedOrder };

export type InsertPendingInput = {
	order: CreateOrderInput;
	payloadHash: string;
	batchId?: string;
};

export type MarkCreatedInput = {
	awb: string;
	courierShipmentId: string;
	status: CanonicalStatus;
	partnerStatus: string;
	rawRequest: unknown;
	rawResponse: unknown;
	requestId: string;
	durationMs: number;
};

export type MarkFailedInput = {
	errorCode: string;
	rawRequest?: unknown;
	rawResponse?: unknown;
	requestId: string;
	durationMs: number;
	httpStatus?: number;
};

export interface OrderStore {
	insertPending(input: InsertPendingInput): Promise<{
		order: PersistedOrder;
		inserted: boolean;
	}>;
	findByOrderId(orderId: string): Promise<PersistedOrder | undefined>;
	markCreated(id: string, input: MarkCreatedInput): Promise<PersistedOrder>;
	markFailed(id: string, input: MarkFailedInput): Promise<PersistedOrder>;
}
