import type { CreateOrderInput } from "@multi-courier-integration-platform/api/dto/orders";
import { createOrderSchema } from "@multi-courier-integration-platform/api/dto/orders";

const WAREHOUSE = {
	name: "Warehouse Alpha",
	phone: "9425018023",
	email: "warehouse@example.com",
	address_line1: "Plot 137-139, Sector-I, Industrial Area",
	address_type: "Seller",
	city: "Bengaluru",
	state: "Karnataka",
	pincode: "560001",
	country: "IN",
} as const;

const CONSIGNEE = {
	name: "Rahul Sharma",
	phone: "8320226438",
	email: "rahul@example.com",
	address_line1: "Plot 26-27, Om Nagar Society",
	address_type: "Home",
	city: "Surat",
	state: "Gujarat",
	pincode: "395007",
	country: "IN",
} as const;

/**
 * 20 mock orders (~95/5): index 19 uses FAIL so the mock courier rejects it.
 * Unique order_id prefix so re-submitting sample does not collide with prior batches.
 */
export function buildSampleBulkOrders(
	prefix = `BULK-${Date.now()}`,
): CreateOrderInput[] {
	const invoiceDate = new Date().toISOString().slice(0, 10);

	return Array.from({ length: 20 }, (_, index) => {
		const fail = index === 19;
		// Mock courier rejects order_ids containing "FAIL" (95/5-style partial success).
		const orderId = fail
			? `${prefix}-FAIL`
			: `${prefix}-${String(index).padStart(3, "0")}`;

		return createOrderSchema.parse({
			courier_partner: "mock",
			order_id: orderId,
			service_type: index % 2 === 0 ? "NDD" : "SDD",
			payment: {
				mode: "COD",
				declared_value: 500 + index,
				collectable_value: 500 + index,
				invoice_number: `INV-${prefix}-${index}`,
				invoice_date: invoiceDate,
				invoice_value: 500 + index,
			},
			package: {
				description: fail ? "Fail sample" : "Books",
				sku: `SKU-${index}`,
				quantity: 1,
				pieces: 1,
				weight_kg: 1.1,
				length_cm: 12,
				breadth_cm: 10,
				height_cm: 10,
			},
			shipper: WAREHOUSE,
			consignee: CONSIGNEE,
			return_address: WAREHOUSE,
		});
	});
}

export function formatSampleBulkJson(prefix?: string): string {
	return JSON.stringify({ orders: buildSampleBulkOrders(prefix) }, null, 2);
}
