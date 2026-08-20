import type { PersistedOrder } from "../shared/order";

export type ApplyCancelInput = {
	cancelledAt: Date;
	partnerStatus: string;
	rawRequest?: unknown;
	rawResponse?: unknown;
	requestId: string;
	durationMs: number;
	calledCourier: boolean;
};

export interface CancelStore {
	findByOrderId(orderId: string): Promise<PersistedOrder | undefined>;
	cancelledAt(id: string): Promise<Date | undefined>;
	applyCancel(
		id: string,
		input: ApplyCancelInput,
	): Promise<{ order: PersistedOrder; cancelledAt: Date }>;
}
