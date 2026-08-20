import {
	type CourierRegistry,
	UnknownCourierError,
} from "@multi-courier-integration-platform/couriers";
import type { BatchResponse, BulkAccepted } from "../../dto/batches";
import type { BulkCreateInput, CreateOrderInput } from "../../dto/orders";
import { AppError } from "../../errors";
import type { RequestLog } from "../../observability";
import { WIDE_EVENTS } from "../../observability";
import { hashCreatePayload } from "../orders";
import type { BulkStore, PersistedBatchItem } from "./store";
import { assertBulkSize, assertUniqueOrderIds } from "./validate";

export type BulkOrderServiceContext = {
	requestId: string;
	log?: RequestLog;
};

export class BulkOrderService {
	constructor(
		private readonly registry: CourierRegistry,
		private readonly db: BulkStore,
	) {}

	async enqueue(
		input: BulkCreateInput,
		ctx: BulkOrderServiceContext,
	): Promise<BulkAccepted> {
		assertBulkSize(input.orders.length);
		assertUniqueOrderIds(input.orders);
		this.assertKnownCouriers(input.orders);

		ctx.log?.set({
			event: WIDE_EVENTS.ORDER_BULK_ACCEPT,
			request_id: ctx.requestId,
			operation: "CREATE",
			accepted: input.orders.length,
		});

		const batch = await this.db.enqueue({
			orders: input.orders.map((order) => ({
				order,
				payloadHash: hashCreatePayload(order),
			})),
		});

		return {
			batch_id: batch.id,
			accepted: batch.total,
			status: "QUEUED",
			poll_url: `/api/v1/batches/${batch.id}`,
		};
	}

	async get(batchId: string): Promise<BatchResponse> {
		const snapshot = await this.db.getBatch(batchId);
		if (!snapshot) {
			throw new AppError("ORDER_NOT_FOUND", `Batch '${batchId}' not found`);
		}

		const { batch, items } = snapshot;
		const pending = batch.total - batch.succeeded - batch.failed;
		return {
			batch_id: batch.id,
			status: batch.status,
			total: batch.total,
			succeeded: batch.succeeded,
			failed: batch.failed,
			pending,
			created_at: batch.createdAt.toISOString(),
			updated_at: batch.updatedAt.toISOString(),
			completed_at: batch.completedAt?.toISOString() ?? null,
			results: batch.status === "COMPLETED" ? items.map(toBatchResult) : [],
		};
	}

	private assertKnownCouriers(orders: CreateOrderInput[]): void {
		for (const [index, order] of orders.entries()) {
			try {
				this.registry.get(order.courier_partner);
			} catch (error) {
				if (error instanceof UnknownCourierError) {
					throw new AppError("UNKNOWN_COURIER", error.message, [
						{
							field: `orders[${index}].courier_partner`,
							message: `Supported couriers: ${error.available.join(", ")}`,
						},
					]);
				}
				throw error;
			}
		}
	}
}

function toBatchResult(
	item: PersistedBatchItem,
): BatchResponse["results"][number] {
	const success = item.status === "SUCCEEDED";
	return {
		order_id: item.orderId,
		position: item.position,
		success,
		awb: success ? item.awb : null,
		status: success ? (item.orderStatus ?? "CREATED") : "FAILED",
		error: success
			? null
			: {
					code: item.errorCode ?? "INTERNAL_ERROR",
					message: item.errorMessage ?? "An unexpected error occurred",
				},
	};
}
