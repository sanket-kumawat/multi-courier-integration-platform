import {
	CourierAuthFailedError,
	CourierError,
	CourierRejectedError,
	CourierUnavailableError,
	UnsupportedServiceError,
} from "@multi-courier-integration-platform/couriers";
import { AppError } from "../../errors";

export function mapCourierError(error: unknown): AppError {
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

export function httpStatusForCourierError(error: unknown): number | undefined {
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
