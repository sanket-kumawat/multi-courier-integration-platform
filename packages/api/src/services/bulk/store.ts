import type { CanonicalStatus } from "@multi-courier-integration-platform/couriers";
import type { CreateOrderInput } from "../../dto/orders";

export const BATCH_STATUSES = [
	"QUEUED",
	"PROCESSING",
	"COMPLETED",
	"FAILED",
] as const;

export type BatchStatus = (typeof BATCH_STATUSES)[number];

export const BATCH_ITEM_STATUSES = [
	"QUEUED",
	"PROCESSING",
	"SUCCEEDED",
	"FAILED",
] as const;

export type BatchItemStatus = (typeof BATCH_ITEM_STATUSES)[number];

export type PersistedBatch = {
	id: string;
	status: BatchStatus;
	total: number;
	succeeded: number;
	failed: number;
	createdAt: Date;
	updatedAt: Date;
	completedAt: Date | null;
};

export type PersistedBatchItem = {
	id: string;
	batchId: string;
	orderId: string;
	position: number;
	status: BatchItemStatus;
	errorCode: string | null;
	errorMessage: string | null;
	orderUuid: string | null;
	claimedAt: Date | null;
	awb: string | null;
	orderStatus: CanonicalStatus | null;
};

export type EnqueueBulkInput = {
	orders: Array<{
		order: CreateOrderInput;
		payloadHash: string;
	}>;
};

export type ClaimedBatchItem = {
	id: string;
	batchId: string;
	orderId: string;
	position: number;
	payload: CreateOrderInput;
};

export type CompleteItemInput =
	| { success: true }
	| { success: false; errorCode: string; errorMessage: string };

export type BatchSnapshot = {
	batch: PersistedBatch;
	items: PersistedBatchItem[];
};

export interface BulkStore {
	enqueue(input: EnqueueBulkInput): Promise<PersistedBatch>;
	getBatch(batchId: string): Promise<BatchSnapshot | undefined>;
	reclaimStale(staleMs: number): Promise<number>;
	claimQueued(limit: number): Promise<ClaimedBatchItem[]>;
	completeItem(itemId: string, input: CompleteItemInput): Promise<void>;
}
