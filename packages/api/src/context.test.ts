import { describe, expect, it } from "vitest";

import { resolveRequestId } from "./context";

function mockRequest(headers: Record<string, string> = {}) {
	return {
		header(name: string) {
			return headers[name.toLowerCase()];
		},
	} as Parameters<typeof resolveRequestId>[0];
}

describe("resolveRequestId", () => {
	it("echoes a client-supplied X-Request-Id", () => {
		expect(
			resolveRequestId(mockRequest({ "x-request-id": " req_client " })),
		).toBe("req_client");
	});

	it("generates a UUID when the header is missing", () => {
		const id = resolveRequestId(mockRequest());
		expect(id).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
		);
	});
});
