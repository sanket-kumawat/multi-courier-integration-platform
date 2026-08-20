export class CourierError extends Error {
	readonly code: string;

	constructor(code: string, message: string) {
		super(message);
		this.name = "CourierError";
		this.code = code;
	}
}

export class UnknownCourierError extends CourierError {
	readonly requested: string;
	readonly available: string[];

	constructor(requested: string, available: string[]) {
		super("UNKNOWN_COURIER", `Courier partner '${requested}' is not supported`);
		this.name = "UnknownCourierError";
		this.requested = requested;
		this.available = available;
	}
}

export class CourierRejectedError extends CourierError {
	constructor(message = "Courier rejected the request") {
		super("COURIER_REJECTED", message);
		this.name = "CourierRejectedError";
	}
}

export class CourierAuthFailedError extends CourierError {
	constructor(message = "Courier authentication failed") {
		super("COURIER_AUTH_FAILED", message);
		this.name = "CourierAuthFailedError";
	}
}

export class CourierUnavailableError extends CourierError {
	constructor(message = "Courier is unavailable") {
		super("COURIER_UNAVAILABLE", message);
		this.name = "CourierUnavailableError";
	}
}

export class UnsupportedServiceError extends CourierError {
	constructor(message = "Service type is not supported") {
		super("UNSUPPORTED_SERVICE", message);
		this.name = "UnsupportedServiceError";
	}
}
