export type CourierCallOperation =
	| "AUTH"
	| "PINCODE"
	| "CREATE"
	| "TRACK"
	| "CANCEL"
	| "LABEL"
	| "EPOD"
	| "NDR_RTO"
	| "NDR_REATTEMPT"
	| "PAYMODE_CHANGE";

export type CourierCallErrorType = "TIMEOUT" | "NETWORK" | "HTTP";

export type CourierCallInput = {
	orderUuid?: string | null;
	courierPartner: string;
	operation: CourierCallOperation;
	attempt: number;
	requestUrl: string;
	requestPayload?: unknown;
	responsePayload?: unknown;
	httpStatus?: number;
	errorType?: CourierCallErrorType | null;
	durationMs: number;
	requestId: string;
};

export interface CourierCallStore {
	appendCourierCall(input: CourierCallInput): Promise<void>;
}

const ERROR_TYPES = new Set<CourierCallErrorType>([
	"TIMEOUT",
	"NETWORK",
	"HTTP",
]);

const OPERATIONS = new Set<CourierCallOperation>([
	"AUTH",
	"PINCODE",
	"CREATE",
	"TRACK",
	"CANCEL",
	"LABEL",
	"EPOD",
	"NDR_RTO",
	"NDR_REATTEMPT",
	"PAYMODE_CHANGE",
]);

export function toCourierCallInput(
	courierPartner: string,
	requestId: string,
	orderUuid: string | null,
	call: {
		operation: string;
		attempt: number;
		requestUrl: string;
		requestPayload: unknown;
		responsePayload: unknown;
		httpStatus?: number;
		errorType?: string;
		durationMs: number;
	},
): CourierCallInput {
	return {
		orderUuid,
		courierPartner,
		operation: OPERATIONS.has(call.operation as CourierCallOperation)
			? (call.operation as CourierCallOperation)
			: "CREATE",
		attempt: call.attempt,
		requestUrl: call.requestUrl,
		requestPayload: call.requestPayload,
		responsePayload: call.responsePayload,
		httpStatus: call.httpStatus,
		errorType: ERROR_TYPES.has(call.errorType as CourierCallErrorType)
			? (call.errorType as CourierCallErrorType)
			: undefined,
		durationMs: call.durationMs,
		requestId,
	};
}
