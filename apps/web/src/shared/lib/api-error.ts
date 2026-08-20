import { ORPCError } from "@orpc/client";

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
