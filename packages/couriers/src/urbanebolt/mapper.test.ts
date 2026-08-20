import { describe, expect, it } from "vitest";
import type { CreateShipmentInput } from "../contract";
import { mapCountry, mapPayMode, toManifestItem } from "./mapper";

function sampleInput(
	overrides: Partial<CreateShipmentInput> = {},
): CreateShipmentInput {
	return {
		orderId: "OMS-2026-000142",
		serviceType: "NDD",
		payment: {
			mode: "PREPAID",
			declaredValue: 1299,
			collectableValue: 0,
			invoiceNumber: "INV-8891",
			invoiceDate: "2026-08-19",
			invoiceValue: 1299,
		},
		pkg: {
			description: "Books",
			quantity: 1,
			pieces: 1,
			weightKg: 1.1,
			lengthCm: 12,
			breadthCm: 10,
			heightCm: 10,
		},
		shipper: {
			name: "Warehouse Alpha",
			phone: "9425018023",
			email: "warehouse@example.com",
			addressLine1: "Plot 137",
			addressType: "Seller",
			city: "Bengaluru",
			state: "KA",
			pincode: "560001",
			country: "IN",
		},
		consignee: {
			name: "Rahul Sharma",
			phone: "8320226438",
			email: "rahul@example.com",
			addressLine1: "Plot 26",
			addressType: "Home",
			city: "Surat",
			state: "GJ",
			pincode: "395007",
			country: "IN",
		},
		returnAddress: {
			name: "Warehouse Alpha",
			phone: "9425018023",
			email: "warehouse@example.com",
			addressLine1: "Plot 137",
			addressType: "Seller",
			city: "Bengaluru",
			state: "KA",
			pincode: "560001",
			country: "IN",
		},
		...overrides,
	};
}

describe("toManifestItem", () => {
	it("maps canonical fields onto UrbaneBolt manifest keys", () => {
		const item = toManifestItem(sampleInput(), "CUST-1");

		expect(item.customerCode).toBe("CUST-1");
		expect(item.orderNumber).toBe("OMS-2026-000142");
		expect(item.itemDescription).toBe("Books");
		expect(item.payMode).toBe("PPD");
		expect(item.serviceType).toBe("NDD");
		expect(item.height).toBe(10);
		expect(item.length).toBe(12);
		expect(item.breadth).toBe(10);
		expect(item.weight).toBe(1.1);
		expect(item.itemQuantity).toBe(1);
		expect(item.shprPin).toBe("560001");
		expect(item.consPin).toBe("395007");
		expect(item.rtnPin).toBe("560001");
		expect(item.shprCountry).toBe("INDIA");
		expect(item.consName).toBe("Rahul Sharma");
		expect(item.invoiceNumber).toBe("INV-8891");
	});

	it("maps COD pay mode without converting it", () => {
		expect(mapPayMode("COD")).toBe("COD");
		expect(mapCountry("US")).toBe("US");
	});
});
