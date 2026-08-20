import type {
	AdapterContext,
	CancelInput,
	CancelResult,
	CanonicalStatus,
	CourierAdapter,
	CreateShipmentInput,
	CreateShipmentResult,
	TrackInput,
	TrackResult,
} from "../contract";
import { CourierAuthFailedError } from "../errors";
import { type CourierHttpResult, createCourierHttp } from "../http";
import { InMemoryTokenCache } from "./auth";
import { toManifestItem } from "./mapper";
import {
	isAlreadyCancelled,
	parseAuthToken,
	parseManifestResult,
	parseTrackResult,
	throwIfRejected,
} from "./parse";
import { mapUrbaneBoltStatus } from "./status";

const DEFAULT_BASE_URL = "https://uat.urbanebolt.in";
const DEFAULT_TOKEN_TTL_SECONDS = 3300;

export type UrbaneBoltAdapterOptions = {
	baseUrl?: string;
	username?: string;
	password?: string;
	customerCode?: string;
	tokenTtlSeconds?: number;
	fetch?: typeof fetch;
	sleep?: (ms: number) => Promise<void>;
	now?: () => Date;
	timeoutMs?: number;
	retryAttempts?: number;
	retryBaseMs?: number;
	retryMaxMs?: number;
};

function stripSlash(url: string): string {
	return url.endsWith("/") ? url.slice(0, -1) : url;
}

function envString(name: string): string | undefined {
	const value = process.env[name];
	return value && value.length > 0 ? value : undefined;
}

function envInt(name: string, fallback: number): number {
	const raw = process.env[name];
	if (!raw) {
		return fallback;
	}
	const parsed = Number(raw);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export class UrbaneBoltAdapter implements CourierAdapter {
	readonly id = "urbanebolt";
	private readonly cache: InMemoryTokenCache;
	private readonly now: () => Date;
	private readonly http: ReturnType<typeof createCourierHttp>;

	constructor(private readonly options: UrbaneBoltAdapterOptions = {}) {
		this.now = options.now ?? (() => new Date());
		this.cache = new InMemoryTokenCache(this.now);
		this.http = createCourierHttp({
			fetch: options.fetch,
			sleep: options.sleep,
			timeoutMs: options.timeoutMs ?? envInt("COURIER_TIMEOUT_MS", 10_000),
			retryAttempts:
				options.retryAttempts ?? envInt("COURIER_RETRY_ATTEMPTS", 3),
			retryBaseMs: options.retryBaseMs ?? envInt("COURIER_RETRY_BASE_MS", 200),
			retryMaxMs: options.retryMaxMs ?? envInt("COURIER_RETRY_MAX_MS", 2_000),
		});
	}

	async createShipment(
		input: CreateShipmentInput,
		ctx: AdapterContext,
	): Promise<CreateShipmentResult> {
		const customerCode = this.customerCode();
		const payload = [toManifestItem(input, customerCode)];
		const result = await this.authorizedRequest(
			{
				url: `${this.baseUrl()}/api/v1/services/manifest/`,
				method: "POST",
				body: payload,
			},
			ctx,
		);
		throwIfRejected(result.status, result.body);
		const parsed = parseManifestResult(result.body);
		return {
			awb: parsed.awb,
			courierShipmentId: parsed.courierShipmentId,
			partnerStatus: parsed.partnerStatus,
			rawRequest: result.rawRequest,
			rawResponse: result.rawResponse,
		};
	}

	async track(input: TrackInput, ctx: AdapterContext): Promise<TrackResult> {
		const url = `${this.baseUrl()}/api/v1/services/tracking-pub/?awb=${encodeURIComponent(input.awb)}`;
		const result = await this.authorizedRequest({ url, method: "GET" }, ctx);
		throwIfRejected(result.status, result.body);
		const parsed = parseTrackResult(result.body, this.now());
		return {
			partnerStatus: parsed.partnerStatus,
			events: parsed.events,
			rawResponse: result.rawResponse,
		};
	}

	async cancel(input: CancelInput, ctx: AdapterContext): Promise<CancelResult> {
		const rawRequest = { awbs: input.awb };
		const result = await this.authorizedRequest(
			{
				url: `${this.baseUrl()}/api/v1/services/cancel/`,
				method: "POST",
				body: rawRequest,
			},
			ctx,
		);
		if (isAlreadyCancelled(result.body)) {
			return { rawRequest: result.rawRequest, rawResponse: result.rawResponse };
		}
		throwIfRejected(result.status, result.body);
		return { rawRequest: result.rawRequest, rawResponse: result.rawResponse };
	}

	mapStatus(partnerStatus: string): CanonicalStatus {
		return mapUrbaneBoltStatus(partnerStatus);
	}

	private baseUrl(): string {
		return stripSlash(
			this.options.baseUrl ??
				envString("URBANEBOLT_BASE_URL") ??
				DEFAULT_BASE_URL,
		);
	}

	private username(): string | undefined {
		return this.options.username ?? envString("URBANEBOLT_USERNAME");
	}

	private password(): string | undefined {
		return this.options.password ?? envString("URBANEBOLT_PASSWORD");
	}

	private customerCode(): string {
		const code =
			this.options.customerCode ?? envString("URBANEBOLT_CUSTOMER_CODE");
		if (!code) {
			throw new CourierAuthFailedError();
		}
		return code;
	}

	private tokenTtlSeconds(): number {
		return (
			this.options.tokenTtlSeconds ??
			envInt("URBANEBOLT_TOKEN_TTL_SECONDS", DEFAULT_TOKEN_TTL_SECONDS)
		);
	}

	private credentials(): { username: string; password: string } {
		const username = this.username();
		const password = this.password();
		if (!username || !password) {
			throw new CourierAuthFailedError();
		}
		return { username, password };
	}

	private async authenticate(): Promise<string> {
		const { username, password } = this.credentials();
		const result = await this.http.request({
			url: `${this.baseUrl()}/api/v1/auth/getToken/`,
			method: "POST",
			body: { username, password },
		});
		if (result.status >= 400) {
			throw new CourierAuthFailedError();
		}
		const parsed = parseAuthToken(
			result.body,
			this.now().getTime(),
			this.tokenTtlSeconds(),
		);
		this.cache.set(parsed.accessToken, parsed.expiresAtMs);
		return parsed.accessToken;
	}

	private async ensureToken(): Promise<string> {
		return this.cache.get() ?? this.authenticate();
	}

	private async authorizedRequest(
		request: {
			url: string;
			method: string;
			body?: unknown;
		},
		ctx: AdapterContext,
	): Promise<CourierHttpResult> {
		const token = await this.ensureToken();
		return this.http.request({
			url: request.url,
			method: request.method,
			body: request.body,
			signal: ctx.signal,
			headers: { Authorization: `Bearer ${token}` },
			onUnauthorized: async () => {
				this.cache.clear();
				const refreshed = await this.authenticate();
				return { Authorization: `Bearer ${refreshed}` };
			},
		});
	}
}
