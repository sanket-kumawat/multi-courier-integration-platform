import { z } from "zod";
import { ORDER_STATUSES } from "./orders";

export const BATCH_STATUSES = [
	"QUEUED",
	"PROCESSING",
	"COMPLETED",
	"FAILED",
] as const;

export const getBatchInputSchema = z.object({
	batch_id: z.string().min(1),
});

export const bulkAcceptedSchema = z.object({
	batch_id: z.string(),
	accepted: z.number().int(),
	status: z.literal("QUEUED"),
	poll_url: z.string(),
});

export const batchResultErrorSchema = z.object({
	code: z.string(),
	message: z.string(),
});

export const batchResultSchema = z.object({
	order_id: z.string(),
	position: z.number().int().nonnegative(),
	success: z.boolean(),
	awb: z.string().nullable(),
	status: z.enum(ORDER_STATUSES),
	error: batchResultErrorSchema.nullable(),
});

export const batchResponseSchema = z.object({
	batch_id: z.string(),
	status: z.enum(BATCH_STATUSES),
	total: z.number().int(),
	succeeded: z.number().int(),
	failed: z.number().int(),
	pending: z.number().int(),
	created_at: z.string(),
	updated_at: z.string(),
	completed_at: z.string().nullable(),
	results: z.array(batchResultSchema),
});

export type BulkAccepted = z.infer<typeof bulkAcceptedSchema>;
export type BatchResponse = z.infer<typeof batchResponseSchema>;
export type BatchResult = z.infer<typeof batchResultSchema>;
