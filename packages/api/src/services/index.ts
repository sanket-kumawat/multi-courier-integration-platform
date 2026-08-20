import { registry } from "@multi-courier-integration-platform/couriers";
import { db } from "@multi-courier-integration-platform/db";
import { CancelService } from "./cancel";
import { OrderService } from "./orders";
import { DrizzleOrderStore } from "./persistence/drizzle";
import { TrackingService } from "./tracking";

export function createProductionServices() {
	const store = new DrizzleOrderStore(db);
	return {
		orderService: new OrderService(registry, store),
		trackingService: new TrackingService(registry, store),
		cancelService: new CancelService(registry, store),
	};
}

export function createProductionOrderService(): OrderService {
	return createProductionServices().orderService;
}

export { CancelService } from "./cancel";
export { OrderService } from "./orders";
export { MemoryOrderStore } from "./persistence/memory";
export { TrackingService } from "./tracking";
