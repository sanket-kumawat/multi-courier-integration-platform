export type BulkClientError = {
	message: string;
	details?: string[];
};

type ParsedOrdersPayload = {
	orders: unknown[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Client-side checks before createBulkOrders.
 * Length and in-batch duplicate order_id (server also rejects these).
 */
export function validateBulkJson(raw: string):
	| { ok: true; orders: unknown[] }
	| { ok: false; error: BulkClientError } {
	const trimmed = raw.trim();
	if (!trimmed) {
		return {
			ok: false,
			error: { message: "Paste a JSON body with an orders array." },
		};
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(trimmed) as unknown;
	} catch {
		return {
			ok: false,
			error: { message: "Invalid JSON — fix the syntax and try again." },
		};
	}

	if (!isRecord(parsed) || !Array.isArray(parsed.orders)) {
		return {
			ok: false,
			error: {
				message: 'Expected an object with an "orders" array (1–100 items).',
			},
		};
	}

	const { orders } = parsed as ParsedOrdersPayload;

	if (orders.length < 1 || orders.length > 100) {
		return {
			ok: false,
			error: {
				message: "Array must contain between 1 and 100 elements",
				details: [`orders length is ${orders.length}`],
			},
		};
	}

	const seen = new Map<string, number>();
	const duplicates: string[] = [];

	for (let index = 0; index < orders.length; index += 1) {
		const row = orders[index];
		if (!isRecord(row) || typeof row.order_id !== "string") {
			continue;
		}
		const orderId = row.order_id;
		const first = seen.get(orderId);
		if (first !== undefined) {
			duplicates.push(
				`orders[${index}].order_id duplicates orders[${first}].order_id: '${orderId}'`,
			);
		} else {
			seen.set(orderId, index);
		}
	}

	if (duplicates.length > 0) {
		return {
			ok: false,
			error: {
				message: "Duplicate order_id values in batch",
				details: duplicates,
			},
		};
	}

	return { ok: true, orders };
}
