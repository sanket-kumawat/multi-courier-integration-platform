import type { CanonicalStatus } from "@multi-courier-integration-platform/couriers";
import type { PersistedOrder } from "../shared/order";

export type { PersistedOrder };

export type PersistedTrackingEvent = {
	id: string;
	orderId: string;
	status: CanonicalStatus;
	partnerStatus: string;
	description: string | null;
	location: string | null;
	occurredAt: Date;
};

export type NewTrackingEvent = {
	status: CanonicalStatus;
	partnerStatus: string;
	description: string;
	location: string | null;
	occurredAt: Date;
	raw: unknown;
};

export type ApplyTrackInput = {
	status: CanonicalStatus;
	events: NewTrackingEvent[];
	rawResponse: unknown;
	requestId: string;
	durationMs: number;
};

export type RecordTrackFailureInput = {
	errorCode: string;
	requestId: string;
	durationMs: number;
	httpStatus?: number;
};

export interface TrackingStore {
	findByOrderId(orderId: string): Promise<PersistedOrder | undefined>;
	listTrackingEvents(orderId: string): Promise<PersistedTrackingEvent[]>;
	applyTrack(
		id: string,
		input: ApplyTrackInput,
	): Promise<{ order: PersistedOrder; events: PersistedTrackingEvent[] }>;
	recordTrackFailure(id: string, input: RecordTrackFailureInput): Promise<void>;
}
