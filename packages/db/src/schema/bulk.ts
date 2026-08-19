import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, timestamp } from "drizzle-orm/pg-core";

import { createdAtColumn, primaryUuid, updatedAtColumn } from "./columns";
import { batchStatusEnum } from "./enums";

export const bulkBatches = pgTable(
	"bulk_batches",
	{
		id: primaryUuid(),
		status: batchStatusEnum("status").notNull().default("QUEUED"),
		total: integer("total").notNull(),
		succeeded: integer("succeeded").notNull().default(0),
		failed: integer("failed").notNull().default(0),
		createdAt: createdAtColumn(),
		updatedAt: updatedAtColumn(),
		completedAt: timestamp("completed_at", {
			withTimezone: true,
			mode: "date",
		}),
	},
	(t) => [
		index("bulk_batches_status_idx").on(t.status, t.createdAt),
		check("bulk_batches_total_chk", sql`${t.total} between 1 and 100`),
		check(
			"bulk_batches_counts_chk",
			sql`${t.succeeded} >= 0 and ${t.failed} >= 0 and ${t.succeeded} + ${t.failed} <= ${t.total}`,
		),
	],
);
