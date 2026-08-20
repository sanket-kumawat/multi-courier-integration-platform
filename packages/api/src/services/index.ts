import { registry } from "@multi-courier-integration-platform/couriers";
import { db } from "@multi-courier-integration-platform/db";
import { env } from "@multi-courier-integration-platform/env/server";
import { BulkOrderService, BulkWorker } from "./bulk";
import { CancelService } from "./cancel";
import { OrderService } from "./orders";
import { DrizzleOrderStore } from "./persistence/drizzle";
import { TrackingService } from "./tracking";

export function createProductionServices() {
	const store = new DrizzleOrderStore(db);
	const orderService = new OrderService(registry, store);
	return {
		orderService,
		trackingService: new TrackingService(registry, store),
		cancelService: new CancelService(registry, store),
		bulkOrderService: new BulkOrderService(registry, store),
		bulkWorker: new BulkWorker({
			store,
			orderService,
			concurrency: env.BULK_CONCURRENCY,
			staleMs: env.BULK_ITEM_STALE_MS,
		}),
	};
}

export function createProductionOrderService(): OrderService {
	return createProductionServices().orderService;
}

export { BulkOrderService, BulkWorker } from "./bulk";
export { CancelService } from "./cancel";
export { OrderService } from "./orders";
export { MemoryOrderStore } from "./persistence/memory";
export { TrackingService } from "./tracking";
