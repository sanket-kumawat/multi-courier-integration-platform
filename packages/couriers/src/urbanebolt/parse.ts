import type { TrackEvent } from "../contract";
import { CourierAuthFailedError, CourierRejectedError } from "../errors";

const ALLOWLISTED_REJECT_MESSAGES = [
	"Pincode not serviceable",
	"Duplicate order",
	"Cancellation window closed",
	"Invalid payload",
] as const;

export type ParsedAuthToken = {
	accessToken: string;
	expiresAtMs: number;
};

export type ParsedManifest = {
	awb: string;
	courierShipmentId: string;
	partnerStatus: string;
};

export type ParsedTrack = {
	partnerStatus: string;
	events: TrackEvent[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
	return Array.isArray(value) ? value : [];
}

function readString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim().length > 0
		? value.trim()
		: undefined;
}

function firstEnvelopeItem(body: unknown): Record<string, unknown> | undefined {
	// Spec §20: UAT envelopes vary (array vs successResponse vs failureResponse);
	// keep this parser isolated and extend via fixtures, not public DTOs.
	if (Array.isArray(body)) {
		const first = body[0];
		return isRecord(first) ? first : undefined;
	}
	if (!isRecord(body)) {
		return undefined;
	}
	const success = asArray(body.successResponse);
	const firstSuccess = success[0];
	if (isRecord(firstSuccess)) {
		return firstSuccess;
	}
	const data = body.data;
	if (Array.isArray(data) && isRecord(data[0])) {
		return data[0];
	}
	if (isRecord(data)) {
		return data;
	}
	return body;
}

function failedItems(body: unknown): unknown[] {
	if (!isRecord(body)) {
		return [];
	}
	const failed = body.failedResponse ?? body.failureResponse;
	return asArray(failed);
}

export function extractPartnerMessage(body: unknown): string {
	if (typeof body === "string") {
		if (body.includes("<")) {
			return "";
		}
		return body.slice(0, 200);
	}
	if (!isRecord(body)) {
		return "";
	}
	const failed = failedItems(body);
	const firstFailed = failed[0];
	if (isRecord(firstFailed)) {
		return readString(firstFailed.message) ?? "";
	}
	return readString(body.message) ?? "";
}

export function mapRejectedMessage(body: unknown): string {
	const raw = extractPartnerMessage(body).toLowerCase();
	if (raw.includes("pincode") || raw.includes("serviceable")) {
		return "Pincode not serviceable";
	}
	if (raw.includes("duplicate")) {
		return "Duplicate order";
	}
	if (
		raw.includes("cancel") &&
		(raw.includes("window") ||
			raw.includes("closed") ||
			raw.includes("not allowed"))
	) {
		return "Cancellation window closed";
	}
	if (raw.includes("invalid")) {
		return "Invalid payload";
	}
	return "Courier rejected the request";
}

export function throwIfRejected(status: number, body: unknown): void {
	if (status === 401) {
		throw new CourierAuthFailedError();
	}
	if (status >= 400 && status < 500) {
		throw new CourierRejectedError(mapRejectedMessage(body));
	}
	if (failedItems(body).length > 0) {
		throw new CourierRejectedError(mapRejectedMessage(body));
	}
}

export function parseAuthToken(
	body: unknown,
	nowMs: number,
	tokenTtlSeconds: number,
): ParsedAuthToken {
	if (!isRecord(body)) {
		throw new CourierAuthFailedError();
	}
	const accessToken = readString(body.access_token);
	if (!accessToken) {
		throw new CourierAuthFailedError();
	}

	const ttlCapMs = tokenTtlSeconds * 1000;
	let expiresAtMs = nowMs + ttlCapMs;
	if (typeof body.expires_in === "number" && Number.isFinite(body.expires_in)) {
		expiresAtMs = Math.min(expiresAtMs, nowMs + body.expires_in * 1000);
	}
	const expires = readString(body.expires);
	if (expires) {
		const parsed = Date.parse(expires);
		if (!Number.isNaN(parsed)) {
			expiresAtMs = Math.min(expiresAtMs, parsed);
		}
	}

	return { accessToken, expiresAtMs: expiresAtMs - 5_000 };
}

function pickAwb(item: Record<string, unknown>): string | undefined {
	return (
		readString(item.awb) ??
		readString(item.awbNumber) ??
		readString(item.AWB) ??
		readString(item.waybill)
	);
}

function pickShipmentId(item: Record<string, unknown>, awb: string): string {
	return (
		readString(item.orderNumber) ??
		readString(item.shipmentId) ??
		readString(item.orderId) ??
		awb
	);
}

export function parseManifestResult(body: unknown): ParsedManifest {
	const item = firstEnvelopeItem(body);
	if (!item) {
		throw new CourierRejectedError();
	}
	const awb = pickAwb(item);
	if (!awb) {
		throw new CourierRejectedError();
	}
	return {
		awb,
		courierShipmentId: pickShipmentId(item, awb),
		partnerStatus: readString(item.status) ?? "Manifested",
	};
}

function parseOccurredAt(value: unknown, fallback: Date): Date {
	const text = readString(value);
	if (!text) {
		return fallback;
	}
	const parsed = Date.parse(text);
	return Number.isNaN(parsed) ? fallback : new Date(parsed);
}

function historyEntries(item: Record<string, unknown>): unknown[] {
	for (const key of ["travelHistory", "history", "scans", "trackingDetails"]) {
		const value = item[key];
		if (Array.isArray(value)) {
			return value;
		}
	}
	return [];
}

export function parseTrackResult(body: unknown, now: Date): ParsedTrack {
	const item = firstEnvelopeItem(body) ?? {};
	const rawEvents = historyEntries(item);
	const events: TrackEvent[] = rawEvents.flatMap((entry) => {
		if (!isRecord(entry)) {
			return [];
		}
		const partnerStatus =
			readString(entry.status) ??
			readString(entry.activity) ??
			readString(item.status) ??
			"Unknown";
		return [
			{
				partnerStatus,
				description:
					readString(entry.remarks) ??
					readString(entry.description) ??
					readString(entry.message) ??
					partnerStatus,
				location: readString(entry.location) ?? readString(entry.city),
				occurredAt: parseOccurredAt(
					entry.date ?? entry.statusDate ?? entry.timestamp ?? entry.eventTime,
					now,
				),
				raw: entry,
			},
		];
	});

	const headerStatus =
		readString(item.status) ?? events.at(-1)?.partnerStatus ?? "Manifested";
	if (events.length === 0) {
		events.push({
			partnerStatus: headerStatus,
			description: headerStatus,
			occurredAt: now,
			raw: item,
		});
	}

	return { partnerStatus: headerStatus, events };
}

export function isAlreadyCancelled(body: unknown): boolean {
	const message = extractPartnerMessage(body).toLowerCase();
	return message.includes("already cancelled");
}

export { ALLOWLISTED_REJECT_MESSAGES };
