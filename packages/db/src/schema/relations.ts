import { relations } from "drizzle-orm";

import { courierApiCalls } from "./audit";
import { bulkBatchItems } from "./batch-items";
import { bulkBatches } from "./bulk";
import { shipmentActions, shipmentDocuments } from "./documents";
import { orderPackages, orderParties, orders } from "./orders";
import { trackingEvents } from "./tracking";

export const ordersRelations = relations(orders, ({ one, many }) => ({
	batch: one(bulkBatches, {
		fields: [orders.batchId],
		references: [bulkBatches.id],
	}),
	parties: many(orderParties),
	packages: many(orderPackages),
	trackingEvents: many(trackingEvents),
	courierApiCalls: many(courierApiCalls),
	documents: many(shipmentDocuments),
	actions: many(shipmentActions),
	batchItems: many(bulkBatchItems),
}));

export const orderPartiesRelations = relations(orderParties, ({ one }) => ({
	order: one(orders, {
		fields: [orderParties.orderId],
		references: [orders.id],
	}),
}));

export const orderPackagesRelations = relations(orderPackages, ({ one }) => ({
	order: one(orders, {
		fields: [orderPackages.orderId],
		references: [orders.id],
	}),
}));

export const trackingEventsRelations = relations(trackingEvents, ({ one }) => ({
	order: one(orders, {
		fields: [trackingEvents.orderId],
		references: [orders.id],
	}),
}));

export const courierApiCallsRelations = relations(
	courierApiCalls,
	({ one }) => ({
		order: one(orders, {
			fields: [courierApiCalls.orderId],
			references: [orders.id],
		}),
	}),
);

export const bulkBatchesRelations = relations(bulkBatches, ({ many }) => ({
	items: many(bulkBatchItems),
	orders: many(orders),
}));

export const bulkBatchItemsRelations = relations(bulkBatchItems, ({ one }) => ({
	batch: one(bulkBatches, {
		fields: [bulkBatchItems.batchId],
		references: [bulkBatches.id],
	}),
	order: one(orders, {
		fields: [bulkBatchItems.orderUuid],
		references: [orders.id],
	}),
}));

export const shipmentDocumentsRelations = relations(
	shipmentDocuments,
	({ one }) => ({
		order: one(orders, {
			fields: [shipmentDocuments.orderId],
			references: [orders.id],
		}),
	}),
);

export const shipmentActionsRelations = relations(
	shipmentActions,
	({ one }) => ({
		order: one(orders, {
			fields: [shipmentActions.orderId],
			references: [orders.id],
		}),
	}),
);
