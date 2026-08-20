import type { CanonicalStatus } from "@multi-courier-integration-platform/couriers";
import type { CreateOrderInput } from "../dto/orders";

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

export type InsertPendingInput = {
	order: CreateOrderInput;
	payloadHash: string;
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

export class MemoryOrderStore implements OrderStore {
	private readonly byOrderId = new Map<string, PersistedOrder>();

	async insertPending(
		input: InsertPendingInput,
	): Promise<{ order: PersistedOrder; inserted: boolean }> {
		const existing = this.byOrderId.get(input.order.order_id);
		if (existing) {
			return { order: existing, inserted: false };
		}

		const now = new Date();
		const order: PersistedOrder = {
			id: crypto.randomUUID(),
			orderId: input.order.order_id,
			courierPartner: input.order.courier_partner,
			courierShipmentId: null,
			awb: null,
			status: "PENDING",
			payloadHash: input.payloadHash,
			createdAt: now,
			updatedAt: now,
		};
		this.byOrderId.set(order.orderId, order);
		return { order, inserted: true };
	}

	async findByOrderId(orderId: string): Promise<PersistedOrder | undefined> {
		return this.byOrderId.get(orderId);
	}

	async markCreated(
		id: string,
		input: MarkCreatedInput,
	): Promise<PersistedOrder> {
		return this.patch(id, {
			status: input.status,
			awb: input.awb,
			courierShipmentId: input.courierShipmentId,
		});
	}

	async markFailed(
		id: string,
		_input: MarkFailedInput,
	): Promise<PersistedOrder> {
		return this.patch(id, { status: "FAILED" });
	}

	private patch(id: string, fields: Partial<PersistedOrder>): PersistedOrder {
		const current = [...this.byOrderId.values()].find((row) => row.id === id);
		if (!current) {
			throw new Error(`Order '${id}' not found`);
		}
		const updated: PersistedOrder = {
			...current,
			...fields,
			updatedAt: new Date(),
		};
		this.byOrderId.set(updated.orderId, updated);
		return updated;
	}
}
