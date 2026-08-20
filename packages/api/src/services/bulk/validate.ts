import type { CreateOrderInput } from "../../dto/orders";
import { AppError, type ErrorDetail } from "../../errors";

export const BULK_SIZE_MESSAGE =
	"Array must contain between 1 and 100 elements";

export function assertBulkSize(length: number): void {
	if (length < 1 || length > 100) {
		throw new AppError("VALIDATION_ERROR", "Request validation failed", [
			{ field: "orders", message: BULK_SIZE_MESSAGE },
		]);
	}
}

export function duplicateOrderIdDetails(
	orders: Array<Pick<CreateOrderInput, "order_id">>,
): ErrorDetail[] {
	const firstIndex = new Map<string, number>();
	const details: ErrorDetail[] = [];
	for (const [index, order] of orders.entries()) {
		const first = firstIndex.get(order.order_id);
		if (first !== undefined) {
			details.push({
				field: `orders[${index}].order_id`,
				message: `Duplicate of orders[${first}].order_id: '${order.order_id}'`,
			});
		} else {
			firstIndex.set(order.order_id, index);
		}
	}
	return details;
}

export function assertUniqueOrderIds(
	orders: Array<Pick<CreateOrderInput, "order_id">>,
): void {
	const details = duplicateOrderIdDetails(orders);
	if (details.length > 0) {
		throw new AppError(
			"VALIDATION_ERROR",
			"Duplicate order_id values in batch",
			details,
		);
	}
}
