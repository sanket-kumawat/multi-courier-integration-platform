import { sql } from "drizzle-orm";
import {
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

import { createdAtColumn, primaryUuid } from "./columns";
import { orderStatusEnum } from "./enums";
import { orders } from "./orders";

export const trackingEvents = pgTable(
	"tracking_events",
	{
		id: primaryUuid(),
		orderId: uuid("order_id")
			.notNull()
			.references(() => orders.id, { onDelete: "restrict" }),
		status: orderStatusEnum("status").notNull(),
		partnerStatus: varchar("partner_status", { length: 64 }).notNull(),
		description: text("description"),
		location: varchar("location", { length: 128 }),
		occurredAt: timestamp("occurred_at", {
			withTimezone: true,
			mode: "date",
		}).notNull(),
		partnerEventId: varchar("partner_event_id", { length: 128 }),
		rawPayload: jsonb("raw_payload").notNull().$type<unknown>(),
		createdAt: createdAtColumn(),
	},
	(t) => [
		index("tracking_events_order_occurred_idx").on(t.orderId, t.occurredAt),
		uniqueIndex("tracking_events_dedup_uidx").on(
			t.orderId,
			t.occurredAt,
			t.partnerStatus,
		),
		uniqueIndex("tracking_events_partner_event_uidx")
			.on(t.orderId, t.partnerEventId)
			.where(sql`${t.partnerEventId} is not null`),
	],
);
