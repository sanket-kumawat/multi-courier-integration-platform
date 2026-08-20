import { describe, expect, it } from "vitest";
import {
	bulkCreateSchema,
	cancelOrderResponseSchema,
	createOrderSchema,
	getOrderInputSchema,
	trackOrderResponseSchema,
} from "./orders";

export function validCreateOrder(
	overrides: Record<string, unknown> = {},
): Record<string, unknown> {
	return {
		courier_partner: "mock",
		order_id: "OMS-2026-000142",
		service_type: "NDD",
		payment: {
			mode: "COD",
			declared_value: 1299,
			collectable_value: 1299,
			invoice_number: "INV-8891",
			invoice_date: "2026-08-19",
			invoice_value: 1299,
		},
		package: {
			description: "Books",
			sku: "BK-441122",
			quantity: 1,
			pieces: 1,
			weight_kg: 1.1,
			length_cm: 12,
			breadth_cm: 10,
			height_cm: 10,
		},
		shipper: {
			name: "Warehouse Alpha",
			phone: "9425018023",
			email: "warehouse@example.com",
			address_line1: "Plot 137-139, Sector-I, Industrial Area",
			address_type: "Seller",
			city: "Bengaluru",
			state: "Karnataka",
			pincode: "560001",
			country: "IN",
		},
		consignee: {
			name: "Rahul Sharma",
			phone: "8320226438",
			email: "rahul@example.com",
			address_line1: "Plot 26-27, Om Nagar Society",
			address_type: "Home",
			city: "Surat",
			state: "Gujarat",
			pincode: "395007",
			country: "IN",
		},
		return_address: {
			name: "Warehouse Alpha",
			phone: "9425018023",
			email: "warehouse@example.com",
			address_line1: "Plot 137-139, Sector-I, Industrial Area",
			address_type: "Seller",
			city: "Bengaluru",
			state: "Karnataka",
			pincode: "560001",
			country: "IN",
		},
		...overrides,
	};
}

describe("createOrderSchema", () => {
	it("accepts the documented create payload and strips phone spaces", () => {
		const parsed = createOrderSchema.parse(
			validCreateOrder({
				shipper: {
					...(validCreateOrder().shipper as Record<string, unknown>),
					phone: "94250 18023",
				},
			}),
		);

		expect(parsed.courier_partner).toBe("mock");
		expect(parsed.order_id).toBe("OMS-2026-000142");
		expect(parsed.shipper.phone).toBe("9425018023");
	});

	it("rejects an invalid pincode with a field-level message", () => {
		const result = createOrderSchema.safeParse(
			validCreateOrder({
				consignee: {
					...(validCreateOrder().consignee as Record<string, unknown>),
					pincode: "5600",
				},
			}),
		);

		expect(result.success).toBe(false);
		if (result.success) {
			return;
		}
		expect(result.error.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: ["consignee", "pincode"],
					message: "Must be a 6-digit Indian pincode",
				}),
			]),
		);
	});

	it("requires collectable_value > 0 for COD and = 0 for PREPAID", () => {
		const cod = createOrderSchema.safeParse(
			validCreateOrder({
				payment: {
					...(validCreateOrder().payment as Record<string, unknown>),
					mode: "COD",
					collectable_value: 0,
				},
			}),
		);
		expect(cod.success).toBe(false);
		if (!cod.success) {
			expect(cod.error.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						path: ["payment", "collectable_value"],
						message: "Must be greater than 0 for COD orders",
					}),
				]),
			);
		}

		const prepaid = createOrderSchema.safeParse(
			validCreateOrder({
				payment: {
					...(validCreateOrder().payment as Record<string, unknown>),
					mode: "PREPAID",
					collectable_value: 10,
				},
			}),
		);
		expect(prepaid.success).toBe(false);
		if (!prepaid.success) {
			expect(prepaid.error.issues).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						path: ["payment", "collectable_value"],
						message: "Must be 0 for PREPAID orders",
					}),
				]),
			);
		}
	});

	it("rejects order_id values outside the documented pattern", () => {
		const result = createOrderSchema.safeParse(
			validCreateOrder({ order_id: "OMS 142" }),
		);
		expect(result.success).toBe(false);
	});
});

describe("getOrderInputSchema", () => {
	it("accepts a consumer order id", () => {
		expect(getOrderInputSchema.parse({ order_id: "OMS-2026-000142" })).toEqual({
			order_id: "OMS-2026-000142",
		});
	});
});

describe("trackOrderResponseSchema", () => {
	it("accepts the documented track payload including stale history", () => {
		expect(
			trackOrderResponseSchema.parse({
				order_id: "OMS-2026-000142",
				courier_partner: "urbanebolt",
				awb: "200000001170",
				status: "IN_TRANSIT",
				stale: false,
				history: [
					{
						status: "CREATED",
						occurred_at: "2026-08-19T12:40:11.204Z",
						description: "Shipment manifested",
						location: null,
					},
					{
						status: "IN_TRANSIT",
						occurred_at: "2026-08-19T18:02:00.000Z",
						description: "Reached hub",
						location: "BLR",
					},
				],
			}),
		).toMatchObject({ stale: false, status: "IN_TRANSIT" });
	});
});

describe("bulkCreateSchema", () => {
	it("accepts 1 and 100 orders", () => {
		expect(
			bulkCreateSchema.parse({ orders: [validCreateOrder()] }).orders,
		).toHaveLength(1);

		const hundred = Array.from({ length: 100 }, (_, index) =>
			validCreateOrder({ order_id: `OMS-${index}` }),
		);
		expect(bulkCreateSchema.parse({ orders: hundred }).orders).toHaveLength(
			100,
		);
	});

	it("rejects 0 and 101 orders", () => {
		const empty = bulkCreateSchema.safeParse({ orders: [] });
		expect(empty.success).toBe(false);
		if (!empty.success) {
			expect(empty.error.issues[0]?.message).toBe(
				"Array must contain between 1 and 100 elements",
			);
		}

		const tooMany = bulkCreateSchema.safeParse({
			orders: Array.from({ length: 101 }, (_, index) =>
				validCreateOrder({ order_id: `OMS-${index}` }),
			),
		});
		expect(tooMany.success).toBe(false);
		if (!tooMany.success) {
			expect(tooMany.error.issues[0]?.message).toBe(
				"Array must contain between 1 and 100 elements",
			);
		}
	});
});

describe("cancelOrderResponseSchema", () => {
	it("accepts the documented cancel payload", () => {
		expect(
			cancelOrderResponseSchema.parse({
				order_id: "OMS-2026-000142",
				status: "CANCELLED",
				cancelled_at: "2026-08-19T13:10:00.000Z",
			}),
		).toEqual({
			order_id: "OMS-2026-000142",
			status: "CANCELLED",
			cancelled_at: "2026-08-19T13:10:00.000Z",
		});
	});
});
