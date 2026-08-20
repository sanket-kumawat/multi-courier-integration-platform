import { registry } from "@multi-courier-integration-platform/couriers";
import { db } from "@multi-courier-integration-platform/db";
import { OrderService } from "./orders";
import { DrizzleOrderStore } from "./persistence/drizzle";
import { TrackingService } from "./tracking";

export function createProductionServices() {
	const store = new DrizzleOrderStore(db);
	return {
		orderService: new OrderService(registry, store),
		trackingService: new TrackingService(registry, store),
	};
}

export function createProductionOrderService(): OrderService {
	return createProductionServices().orderService;
}

export { OrderService } from "./orders";
export { MemoryOrderStore } from "./persistence/memory";
export { TrackingService } from "./tracking";
