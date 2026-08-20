import { createHash } from "node:crypto";
import type {
	CourierAdapter,
	CreateShipmentInput,
} from "@multi-courier-integration-platform/couriers";
import {
	CourierAuthFailedError,
	CourierError,
	type CourierRegistry,
	CourierRejectedError,
	CourierUnavailableError,
	UnknownCourierError,
	UnsupportedServiceError,
} from "@multi-courier-integration-platform/couriers";
import type { CreateOrderInput, OrderResponse } from "../dto/orders";
import { AppError } from "../errors";
import type { OrderStore, PersistedOrder } from "./order-store";

export type OrderServiceContext = {
	requestId: string;
};

export class OrderService {
	constructor(
		private readonly registry: CourierRegistry,
		private readonly db: OrderStore,
	) {}

	async create(
		input: CreateOrderInput,
		ctx: OrderServiceContext,
	): Promise<OrderResponse> {
		const adapter = this.resolveAdapter(input.courier_partner);
		const payloadHash = hashCreatePayload(input);
		const { order, inserted } = await this.db.insertPending({
			order: input,
			payloadHash,
		});

		if (!inserted) {
			if (order.payloadHash !== payloadHash) {
				throw new AppError(
					"IDEMPOTENCY_CONFLICT",
					`Order '${input.order_id}' already exists with a different payload`,
				);
			}
			if (order.status !== "PENDING" && order.status !== "FAILED") {
				return toOrderResponse(order);
			}
		}

		return this.manifest(adapter, order, input, ctx);
	}

	async get(orderId: string): Promise<OrderResponse> {
		const order = await this.db.findByOrderId(orderId);
		if (!order) {
			throw new AppError("ORDER_NOT_FOUND", `Order '${orderId}' not found`);
		}
		return toOrderResponse(order);
	}

	private resolveAdapter(courierPartner: string): CourierAdapter {
		try {
			return this.registry.get(courierPartner);
		} catch (error) {
			if (error instanceof UnknownCourierError) {
				throw new AppError("UNKNOWN_COURIER", error.message, [
					{
						field: "courier_partner",
						message: `Supported couriers: ${error.available.join(", ")}`,
					},
				]);
			}
			throw error;
		}
	}

	private async manifest(
		adapter: CourierAdapter,
		order: PersistedOrder,
		input: CreateOrderInput,
		ctx: OrderServiceContext,
	): Promise<OrderResponse> {
		const started = Date.now();
		try {
			const result = await adapter.createShipment(toShipmentInput(input), {
				requestId: ctx.requestId,
				orderId: input.order_id,
			});
			const updated = await this.db.markCreated(order.id, {
				awb: result.awb,
				courierShipmentId: result.courierShipmentId,
				status: adapter.mapStatus(result.partnerStatus),
				partnerStatus: result.partnerStatus,
				rawRequest: result.rawRequest,
				rawResponse: result.rawResponse,
				requestId: ctx.requestId,
				durationMs: Date.now() - started,
			});
			return toOrderResponse(updated);
		} catch (error) {
			await this.db.markFailed(order.id, {
				errorCode:
					error instanceof CourierError ? error.code : "INTERNAL_ERROR",
				requestId: ctx.requestId,
				durationMs: Date.now() - started,
				httpStatus: httpStatusForCourierError(error),
			});
			throw mapCourierError(error);
		}
	}
}

export function hashCreatePayload(input: CreateOrderInput): string {
	return createHash("sha256").update(stableJson(input)).digest("hex");
}

export function toShipmentInput(input: CreateOrderInput): CreateShipmentInput {
	return {
		orderId: input.order_id,
		serviceType: input.service_type,
		payment: {
			mode: input.payment.mode,
			declaredValue: input.payment.declared_value,
			collectableValue: input.payment.collectable_value,
			invoiceNumber: input.payment.invoice_number,
			invoiceDate: input.payment.invoice_date,
			invoiceValue: input.payment.invoice_value,
		},
		pkg: {
			description: input.package.description,
			quantity: input.package.quantity,
			pieces: input.package.pieces,
			weightKg: input.package.weight_kg,
			lengthCm: input.package.length_cm,
			breadthCm: input.package.breadth_cm,
			heightCm: input.package.height_cm,
			sku: input.package.sku,
		},
		shipper: toCanonicalAddress(input.shipper),
		consignee: toCanonicalAddress(input.consignee),
		returnAddress: toCanonicalAddress(input.return_address),
	};
}

function toCanonicalAddress(address: CreateOrderInput["shipper"]) {
	return {
		name: address.name,
		phone: address.phone,
		email: address.email,
		addressLine1: address.address_line1,
		addressType: address.address_type,
		city: address.city,
		state: address.state,
		pincode: address.pincode,
		country: address.country,
	};
}

function toOrderResponse(order: PersistedOrder): OrderResponse {
	return {
		order_id: order.orderId,
		internal_id: order.id,
		courier_partner: order.courierPartner,
		courier_shipment_id: order.courierShipmentId,
		awb: order.awb,
		status: order.status,
		created_at: order.createdAt.toISOString(),
		updated_at: order.updatedAt.toISOString(),
	};
}

function mapCourierError(error: unknown): AppError {
	if (error instanceof AppError) {
		return error;
	}
	if (error instanceof CourierRejectedError) {
		return new AppError("COURIER_REJECTED", error.message);
	}
	if (error instanceof CourierAuthFailedError) {
		return new AppError(
			"COURIER_AUTH_FAILED",
			"Failed to authenticate with courier partner",
		);
	}
	if (error instanceof CourierUnavailableError) {
		return new AppError(
			"COURIER_UNAVAILABLE",
			"Courier partner is temporarily unavailable",
		);
	}
	if (error instanceof UnsupportedServiceError) {
		return new AppError("UNSUPPORTED_SERVICE", error.message);
	}
	if (error instanceof CourierError) {
		return new AppError("INTERNAL_ERROR", "An unexpected error occurred");
	}
	return new AppError("INTERNAL_ERROR", "An unexpected error occurred");
}

function httpStatusForCourierError(error: unknown): number | undefined {
	if (error instanceof CourierRejectedError) {
		return 422;
	}
	if (
		error instanceof CourierAuthFailedError ||
		error instanceof CourierUnavailableError
	) {
		return 502;
	}
	return undefined;
}

function stableJson(value: unknown): string {
	if (value === null || typeof value !== "object") {
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) {
		return `[${value.map(stableJson).join(",")}]`;
	}
	const entries = Object.entries(value as Record<string, unknown>)
		.filter(([, nested]) => nested !== undefined)
		.sort(([left], [right]) => left.localeCompare(right));
	return `{${entries
		.map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
		.join(",")}}`;
}
