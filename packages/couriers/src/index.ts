import { MockCourierAdapter } from "./mock/adapter";
import { CourierRegistry } from "./registry";
import { UrbaneBoltAdapter } from "./urbanebolt/adapter";

export const registry = new CourierRegistry();
registry.register(new MockCourierAdapter());
registry.register(new UrbaneBoltAdapter());

export type {
	AdapterContext,
	AdapterLogger,
	Address,
	CancelInput,
	CancelResult,
	CanonicalStatus,
	CourierAdapter,
	CourierPartnerId,
	CreateShipmentInput,
	CreateShipmentResult,
	TrackEvent,
	TrackInput,
	TrackResult,
} from "./contract";
export {
	CourierAuthFailedError,
	CourierError,
	CourierRejectedError,
	CourierUnavailableError,
	UnknownCourierError,
	UnsupportedServiceError,
} from "./errors";
export type { MockCourierOptions } from "./mock/adapter";
export { MockCourierAdapter } from "./mock/adapter";
export { CourierRegistry } from "./registry";
export type { UrbaneBoltAdapterOptions } from "./urbanebolt/adapter";
export { UrbaneBoltAdapter } from "./urbanebolt/adapter";
