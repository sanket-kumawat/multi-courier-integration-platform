import {
	index,
	integer,
	jsonb,
	pgTable,
	text,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

import { createdAtColumn, primaryUuid } from "./columns";
import { courierCallErrorEnum, courierOperationEnum } from "./enums";
import { orders } from "./orders";

export const courierApiCalls = pgTable(
	"courier_api_calls",
	{
		id: primaryUuid(),
		orderId: uuid("order_id").references(() => orders.id, {
			onDelete: "restrict",
		}),
		courierPartner: varchar("courier_partner", { length: 32 }).notNull(),
		operation: courierOperationEnum("operation").notNull(),
		attempt: integer("attempt").notNull().default(1),
		requestUrl: text("request_url").notNull(),
		requestPayload: jsonb("request_payload").$type<unknown>(),
		responsePayload: jsonb("response_payload").$type<unknown>(),
		httpStatus: integer("http_status"),
		errorType: courierCallErrorEnum("error_type"),
		durationMs: integer("duration_ms").notNull(),
		requestId: varchar("request_id", { length: 64 }).notNull(),
		createdAt: createdAtColumn(),
	},
	(t) => [
		index("courier_api_calls_order_idx").on(t.orderId, t.createdAt),
		index("courier_api_calls_request_id_idx").on(t.requestId),
		index("courier_api_calls_partner_op_idx").on(
			t.courierPartner,
			t.operation,
			t.createdAt,
		),
	],
);
