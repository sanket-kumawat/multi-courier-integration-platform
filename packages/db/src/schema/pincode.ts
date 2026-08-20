import { sql } from "drizzle-orm";
import {
	boolean,
	char,
	check,
	jsonb,
	pgTable,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";

import { primaryUuid, updatedAtColumn } from "./columns";

export const pincodeServiceability = pgTable(
	"pincode_serviceability",
	{
		id: primaryUuid(),
		courierPartner: varchar("courier_partner", { length: 32 }).notNull(),
		pincode: char("pincode", { length: 6 }).notNull(),
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
