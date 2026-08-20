import { ORPCError, ValidationError } from "@orpc/server";

export const APP_ERROR_HTTP_STATUS = {
	VALIDATION_ERROR: 400,
	UNKNOWN_COURIER: 400,
	UNSUPPORTED_SERVICE: 400,
	ORDER_NOT_FOUND: 404,
	IDEMPOTENCY_CONFLICT: 409,
	CANCELLATION_NOT_ALLOWED: 409,
	COURIER_REJECTED: 422,
	COURIER_AUTH_FAILED: 502,
	COURIER_UNAVAILABLE: 502,
	INTERNAL_ERROR: 500,
} as const;

export type AppErrorCode = keyof typeof APP_ERROR_HTTP_STATUS;

export type ErrorDetail = {
	field: string;
	message: string;
};

export type ErrorEnvelope = {
	error: {
		code: AppErrorCode;
		message: string;
		request_id: string;
		details: ErrorDetail[];
	};
};

export class AppError extends Error {
	readonly code: AppErrorCode;
	readonly httpStatus: number;
	readonly details: ErrorDetail[];

	constructor(
		code: AppErrorCode,
		message: string,
		details: ErrorDetail[] = [],
	) {
		super(message);
		this.name = "AppError";
		this.code = code;
		this.httpStatus = APP_ERROR_HTTP_STATUS[code];
		this.details = details;
	}
}

const APP_ERROR_CODES = new Set<string>(Object.keys(APP_ERROR_HTTP_STATUS));

export function isAppErrorCode(code: string): code is AppErrorCode {
	return APP_ERROR_CODES.has(code);
}

type ErrorPayload = {
	request_id: string;
	details: ErrorDetail[];
};

function readErrorPayload(value: unknown): ErrorPayload | undefined {
	if (typeof value !== "object" || value === null) {
		return undefined;
	}
	const record = value as Record<string, unknown>;
	if (typeof record.request_id !== "string") {
		return undefined;
	}
	return {
		request_id: record.request_id,
		details: Array.isArray(record.details)
			? (record.details as ErrorDetail[])
			: [],
	};
}

function formatPathSegment(segment: unknown): string | number {
	if (typeof segment === "number") {
		return segment;
	}
	if (typeof segment === "string") {
		return segment;
	}
	if (typeof segment === "symbol") {
		return segment.description ?? segment.toString();
	}
	if (typeof segment === "object" && segment !== null && "key" in segment) {
		return formatPathSegment((segment as { key: unknown }).key);
	}
	return String(segment);
}

function formatIssuePath(path: readonly unknown[]): string {
	return path.reduce<string>((acc, segment) => {
		const key = formatPathSegment(segment);
		if (typeof key === "number") {
			return `${acc}[${key}]`;
		}
		if (acc.length === 0) {
			return key;
		}
		return `${acc}.${key}`;
	}, "");
}

export function detailsFromValidationIssues(
	issues: readonly { path?: readonly unknown[]; message: string }[],
): ErrorDetail[] {
	return issues.map((issue) => ({
		field: formatIssuePath(issue.path ?? []),
		message: issue.message,
	}));
}

export function toErrorEnvelope(
	code: AppErrorCode,
	message: string,
	requestId: string,
	details: ErrorDetail[] = [],
): ErrorEnvelope {
	return {
		error: {
			code,
			message,
			request_id: requestId,
			details,
		},
	};
}

export function appErrorToORPCError(
	error: AppError,
	requestId: string,
): ORPCError<AppErrorCode, ErrorPayload> {
	return new ORPCError(error.code, {
		status: error.httpStatus,
		message: error.message,
		data: {
			request_id: requestId,
			details: error.details,
		},
		cause: error,
	});
}

function validationORPCError(
	error: ORPCError<string, unknown>,
	requestId: string,
): ORPCError<AppErrorCode, ErrorPayload> {
	const issues =
		error.cause instanceof ValidationError ? error.cause.issues : [];
	return new ORPCError("VALIDATION_ERROR", {
		status: APP_ERROR_HTTP_STATUS.VALIDATION_ERROR,
		message: "Request validation failed",
		data: {
			request_id: requestId,
			details: detailsFromValidationIssues(issues),
		},
		cause: error,
	});
}

function internalORPCError(
	requestId: string,
	cause: unknown,
): ORPCError<AppErrorCode, ErrorPayload> {
	return new ORPCError("INTERNAL_ERROR", {
		status: APP_ERROR_HTTP_STATUS.INTERNAL_ERROR,
		message: "An unexpected error occurred",
		data: {
			request_id: requestId,
			details: [],
		},
		cause,
	});
}

export function toORPCError(
	error: unknown,
	requestId: string,
): ORPCError<AppErrorCode, ErrorPayload> {
	if (error instanceof AppError) {
		return appErrorToORPCError(error, requestId);
	}

	if (error instanceof ORPCError) {
		if (
			error.code === "BAD_REQUEST" &&
			error.cause instanceof ValidationError
		) {
			return validationORPCError(error, requestId);
		}

		if (isAppErrorCode(error.code)) {
			const payload = readErrorPayload(error.data);
			return new ORPCError(error.code, {
				status: APP_ERROR_HTTP_STATUS[error.code],
				message: error.message,
				data: {
					request_id: payload?.request_id || requestId,
					details: payload?.details ?? [],
				},
				cause: error,
			});
		}
	}

	return internalORPCError(requestId, error);
}

export function encodeErrorEnvelope(
	error: ORPCError<string, unknown>,
): ErrorEnvelope {
	const payload = readErrorPayload(error.data);
	const requestId = payload?.request_id || "unknown";
	const details = payload?.details ?? [];

	if (isAppErrorCode(error.code)) {
		return toErrorEnvelope(error.code, error.message, requestId, details);
	}

	return toErrorEnvelope(
		"INTERNAL_ERROR",
		"An unexpected error occurred",
		requestId,
		[],
	);
}
