import { registry } from "@multi-courier-integration-platform/couriers";
import { db } from "@multi-courier-integration-platform/db";
import { DrizzleOrderStore } from "./drizzle-order-store";
import { OrderService } from "./order-service";

export function createProductionOrderService(): OrderService {
	return new OrderService(registry, new DrizzleOrderStore(db));
}

export { OrderService } from "./order-service";
export { MemoryOrderStore } from "./order-store";
