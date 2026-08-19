import { sql } from "drizzle-orm";
import { timestamp, uuid } from "drizzle-orm/pg-core";

export function primaryUuid(name = "id") {
	return uuid(name).primaryKey().default(sql`uuidv7()`);
}

export function createdAtColumn() {
	return timestamp("created_at", {
		withTimezone: true,
		mode: "date",
	})
		.notNull()
		.defaultNow();
}

export function updatedAtColumn() {
	return timestamp("updated_at", {
		withTimezone: true,
		mode: "date",
	})
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date());
}
