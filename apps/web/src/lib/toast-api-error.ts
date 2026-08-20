import { ORPCError } from "@orpc/client";
import { toast } from "sonner";

/**
 * Toast a normalized API error as `code: message`.
 * Never surfaces raw partner payloads — ORPC only carries code/message/data envelope fields.
 */
export function toastApiError(error: unknown): void {
	if (error instanceof ORPCError) {
		toast.error(`${error.code}: ${error.message}`);
		return;
	}

	if (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		"message" in error &&
		typeof (error as { code: unknown }).code === "string" &&
		typeof (error as { message: unknown }).message === "string"
	) {
		const { code, message } = error as { code: string; message: string };
		toast.error(`${code}: ${message}`);
		return;
	}

	if (error instanceof Error && error.message) {
		toast.error(error.message);
		return;
	}

	toast.error("INTERNAL_ERROR: Something went wrong");
}
