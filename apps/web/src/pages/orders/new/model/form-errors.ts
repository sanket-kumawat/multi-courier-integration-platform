import type { ZodError } from "zod";

import type { ErrorDetail } from "@multi-courier-integration-platform/api/errors";
import { ORPCError } from "@orpc/client";

export type FieldErrors = Record<string, string>;

export function fieldErrorsFromZod(error: ZodError): FieldErrors {
	const next: FieldErrors = {};
	for (const issue of error.issues) {
		const path = issue.path.join(".");
		if (path && !next[path]) {
			next[path] = issue.message;
		}
	}
	return next;
}

export function fieldErrorsFromDetails(details: ErrorDetail[]): FieldErrors {
	const next: FieldErrors = {};
	for (const detail of details) {
		if (detail.field && !next[detail.field]) {
			next[detail.field] = detail.message;
		}
	}
	return next;
}

export function readErrorDetails(error: unknown): ErrorDetail[] {
	if (!(error instanceof ORPCError)) {
		return [];
	}
	const data = error.data;
	if (typeof data !== "object" || data === null || !("details" in data)) {
		return [];
	}
	const details = (data as { details?: unknown }).details;
	return Array.isArray(details) ? (details as ErrorDetail[]) : [];
}

export function getApiErrorCode(error: unknown): string | null {
	if (error instanceof ORPCError) {
		return error.code;
	}
	if (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		typeof (error as { code: unknown }).code === "string"
	) {
		return (error as { code: string }).code;
	}
	return null;
}
