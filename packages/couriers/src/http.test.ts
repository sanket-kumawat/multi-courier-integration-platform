import { describe, expect, it, vi } from "vitest";
import { CourierAuthFailedError, CourierUnavailableError } from "./errors";
import { courierRequest, redactHeaders, redactUrl, redactValue } from "./http";

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

const fastConfig = {
	timeoutMs: 50,
	retryAttempts: 3,
	retryBaseMs: 100,
	retryMaxMs: 1_000,
	sleep: async () => undefined,
	random: () => 1,
};

describe("redaction", () => {
	it("redacts authorization headers, tokens, and passwords", () => {
		expect(
			redactHeaders({
				Authorization: "Bearer secret-token",
				"Content-Type": "application/json",
			}),
		).toEqual({
			Authorization: "[REDACTED]",
			"Content-Type": "application/json",
		});

		expect(
			redactValue({
				username: "ops",
				password: "hunter2",
				nested: { access_token: "abc" },
			}),
		).toEqual({
			username: "ops",
			password: "[REDACTED]",
			nested: { access_token: "[REDACTED]" },
		});

		expect(redactUrl("https://uat.example/token?access_token=abc&awb=1")).toBe(
			"https://uat.example/token?access_token=%5BREDACTED%5D&awb=1",
		);
	});
});

describe("courierRequest", () => {
	it("retries HTTP 5xx then returns the successful response", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(jsonResponse(503, { error: "down" }))
			.mockResolvedValueOnce(jsonResponse(500, { error: "still down" }))
			.mockResolvedValueOnce(jsonResponse(200, { awb: "1" }));
		const sleep = vi.fn(async () => undefined);

		const result = await courierRequest(
			{ url: "https://partner.test/manifest", method: "POST" },
			{ ...fastConfig, fetch: fetchMock, sleep },
		);

		expect(result.status).toBe(200);
		expect(result.body).toEqual({ awb: "1" });
		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(sleep).toHaveBeenNthCalledWith(1, 100);
		expect(sleep).toHaveBeenNthCalledWith(2, 200);
	});

	it("does not retry 4xx responses other than 401", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockImplementation(async () =>
				jsonResponse(422, { message: "Pincode not serviceable" }),
			);

		const result = await courierRequest(
			{ url: "https://partner.test/manifest", method: "POST" },
			{ ...fastConfig, fetch: fetchMock },
		);

		expect(result.status).toBe(422);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("throws CourierUnavailableError after 5xx retries are exhausted", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockImplementation(async () =>
				jsonResponse(502, { error: "bad gateway" }),
			);

		await expect(
			courierRequest(
				{ url: "https://partner.test/track" },
				{ ...fastConfig, fetch: fetchMock },
			),
		).rejects.toBeInstanceOf(CourierUnavailableError);
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("retries timeouts and network errors then succeeds", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockRejectedValueOnce(new TypeError("fetch failed"))
			.mockResolvedValueOnce(jsonResponse(200, { ok: true }));

		const result = await courierRequest(
			{ url: "https://partner.test/track" },
			{ ...fastConfig, fetch: fetchMock },
		);

		expect(result.ok).toBe(true);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("refreshes auth on 401 and retries the original request once", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(jsonResponse(401, { error: "expired" }))
			.mockResolvedValueOnce(jsonResponse(200, { ok: true }));
		const onUnauthorized = vi.fn(async () => ({
			Authorization: "Bearer refreshed",
		}));

		const result = await courierRequest(
			{
				url: "https://partner.test/manifest",
				method: "POST",
				headers: { Authorization: "Bearer expired" },
				onUnauthorized,
			},
			{ ...fastConfig, fetch: fetchMock },
		);

		expect(result.status).toBe(200);
		expect(onUnauthorized).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledTimes(2);
		const secondInit = fetchMock.mock.calls[1]?.[1] as
			| { headers?: Record<string, string> }
			| undefined;
		expect(secondInit?.headers?.Authorization).toBe("Bearer refreshed");
		expect(JSON.stringify(result.rawRequest)).not.toContain("expired");
		expect(JSON.stringify(result.rawRequest)).not.toContain("refreshed");
	});

	it("throws CourierAuthFailedError when 401 persists after a single refresh", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockImplementation(async () => jsonResponse(401, { error: "denied" }));
		const onUnauthorized = vi.fn(async () => ({
			Authorization: "Bearer still-bad",
		}));

		await expect(
			courierRequest(
				{
					url: "https://partner.test/manifest",
					headers: { Authorization: "Bearer expired" },
					onUnauthorized,
				},
				{ ...fastConfig, fetch: fetchMock },
			),
		).rejects.toBeInstanceOf(CourierAuthFailedError);
		expect(onUnauthorized).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("emits courier.http on each attempt without leaking tokens", async () => {
		const fetchMock = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(jsonResponse(503, { error: "down" }))
			.mockResolvedValueOnce(jsonResponse(200, { awb: "1" }));
		const info = vi.fn();

		await courierRequest(
			{
				url: "https://partner.test/manifest",
				method: "POST",
				headers: { Authorization: "Bearer secret-token" },
				meta: {
					requestId: "req_1",
					orderId: "OMS-1",
					courierPartner: "urbanebolt",
					operation: "CREATE",
					logger: { info, warn: vi.fn(), error: vi.fn() },
				},
			},
			{ ...fastConfig, fetch: fetchMock },
		);

		expect(info).toHaveBeenCalledTimes(2);
		expect(info).toHaveBeenNthCalledWith(
			1,
			"courier.http",
			expect.objectContaining({
				request_id: "req_1",
				order_id: "OMS-1",
				courier_partner: "urbanebolt",
				operation: "CREATE",
				attempt: 1,
				http_status: 503,
				error_type: "HTTP",
			}),
		);
		expect(JSON.stringify(info.mock.calls)).not.toContain("secret-token");
	});
});
