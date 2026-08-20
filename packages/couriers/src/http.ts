import { CourierAuthFailedError, CourierUnavailableError } from "./errors";

export const REDACTED = "[REDACTED]";

const SENSITIVE_KEY =
	/^(authorization|proxy-authorization|password|passwd|secret|token|access_token|refresh_token|api[_-]?key|client_secret)$/i;

export type CourierHttpConfig = {
	timeoutMs: number;
	retryAttempts: number;
	retryBaseMs: number;
	retryMaxMs: number;
	fetch: typeof globalThis.fetch;
	sleep: (ms: number) => Promise<void>;
	random: () => number;
};

export type CourierHeaders = Record<string, string>;

export type CourierHttpRequest = {
	url: string;
	method?: string;
	headers?: CourierHeaders;
	body?: unknown;
	signal?: AbortSignal;
	onUnauthorized?: () => Promise<CourierHeaders | undefined>;
};

export type CourierHttpAudit = {
	method: string;
	url: string;
	headers: CourierHeaders;
	body: unknown;
};

export type CourierHttpResult = {
	status: number;
	ok: boolean;
	headers: CourierHeaders;
	body: unknown;
	rawRequest: CourierHttpAudit;
	rawResponse: unknown;
};

const DEFAULT_HTTP_CONFIG: CourierHttpConfig = {
	timeoutMs: 10_000,
	retryAttempts: 3,
	retryBaseMs: 200,
	retryMaxMs: 2_000,
	fetch: globalThis.fetch.bind(globalThis),
	sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
	random: Math.random,
};

export function httpConfigFromEnv(env: {
	COURIER_TIMEOUT_MS: number;
	COURIER_RETRY_ATTEMPTS: number;
	COURIER_RETRY_BASE_MS: number;
	COURIER_RETRY_MAX_MS: number;
}): Pick<
	CourierHttpConfig,
	"timeoutMs" | "retryAttempts" | "retryBaseMs" | "retryMaxMs"
> {
	return {
		timeoutMs: env.COURIER_TIMEOUT_MS,
		retryAttempts: env.COURIER_RETRY_ATTEMPTS,
		retryBaseMs: env.COURIER_RETRY_BASE_MS,
		retryMaxMs: env.COURIER_RETRY_MAX_MS,
	};
}

export function createCourierHttp(config: Partial<CourierHttpConfig> = {}): {
	request: (request: CourierHttpRequest) => Promise<CourierHttpResult>;
} {
	const resolved = resolveConfig(config);
	return {
		request: (request) => courierRequest(request, resolved),
	};
}

function resolveConfig(
	config: Partial<CourierHttpConfig> = {},
): CourierHttpConfig {
	return {
		timeoutMs: config.timeoutMs ?? DEFAULT_HTTP_CONFIG.timeoutMs,
		retryAttempts: config.retryAttempts ?? DEFAULT_HTTP_CONFIG.retryAttempts,
		retryBaseMs: config.retryBaseMs ?? DEFAULT_HTTP_CONFIG.retryBaseMs,
		retryMaxMs: config.retryMaxMs ?? DEFAULT_HTTP_CONFIG.retryMaxMs,
		fetch: config.fetch ?? DEFAULT_HTTP_CONFIG.fetch,
		sleep: config.sleep ?? DEFAULT_HTTP_CONFIG.sleep,
		random: config.random ?? DEFAULT_HTTP_CONFIG.random,
	};
}

export function redactHeaders(headers: CourierHeaders): CourierHeaders {
	const redacted: Record<string, string> = {};
	for (const [key, value] of Object.entries(headers)) {
		redacted[key] = SENSITIVE_KEY.test(key) ? REDACTED : value;
	}
	return redacted;
}

export function redactValue(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(redactValue);
	}
	if (value !== null && typeof value === "object") {
		const redacted: Record<string, unknown> = {};
		for (const [key, nested] of Object.entries(value)) {
			redacted[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactValue(nested);
		}
		return redacted;
	}
	return value;
}

export function redactUrl(url: string): string {
	try {
		const parsed = new URL(url);
		for (const key of [...parsed.searchParams.keys()]) {
			if (SENSITIVE_KEY.test(key)) {
				parsed.searchParams.set(key, REDACTED);
			}
		}
		return parsed.toString();
	} catch {
		return url;
	}
}

