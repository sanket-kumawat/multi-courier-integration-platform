import type { CourierAdapter, CourierPartnerId } from "./contract";
import { UnknownCourierError } from "./errors";

export class CourierRegistry {
	private readonly adapters = new Map<CourierPartnerId, CourierAdapter>();

	register(adapter: CourierAdapter): void {
		if (this.adapters.has(adapter.id)) {
			throw new Error(`Courier adapter '${adapter.id}' is already registered`);
		}
		this.adapters.set(adapter.id, adapter);
	}

	get(id: CourierPartnerId): CourierAdapter {
		const adapter = this.adapters.get(id);
		if (!adapter) {
			throw new UnknownCourierError(id, this.list());
		}
		return adapter;
	}

	list(): CourierPartnerId[] {
		return [...this.adapters.keys()].sort();
	}
}
