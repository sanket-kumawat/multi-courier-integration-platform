import type {
	AdapterContext,
	CancelInput,
	CancelResult,
	CanonicalStatus,
	CourierAdapter,
	CreateShipmentInput,
	CreateShipmentResult,
	TrackEvent,
	TrackInput,
	TrackResult,
} from "../contract";
import { CourierRejectedError } from "../errors";

const TRACK_PHASES = ["CREATED", "IN_TRANSIT", "DELIVERED"] as const;
const DEFAULT_PHASE_DURATION_MS = 60_000;

export type MockCourierOptions = {
	now?: () => Date;
	phaseDurationMs?: number;
};

type MockShipment = {
	orderId: string;
	awb: string;
	courierShipmentId: string;
	createdAt: Date;
	cancelledAt?: Date;
};

export class MockCourierAdapter implements CourierAdapter {
	readonly id = "mock";
	private readonly now: () => Date;
	private readonly phaseDurationMs: number;
	private readonly shipments = new Map<string, MockShipment>();

	constructor(options: MockCourierOptions = {}) {
		this.now = options.now ?? (() => new Date());
		this.phaseDurationMs = options.phaseDurationMs ?? DEFAULT_PHASE_DURATION_MS;
	}

	async createShipment(
		input: CreateShipmentInput,
		_ctx: AdapterContext,
	): Promise<CreateShipmentResult> {
		if (input.orderId.includes("FAIL")) {
			throw new CourierRejectedError();
		}

		const shipment: MockShipment = {
			orderId: input.orderId,
			awb: `MOCK-${input.orderId}`,
			courierShipmentId: `MOCK-SHIP-${input.orderId}`,
			createdAt: this.now(),
		};
		this.shipments.set(shipment.awb, shipment);

		return {
			courierShipmentId: shipment.courierShipmentId,
			awb: shipment.awb,
			partnerStatus: "CREATED",
			rawRequest: input,
			rawResponse: {
				awb: shipment.awb,
				courierShipmentId: shipment.courierShipmentId,
				status: "CREATED",
			},
		};
	}

	async track(input: TrackInput, _ctx: AdapterContext): Promise<TrackResult> {
		const shipment = this.requireShipment(input.awb);
		const partnerStatus = this.currentStatus(shipment);
		const occurredAt = this.now();
		const events: TrackEvent[] = [
			{
				partnerStatus,
				description: descriptionFor(partnerStatus),
				occurredAt,
				raw: { awb: shipment.awb, status: partnerStatus },
			},
		];

		return {
			partnerStatus,
			events,
			rawResponse: { awb: shipment.awb, status: partnerStatus, events },
		};
	}

	async cancel(
		input: CancelInput,
		_ctx: AdapterContext,
	): Promise<CancelResult> {
		const shipment = this.requireShipment(input.awb);
		if (this.currentStatus(shipment) === "DELIVERED") {
			throw new CourierRejectedError("Cancellation window closed");
		}

		shipment.cancelledAt = this.now();
		return {
			rawRequest: {
				awb: input.awb,
				courierShipmentId: input.courierShipmentId,
			},
			rawResponse: { awb: shipment.awb, status: "CANCELLED" },
		};
	}

	mapStatus(partnerStatus: string): CanonicalStatus {
		switch (partnerStatus) {
			case "PENDING":
			case "CREATED":
			case "PICKED_UP":
			case "IN_TRANSIT":
			case "OUT_FOR_DELIVERY":
			case "DELIVERED":
			case "RTO":
			case "CANCELLED":
			case "FAILED":
				return partnerStatus;
			default:
				return "IN_TRANSIT";
		}
	}

	private requireShipment(awb: string): MockShipment {
		const shipment = this.shipments.get(awb);
		if (!shipment) {
			throw new CourierRejectedError();
		}
		return shipment;
	}

	private currentStatus(shipment: MockShipment): CanonicalStatus {
		if (shipment.cancelledAt) {
			return "CANCELLED";
		}

		const elapsedMs = Math.max(
			0,
			this.now().getTime() - shipment.createdAt.getTime(),
		);
		const index = Math.min(
			TRACK_PHASES.length - 1,
			Math.floor(elapsedMs / this.phaseDurationMs),
		);
		return TRACK_PHASES[index] ?? "CREATED";
	}
}

function descriptionFor(status: CanonicalStatus): string {
	switch (status) {
		case "CREATED":
			return "Shipment manifested";
		case "IN_TRANSIT":
			return "Reached hub";
		case "DELIVERED":
			return "Delivered";
		case "CANCELLED":
			return "Shipment cancelled";
		default:
			return status;
	}
}
