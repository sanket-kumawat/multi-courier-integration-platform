import type { TrackOrderResponse } from "@multi-courier-integration-platform/api/dto/orders";
import { StatusBadge } from "@/entities/order";

type TrackingTimelineProps = {
	history: TrackOrderResponse["history"];
};

function formatTimestamp(value: string): string {
	return new Date(value).toLocaleString();
}

export function TrackingTimeline({ history }: TrackingTimelineProps) {
	if (history.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">
				No tracking events yet. Refresh tracking to pull from the courier.
			</p>
		);
	}

	return (
		<ol className="flex flex-col gap-0 border-border border-l pl-4">
			{history.map((event, index) => (
				<li
					key={`${event.occurred_at}-${event.status}-${index}`}
					className="relative pb-5 last:pb-0"
				>
					<span
						className="absolute top-1.5 -left-5.25 size-2.5 rounded-full border border-background bg-foreground"
						aria-hidden
					/>
					<div className="flex flex-col gap-1.5">
						<div className="flex flex-wrap items-center gap-2">
							<StatusBadge status={event.status} />
							<time
								className="text-muted-foreground text-xs tabular-nums"
								dateTime={event.occurred_at}
							>
								{formatTimestamp(event.occurred_at)}
							</time>
						</div>
						<p className="text-sm">{event.description}</p>
						{event.location ? (
							<p className="text-muted-foreground text-xs">
								Location:{" "}
								<span className="text-foreground">{event.location}</span>
							</p>
						) : null}
					</div>
				</li>
			))}
		</ol>
	);
}
