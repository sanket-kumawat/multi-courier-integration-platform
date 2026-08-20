import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const positiveInt = (defaultValue: number) =>
	z.coerce.number().int().positive().default(defaultValue);

export const env = createEnv({
	server: {
		DATABASE_URL: z.string().min(1),
		CORS_ORIGIN: z.url(),
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),

		COURIER_TIMEOUT_MS: positiveInt(10_000),
		COURIER_RETRY_ATTEMPTS: positiveInt(3),
		COURIER_RETRY_BASE_MS: positiveInt(200),
		COURIER_RETRY_MAX_MS: positiveInt(2_000),
		BULK_CONCURRENCY: positiveInt(10),
		BULK_POLL_INTERVAL_MS: positiveInt(500),
		BULK_ITEM_STALE_MS: positiveInt(60_000),

		URBANEBOLT_BASE_URL: z.url().default("https://uat.urbanebolt.in"),
		URBANEBOLT_USERNAME: z.string().min(1).optional(),
		URBANEBOLT_PASSWORD: z.string().min(1).optional(),
		URBANEBOLT_CUSTOMER_CODE: z.string().min(1).optional(),
		URBANEBOLT_TOKEN_TTL_SECONDS: positiveInt(3300),
	},
	runtimeEnv: process.env,
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	emptyStringAsUndefined: true,
});

export function urbaneboltCredentialsConfigured(): boolean {
	return Boolean(
		env.URBANEBOLT_USERNAME &&
			env.URBANEBOLT_PASSWORD &&
			env.URBANEBOLT_CUSTOMER_CODE,
	);
}

/** Fail fast in production once the UrbaneBolt adapter is registered. */
export function assertUrbaneBoltConfigured(): void {
	if (env.NODE_ENV !== "production") {
		return;
	}
	if (urbaneboltCredentialsConfigured()) {
		return;
	}
	throw new Error(
		"URBANEBOLT_USERNAME, URBANEBOLT_PASSWORD, and URBANEBOLT_CUSTOMER_CODE are required in production",
	);
}
