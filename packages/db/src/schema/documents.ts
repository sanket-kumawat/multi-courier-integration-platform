import {
	boolean,
	index,
	jsonb,
	pgTable,
	text,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

import { createdAtColumn, primaryUuid } from "./columns";
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
