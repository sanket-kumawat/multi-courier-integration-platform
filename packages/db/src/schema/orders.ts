import { sql } from "drizzle-orm";
import {
	boolean,
	char,
	check,
	doublePrecision,
	index,
	integer,
	jsonb,
	numeric,
	pgTable,
	text,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

import { bulkBatches } from "./bulk";
import { createdAtColumn, primaryUuid, updatedAtColumn } from "./columns";
import {
	addressRoleEnum,
	orderStatusEnum,
	paymentModeEnum,
	serviceTypeEnum,
} from "./enums";

export const orders = pgTable(
	"orders",
	{
		id: primaryUuid(),
		orderId: varchar("order_id", { length: 64 }).notNull(),
		courierPartner: varchar("courier_partner", { length: 32 }).notNull(),
		courierShipmentId: varchar("courier_shipment_id", { length: 128 }),
		awb: varchar("awb", { length: 64 }),
		status: orderStatusEnum("status").notNull().default("PENDING"),
		serviceType: serviceTypeEnum("service_type").notNull(),
		paymentMode: paymentModeEnum("payment_mode").notNull(),
		declaredValue: numeric("declared_value", {
			precision: 12,
			scale: 2,
		}).notNull(),
		collectableValue: numeric("collectable_value", {
			precision: 12,
			scale: 2,
		}).notNull(),
		invoiceNumber: varchar("invoice_number", { length: 64 }).notNull(),
		invoiceDate: char("invoice_date", { length: 10 }).notNull(),
		invoiceValue: numeric("invoice_value", {
			precision: 12,
			scale: 2,
		}).notNull(),
		sellerGstin: varchar("seller_gstin", { length: 32 }),
		sellerErn: varchar("seller_ern", { length: 32 }),
		taxTotal: numeric("tax_total", { precision: 12, scale: 2 }),
		taxBreakdown: jsonb("tax_breakdown").$type<Record<string, string>>(),
		isReverse: boolean("is_reverse").notNull().default(false),
		isDangerousGoods: boolean("is_dangerous_goods").notNull().default(false),
		isSurface: boolean("is_surface").notNull().default(false),
		payloadHash: char("payload_hash", { length: 64 }).notNull(),
		requestSnapshot: jsonb("request_snapshot")
			.notNull()
			.$type<Record<string, unknown>>(),
		lastCourierRequest: jsonb("last_courier_request").$type<unknown>(),
		lastCourierResponse: jsonb("last_courier_response").$type<unknown>(),
		lastErrorCode: varchar("last_error_code", { length: 64 }),
		batchId: uuid("batch_id").references(() => bulkBatches.id, {
			onDelete: "set null",
		}),
		createdAt: createdAtColumn(),
		updatedAt: updatedAtColumn(),
	},
	(t) => [
		uniqueIndex("orders_order_id_uidx").on(t.orderId),
		uniqueIndex("orders_partner_awb_uidx")
			.on(t.courierPartner, t.awb)
			.where(sql`${t.awb} is not null`),
		index("orders_status_created_idx").on(t.status, t.createdAt),
		index("orders_partner_status_idx").on(t.courierPartner, t.status),
		index("orders_batch_id_idx").on(t.batchId),
		index("orders_pending_idx")
			.on(t.createdAt)
			.where(sql`${t.status} = 'PENDING'`),
		check(
			"orders_cod_collectable_chk",
			sql`${t.paymentMode} <> 'COD' or ${t.collectableValue} > 0`,
		),
		check(
			"orders_prepaid_collectable_chk",
			sql`${t.paymentMode} <> 'PREPAID' or ${t.collectableValue} = 0`,
		),
		check(
			"orders_invoice_date_chk",
			sql`${t.invoiceDate} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'`,
		),
	],
);

export const orderParties = pgTable(
	"order_parties",
	{
		id: primaryUuid(),
		orderId: uuid("order_id")
			.notNull()
			.references(() => orders.id, { onDelete: "cascade" }),
		role: addressRoleEnum("role").notNull(),
		externalId: varchar("external_id", { length: 64 }),
		name: varchar("name", { length: 128 }).notNull(),
		phone: varchar("phone", { length: 16 }).notNull(),
		email: varchar("email", { length: 320 }),
		addressLine1: text("address_line1").notNull(),
		addressType: varchar("address_type", { length: 32 }).notNull(),
		city: varchar("city", { length: 64 }).notNull(),
		state: varchar("state", { length: 64 }).notNull(),
		pincode: char("pincode", { length: 6 }).notNull(),
		country: char("country", { length: 2 }).notNull().default("IN"),
		latitude: doublePrecision("latitude"),
		longitude: doublePrecision("longitude"),
		createdAt: createdAtColumn(),
	},
	(t) => [
		uniqueIndex("order_parties_order_role_uidx").on(t.orderId, t.role),
		index("order_parties_pincode_idx").on(t.pincode),
		index("order_parties_phone_idx").on(t.phone),
		check("order_parties_pincode_chk", sql`${t.pincode} ~ '^[0-9]{6}$'`),
		check("order_parties_phone_chk", sql`${t.phone} ~ '^[0-9]{10,15}$'`),
		check("order_parties_country_chk", sql`${t.country} ~ '^[A-Z]{2}$'`),
	],
);

export const orderPackages = pgTable(
	"order_packages",
	{
		id: primaryUuid(),
		orderId: uuid("order_id")
			.notNull()
			.references(() => orders.id, { onDelete: "cascade" }),
		position: integer("position").notNull().default(1),
		description: varchar("description", { length: 256 }).notNull(),
		sku: varchar("sku", { length: 64 }),
		hsn: varchar("hsn", { length: 16 }),
		quantity: integer("quantity").notNull().default(1),
		pieces: integer("pieces").notNull().default(1),
		weightKg: numeric("weight_kg", { precision: 10, scale: 3 }).notNull(),
		volumetricWeightKg: numeric("volumetric_weight_kg", {
			precision: 10,
			scale: 3,
		}),
		lengthCm: numeric("length_cm", { precision: 8, scale: 2 }).notNull(),
		breadthCm: numeric("breadth_cm", { precision: 8, scale: 2 }).notNull(),
		heightCm: numeric("height_cm", { precision: 8, scale: 2 }).notNull(),
		createdAt: createdAtColumn(),
	},
	(t) => [
		uniqueIndex("order_packages_order_position_uidx").on(t.orderId, t.position),
		index("order_packages_sku_idx").on(t.sku),
		check("order_packages_quantity_chk", sql`${t.quantity} > 0`),
		check("order_packages_pieces_chk", sql`${t.pieces} > 0`),
		check("order_packages_weight_chk", sql`${t.weightKg} > 0`),
		check(
			"order_packages_dims_chk",
			sql`${t.lengthCm} > 0 and ${t.breadthCm} > 0 and ${t.heightCm} > 0`,
		),
	],
);
