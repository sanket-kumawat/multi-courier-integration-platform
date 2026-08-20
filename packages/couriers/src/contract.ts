export type CourierPartnerId = string;

export type CanonicalStatus =
	| "PENDING"
	| "CREATED"
	| "PICKED_UP"
	| "IN_TRANSIT"
	| "OUT_FOR_DELIVERY"
	| "DELIVERED"
	| "RTO"
	| "CANCELLED"
	| "FAILED";

export type Address = {
	name: string;
	phone: string;
	email: string;
	addressLine1: string;
	addressLine2?: string;
	addressType: string;
	city: string;
	state: string;
	pincode: string;
	country: string;
	lat?: number;
	lng?: number;
};

export type CreateShipmentInput = {
	orderId: string;
	serviceType: "SDD" | "NDD";
	payment: {
		mode: "COD" | "PREPAID";
		declaredValue: number;
		collectableValue: number;
		invoiceNumber: string;
		invoiceDate: string;
		invoiceValue: number;
	};
	pkg: {
		description: string;
		quantity: number;
		pieces: number;
		weightKg: number;
		lengthCm: number;
		breadthCm: number;
		heightCm: number;
		sku?: string;
		hsn?: string;
	};
	shipper: Address;
	consignee: Address;
	returnAddress: Address;
};

export type CreateShipmentResult = {
	courierShipmentId: string;
	awb: string;
	partnerStatus: string;
	rawRequest: unknown;
	rawResponse: unknown;
};

export type TrackEvent = {
	partnerStatus: string;
	description: string;
	location?: string;
	occurredAt: Date;
	raw: unknown;
};

export type TrackInput = {
	awb: string;
	courierShipmentId?: string;
};

export type TrackResult = {
	partnerStatus: string;
	events: TrackEvent[];
	rawResponse: unknown;
};

export type CancelInput = {
	awb: string;
	courierShipmentId?: string;
};

export type CancelResult = {
	rawRequest: unknown;
	rawResponse: unknown;
};

export type AdapterLogger = {
	info(message: string, fields?: Record<string, unknown>): void;
	warn(message: string, fields?: Record<string, unknown>): void;
	error(message: string, fields?: Record<string, unknown>): void;
};

export type AdapterContext = {
	requestId: string;
	orderId?: string;
	signal?: AbortSignal;
	logger?: AdapterLogger;
};

export interface CourierAdapter {
	readonly id: CourierPartnerId;
	createShipment(
		input: CreateShipmentInput,
		ctx: AdapterContext,
	): Promise<CreateShipmentResult>;
	track(input: TrackInput, ctx: AdapterContext): Promise<TrackResult>;
	cancel(input: CancelInput, ctx: AdapterContext): Promise<CancelResult>;
	mapStatus(partnerStatus: string): CanonicalStatus;
}
