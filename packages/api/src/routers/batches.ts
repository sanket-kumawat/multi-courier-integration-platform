import { batchResponseSchema, getBatchInputSchema } from "../dto/batches";
import { AppError } from "../errors";
import { publicProcedure } from "../index";
import type { BulkOrderService } from "../services/bulk";

function requireBulkOrderService(
	bulkOrderService: BulkOrderService | undefined,
): BulkOrderService {
	if (!bulkOrderService) {
		throw new AppError("INTERNAL_ERROR", "An unexpected error occurred");
	}
	return bulkOrderService;
}

export const getBatch = publicProcedure
	.route({
		method: "GET",
		path: "/batches/{batch_id}",
		summary: "Get batch status",
		description:
			"Poll bulk-create progress. results is empty until the batch is COMPLETED.",
		tags: ["batches"],
		successDescription: "Batch status",
	})
	.input(getBatchInputSchema)
	.output(batchResponseSchema)
	.handler(({ input, context }) =>
		requireBulkOrderService(context.bulkOrderService).get(input.batch_id),
	);
