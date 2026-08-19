import { sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

import { createdAtColumn, primaryUuid, updatedAtColumn } from "./columns";
import {
	documentTypeEnum,
	paymentModeEnum,
	shipmentActionTypeEnum,
} from "./enums";
import { orders } from "./orders";

export const shipmentDocuments = pgTable(
	"shipment_documents",
	{
		id: primaryUuid(),
		orderId: uuid("order_id")
			.notNull()
			.references(() => orders.id, { onDelete: "restrict" }),
		type: documentTypeEnum("type").notNull(),
		url: text("url"),
		partnerStatus: varchar("partner_status", { length: 64 }),
		rawPayload: jsonb("raw_payload").notNull().$type<unknown>(),
		createdAt: createdAtColumn(),
	},
	(t) => [
		index("shipment_documents_order_type_idx").on(
			t.orderId,
			t.type,
			t.createdAt,
		),
	],
);

export const shipmentActions = pgTable(
	"shipment_actions",
	{
		id: primaryUuid(),
		orderId: uuid("order_id")
			.notNull()
			.references(() => orders.id, { onDelete: "restrict" }),
		type: shipmentActionTypeEnum("type").notNull(),
		succeeded: boolean("succeeded").notNull(),
		partnerMessage: text("partner_message"),
		fromPaymentMode: paymentModeEnum("from_payment_mode"),
		toPaymentMode: paymentModeEnum("to_payment_mode"),
		requestPayload: jsonb("request_payload").$type<unknown>(),
		responsePayload: jsonb("response_payload").$type<unknown>(),
		createdAt: createdAtColumn(),
	},
	(t) => [
		index("shipment_actions_order_idx").on(t.orderId, t.createdAt),
		index("shipment_actions_type_idx").on(t.type, t.createdAt),
	],
);

export const pincodeServiceability = pgTable(
	"pincode_serviceability",
	{
		id: primaryUuid(),
		courierPartner: varchar("courier_partner", { length: 32 }).notNull(),
		pincode: varchar("pincode", { length: 6 }).notNull(),
		isServiceable: boolean("is_serviceable").notNull(),
		serviceTypes: jsonb("service_types").$type<string[]>(),
		rawPayload: jsonb("raw_payload").$type<unknown>(),
		fetchedAt: timestamp("fetched_at", {
			withTimezone: true,
			mode: "date",
		})
			.notNull()
			.defaultNow(),
		updatedAt: updatedAtColumn(),
	},
	(t) => [
		uniqueIndex("pincode_serviceability_partner_pin_uidx").on(
			t.courierPartner,
			t.pincode,
		),
		check("pincode_serviceability_pin_chk", sql`${t.pincode} ~ '^[0-9]{6}$'`),
	],
);
