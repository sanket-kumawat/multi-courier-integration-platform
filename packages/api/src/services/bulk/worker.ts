import pLimit from "p-limit";
import { AppError } from "../../errors";
import type { OrderService } from "../orders";
import type { BulkStore, ClaimedBatchItem } from "./store";

export type BulkWorkerOptions = {
	store: BulkStore;
	orderService: OrderService;
	concurrency: number;
	staleMs: number;
};

export class BulkWorker {
	private readonly store: BulkStore;
	private readonly orderService: OrderService;
	private readonly concurrency: number;
	private readonly staleMs: number;
	private running = false;
	private timer: ReturnType<typeof setInterval> | undefined;

	constructor(options: BulkWorkerOptions) {
		this.store = options.store;
		this.orderService = options.orderService;
		this.concurrency = Math.max(1, options.concurrency);
		this.staleMs = options.staleMs;
	}

	start(options: { intervalMs: number }): void {
		if (this.timer) {
			return;
		}
		void this.tick();
		this.timer = setInterval(() => {
			void this.tick();
		}, options.intervalMs);
		this.timer.unref?.();
	}

	stop(): void {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = undefined;
		}
	}

	async tick(): Promise<void> {
		if (this.running) {
			return;
		}
		this.running = true;
		try {
			await this.store.reclaimStale(this.staleMs);
			const claimed = await this.store.claimQueued(this.concurrency);
			if (claimed.length === 0) {
				return;
			}
			const limit = pLimit(this.concurrency);
			await Promise.all(
				claimed.map((item) => limit(() => this.processItem(item))),
			);
		} finally {
			this.running = false;
		}
	}

	private async processItem(item: ClaimedBatchItem): Promise<void> {
		try {
			await this.orderService.create(item.payload, {
				requestId: `bulk:${item.batchId}:${item.orderId}`,
			});
			await this.store.completeItem(item.id, { success: true });
		} catch (error) {
			const app =
				error instanceof AppError
					? error
					: new AppError("INTERNAL_ERROR", "An unexpected error occurred");
			await this.store.completeItem(item.id, {
				success: false,
				errorCode: app.code,
				errorMessage: app.message,
			});
		}
	}
}
