import { z } from "zod";

export const ORDER_STATUSES = [
	"PENDING",
	"CREATED",
	"PICKED_UP",
	"IN_TRANSIT",
	"OUT_FOR_DELIVERY",
	"DELIVERED",
	"RTO",
	"CANCELLED",
	"FAILED",
] as const;

export const orderIdSchema = z
	.string()
	.min(1)
	.max(64)
	.regex(
		/^[A-Za-z0-9._-]+$/,
		"Must be 1–64 characters: letters, digits, '.', '_' or '-'",
	);

export const courierPartnerSchema = z
	.string()
	.min(1)
	.regex(
		/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/,
		"Must be a snake_case or kebab-case identifier",
	);

const indianMobileSchema = z
	.string()
	.transform((value) => value.replace(/\s+/g, ""))
	.pipe(z.string().regex(/^[0-9]{10}$/, "Must be a 10-digit Indian mobile"));

const pincodeSchema = z
	.string()
	.regex(/^[0-9]{6}$/, "Must be a 6-digit Indian pincode");

const positiveMoneySchema = z.number().positive("Must be greater than 0");
const nonNegativeMoneySchema = z.number().nonnegative("Must be at least 0");
const positiveDimensionSchema = z
	.number()
	.positive("Must be a positive number");

export const addressSchema = z.object({
	name: z.string().min(1),
	phone: indianMobileSchema,
	email: z.email("Must be a valid email"),
	address_line1: z.string().min(1),
	address_type: z.string().min(1),
	city: z.string().min(1),
	state: z.string().min(1),
	pincode: pincodeSchema,
	country: z
		.string()
		.regex(/^[A-Z]{2}$/, "Must be an ISO 3166-1 alpha-2 country code"),
});

export const paymentSchema = z.object({
	mode: z.enum(["COD", "PREPAID"]),
	declared_value: positiveMoneySchema,
	collectable_value: nonNegativeMoneySchema,
	invoice_number: z.string().min(1),
	invoice_date: z
		.string()
		.regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/, "Must be YYYY-MM-DD"),
	invoice_value: positiveMoneySchema,
});

export const packageSchema = z.object({
	description: z.string().min(1),
	sku: z.string().min(1).optional(),
	quantity: z.number().int().min(1),
	pieces: z.number().int().min(1),
	weight_kg: positiveDimensionSchema,
	length_cm: positiveDimensionSchema,
	breadth_cm: positiveDimensionSchema,
	height_cm: positiveDimensionSchema,
});

export const createOrderSchema = z
	.object({
		courier_partner: courierPartnerSchema,
		order_id: orderIdSchema,
		service_type: z.enum(["SDD", "NDD"]),
		payment: paymentSchema,
		package: packageSchema,
		shipper: addressSchema,
		consignee: addressSchema,
		return_address: addressSchema,
	})
	.superRefine((value, ctx) => {
		if (value.payment.mode === "COD" && value.payment.collectable_value <= 0) {
			ctx.addIssue({
				code: "custom",
				path: ["payment", "collectable_value"],
				message: "Must be greater than 0 for COD orders",
			});
		}
		if (
			value.payment.mode === "PREPAID" &&
			value.payment.collectable_value !== 0
		) {
			ctx.addIssue({
				code: "custom",
				path: ["payment", "collectable_value"],
				message: "Must be 0 for PREPAID orders",
			});
		}
	});

export const getOrderInputSchema = z.object({
	order_id: orderIdSchema,
});

export const trackingEventSchema = z.object({
	status: z.enum(ORDER_STATUSES),
	occurred_at: z.string(),
	description: z.string(),
	location: z.string().nullable(),
});

export const trackOrderResponseSchema = z.object({
	order_id: z.string(),
	courier_partner: z.string(),
	awb: z.string(),
	status: z.enum(ORDER_STATUSES),
	stale: z.boolean(),
	history: z.array(trackingEventSchema),
});

export const orderResponseSchema = z.object({
	order_id: z.string(),
	internal_id: z.string(),
	courier_partner: z.string(),
	courier_shipment_id: z.string().nullable(),
	awb: z.string().nullable(),
	status: z.enum(ORDER_STATUSES),
	created_at: z.string(),
	updated_at: z.string(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type OrderResponse = z.infer<typeof orderResponseSchema>;
export type TrackOrderResponse = z.infer<typeof trackOrderResponseSchema>;
