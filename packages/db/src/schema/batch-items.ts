import { sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

import { bulkBatches } from "./bulk";
import { createdAtColumn, primaryUuid, updatedAtColumn } from "./columns";
import { batchItemStatusEnum } from "./enums";
import { orders } from "./orders";

export const bulkBatchItems = pgTable(
	"bulk_batch_items",
	{
		id: primaryUuid(),
		batchId: uuid("batch_id")
			.notNull()
			.references(() => bulkBatches.id, { onDelete: "cascade" }),
		orderId: varchar("order_id", { length: 64 }).notNull(),
		position: integer("position").notNull(),
		status: batchItemStatusEnum("status").notNull().default("QUEUED"),
		errorCode: varchar("error_code", { length: 64 }),
		errorMessage: text("error_message"),
		orderUuid: uuid("order_uuid").references(() => orders.id, {
			onDelete: "set null",
		}),
		claimedAt: timestamp("claimed_at", { withTimezone: true, mode: "date" }),
		createdAt: createdAtColumn(),
		updatedAt: updatedAtColumn(),
	},
	(t) => [
		uniqueIndex("bulk_batch_items_batch_order_uidx").on(t.batchId, t.orderId),
		uniqueIndex("bulk_batch_items_batch_position_uidx").on(
			t.batchId,
			t.position,
		),
		index("bulk_batch_items_queued_idx")
			.on(t.createdAt)
			.where(sql`${t.status} = 'QUEUED'`),
		index("bulk_batch_items_processing_idx")
			.on(t.claimedAt)
			.where(sql`${t.status} = 'PROCESSING'`),
		index("bulk_batch_items_order_id_idx").on(t.orderId),
		check("bulk_batch_items_position_chk", sql`${t.position} >= 0`),
	],
);