export async function courierRequest(
	request: CourierHttpRequest,
	config: Partial<CourierHttpConfig> = {},
): Promise<CourierHttpResult> {
	const resolved = resolveConfig(config);
	const method = request.method ?? "GET";
	let headers = headersToRecord(request.headers);
	const encodedBody = encodeBody(request.body, headers);
	if (encodedBody.contentType && !hasHeader(headers, "content-type")) {
		headers = { ...headers, "Content-Type": encodedBody.contentType };
	}

	const maxAttempts = Math.max(1, resolved.retryAttempts);
	let attempt = 1;
	let unauthorizedRetried = false;

	while (attempt <= maxAttempts) {
		if (request.signal?.aborted) {
			throw new CourierUnavailableError("Courier request was aborted");
		}

		try {
			const result = await performAttempt({
				url: request.url,
				method,
				headers,
				body: encodedBody.body,
				parsedBody: request.body,
				signal: request.signal,
				config: resolved,
			});

			if (
				result.status === 401 &&
				request.onUnauthorized &&
				!unauthorizedRetried
			) {
				unauthorizedRetried = true;
				const refreshed = await request.onUnauthorized();
				if (refreshed) {
					headers = { ...headers, ...headersToRecord(refreshed) };
				}
				continue;
			}

			if (
				result.status === 401 &&
				request.onUnauthorized &&
				unauthorizedRetried
			) {
				throw new CourierAuthFailedError();
			}

			if (result.status >= 500 && attempt < maxAttempts) {
				await resolved.sleep(
					backoffMs(
						attempt,
						resolved.retryBaseMs,
						resolved.retryMaxMs,
						resolved.random,
					),
				);
				attempt += 1;
				continue;
			}

			if (result.status >= 500) {
				throw new CourierUnavailableError();
			}

			return result;
		} catch (error) {
			if (error instanceof CourierAuthFailedError) {
				throw error;
			}
			if (isRetryableFailure(error, request.signal) && attempt < maxAttempts) {
				await resolved.sleep(
					backoffMs(
						attempt,
						resolved.retryBaseMs,
						resolved.retryMaxMs,
						resolved.random,
					),
				);
				attempt += 1;
				continue;
			}
			if (isRetryableFailure(error, request.signal)) {
				throw new CourierUnavailableError();
			}
			throw error;
		}
	}

	throw new CourierUnavailableError();
}

function backoffMs(
	attempt: number,
	baseMs: number,
	capMs: number,
	random: () => number,
): number {
	return Math.min(capMs, baseMs * 2 ** (attempt - 1)) * random();
}

function isRetryableFailure(
	error: unknown,
	callerSignal?: AbortSignal,
): boolean {
	if (callerSignal?.aborted) {
		return false;
	}
	if (error instanceof CourierUnavailableError) {
		return true;
	}
	if (error instanceof TypeError) {
		return true;
	}
	return isAbortError(error);
}

function isAbortError(error: unknown): boolean {
	return error instanceof Error && error.name === "AbortError";
}

async function performAttempt(args: {
	url: string;
	method: string;
	headers: CourierHeaders;
	body: string | Uint8Array | undefined;
	parsedBody: unknown;
	signal?: AbortSignal;
	config: CourierHttpConfig;
}): Promise<CourierHttpResult> {
	const timeout = AbortSignal.timeout(args.config.timeoutMs);
	const signal = args.signal
		? AbortSignal.any([args.signal, timeout])
		: timeout;

	const response = await args.config.fetch(args.url, {
		method: args.method,
		headers: args.headers,
		body: args.body,
		signal,
	});

	const body = await readBody(response);
	const responseHeaders = Object.fromEntries(response.headers.entries());
	const rawRequest: CourierHttpAudit = {
		method: args.method,
		url: redactUrl(args.url),
		headers: redactHeaders(args.headers),
		body: redactValue(args.parsedBody),
	};

	return {
		status: response.status,
		ok: response.ok,
		headers: responseHeaders,
		body,
		rawRequest,
		rawResponse: redactValue(body),
	};
}

async function readBody(response: Response): Promise<unknown> {
	const text = await response.text();
	if (text.length === 0) {
		return null;
	}
	const contentType = response.headers.get("content-type") ?? "";
	if (contentType.includes("json")) {
		try {
			return JSON.parse(text) as unknown;
		} catch {
			return text;
		}
	}
	return text;
}

function encodeBody(
	body: unknown,
	headers: CourierHeaders,
): { body: string | Uint8Array | undefined; contentType?: string } {
	if (body === undefined || body === null) {
		return { body: undefined };
	}
	if (typeof body === "string" || body instanceof Uint8Array) {
		return { body };
	}
	if (hasHeader(headers, "content-type")) {
		return { body: JSON.stringify(body) };
	}
	return { body: JSON.stringify(body), contentType: "application/json" };
}

function headersToRecord(headers?: CourierHeaders): CourierHeaders {
	if (!headers) {
		return {};
	}
	return { ...headers };
}

function hasHeader(headers: CourierHeaders, name: string): boolean {
	const needle = name.toLowerCase();
	return Object.keys(headers).some((key) => key.toLowerCase() === needle);
}
