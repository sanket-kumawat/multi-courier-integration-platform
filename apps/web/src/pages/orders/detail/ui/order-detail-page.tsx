import { Button } from "@multi-courier-integration-platform/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@multi-courier-integration-platform/ui/components/card";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@multi-courier-integration-platform/ui/components/empty";
import { Skeleton } from "@multi-courier-integration-platform/ui/components/skeleton";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Loader2, PackageSearchIcon, RefreshCwIcon } from "lucide-react";
import { useEffect } from "react";

import { StatusBadge } from "@/entities/order";
import { orpc } from "@/shared/api";
import { getApiErrorCode, toastApiError } from "@/shared/lib";

import { StaleTrackingBanner } from "./stale-tracking-banner";
import { TrackingTimeline } from "./tracking-timeline";

type OrderDetailPageProps = {
	orderId: string;
};

const TERMINAL_STATUSES = new Set([
	"DELIVERED",
	"CANCELLED",
	"RTO",
	"FAILED",
]);

const TRACK_POLL_MS = 30_000;

function formatTimestamp(value: string): string {
	return new Date(value).toLocaleString();
}

export function OrderDetailPage({ orderId }: OrderDetailPageProps) {
	const queryClient = useQueryClient();

	const orderQuery = useQuery({
		...orpc.getOrder.queryOptions({
			input: { order_id: orderId },
		}),
		meta: { skipGlobalErrorToast: true },
		retry: (failureCount, error) =>
			getApiErrorCode(error) !== "ORDER_NOT_FOUND" && failureCount < 2,
	});

	const canTrack = Boolean(orderQuery.data?.awb);

	const trackQuery = useQuery({
		...orpc.trackOrder.queryOptions({
			input: { order_id: orderId },
		}),
		enabled: canTrack,
		meta: { skipGlobalErrorToast: true },
		refetchInterval: (query) => {
			const status = query.state.data?.status;
			if (status && TERMINAL_STATUSES.has(status)) {
				return false;
			}
			return TRACK_POLL_MS;
		},
		refetchIntervalInBackground: false,
		retry: (failureCount, error) => {
			const code = getApiErrorCode(error);
			if (
				code === "ORDER_NOT_FOUND" ||
				code === "COURIER_UNAVAILABLE" ||
				code === "COURIER_AUTH_FAILED"
			) {
				return false;
			}
			return failureCount < 2;
		},
	});

	useEffect(() => {
		if (!orderQuery.isError) {
			return;
		}
		if (getApiErrorCode(orderQuery.error) === "ORDER_NOT_FOUND") {
			return;
		}
		toastApiError(orderQuery.error);
	}, [orderQuery.error, orderQuery.isError]);

	useEffect(() => {
		if (!trackQuery.isError) {
			return;
		}
		const code = getApiErrorCode(trackQuery.error);
		if (code === "ORDER_NOT_FOUND") {
			return;
		}
		toastApiError(trackQuery.error);
	}, [trackQuery.error, trackQuery.isError]);

	useEffect(() => {
		if (!trackQuery.isSuccess || !trackQuery.data) {
			return;
		}
		void queryClient.invalidateQueries({
			queryKey: orpc.getOrder.queryKey({ input: { order_id: orderId } }),
		});
	}, [orderId, queryClient, trackQuery.dataUpdatedAt, trackQuery.isSuccess]);

	const refreshTracking = () => {
		void trackQuery.refetch();
	};

	if (orderQuery.isPending) {
		return (
			<main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
				<Skeleton className="h-8 w-56" />
				<Skeleton className="h-4 w-72" />
				<Skeleton className="h-48 w-full" />
			</main>
		);
	}

	if (orderQuery.isError || !orderQuery.data) {
		const notFound = getApiErrorCode(orderQuery.error) === "ORDER_NOT_FOUND";

		return (
			<main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
				<Empty className="border border-border">
					<EmptyHeader>
						<PackageSearchIcon className="size-8 text-muted-foreground" />
						<EmptyTitle>
							{notFound ? "Order not found" : "Could not load order"}
						</EmptyTitle>
						<EmptyDescription>
							{notFound ? (
								<>
									No persisted order for{" "}
									<code className="text-foreground">{orderId}</code>. getOrder
									reads the database only — it never calls the courier.
								</>
							) : (
								<>
									Something went wrong loading{" "}
									<code className="text-foreground">{orderId}</code>.
								</>
							)}
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<div className="flex flex-wrap items-center justify-center gap-3">
							<Button render={<Link to="/orders/new" />}>Create order</Button>
							<Button variant="outline" render={<Link to="/lookup" />}>
								Look up another
							</Button>
						</div>
					</EmptyContent>
				</Empty>
			</main>
		);
	}

	const order = orderQuery.data;
	const tracking = trackQuery.data;
	const displayStatus = tracking?.status ?? order.status;
	const trackErrorCode = trackQuery.isError
		? getApiErrorCode(trackQuery.error)
		: null;

	return (
		<main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
			<div className="flex flex-col gap-2">
				<div className="flex flex-wrap items-center gap-3">
					<h1 className="font-medium text-xl tracking-tight">{order.order_id}</h1>
					<StatusBadge status={displayStatus} />
				</div>
				<p className="text-muted-foreground text-sm">
					Shipment card is getOrder (database). Tracking below calls the courier
					on refresh — there are no webhooks in v1.
				</p>
			</div>

			{tracking?.stale ? <StaleTrackingBanner /> : null}

			<Card>
				<CardHeader>
					<CardTitle>Shipment</CardTitle>
					<CardDescription>
						Consumer order id is the primary key in the ops UI. Platform UUIDs
						stay off the primary surface.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<dl className="grid gap-4 text-sm sm:grid-cols-2">
						<div className="flex flex-col gap-0.5">
							<dt className="text-muted-foreground">Status</dt>
							<dd>
								<StatusBadge status={displayStatus} />
							</dd>
						</div>
						<div className="flex flex-col gap-0.5">
							<dt className="text-muted-foreground">Courier partner</dt>
							<dd className="font-medium">{order.courier_partner}</dd>
						</div>
						<div className="flex flex-col gap-0.5">
							<dt className="text-muted-foreground">AWB</dt>
							<dd className="font-medium tabular-nums">
								{tracking?.awb ?? order.awb ?? "—"}
							</dd>
						</div>
						<div className="flex flex-col gap-0.5">
							<dt className="text-muted-foreground">Courier shipment id</dt>
							<dd className="font-medium tabular-nums">
								{order.courier_shipment_id ?? "—"}
							</dd>
						</div>
						<div className="flex flex-col gap-0.5">
							<dt className="text-muted-foreground">Created</dt>
							<dd className="tabular-nums">
								{formatTimestamp(order.created_at)}
							</dd>
						</div>
						<div className="flex flex-col gap-0.5">
							<dt className="text-muted-foreground">Updated</dt>
							<dd className="tabular-nums">
								{formatTimestamp(order.updated_at)}
							</dd>
						</div>
					</dl>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
					<div className="flex flex-col gap-1">
						<CardTitle>Tracking</CardTitle>
						<CardDescription>
							Pull-based history via trackOrder. Light poll every 30s while this
							page stays open (paused in background / terminal statuses).
						</CardDescription>
					</div>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={!canTrack || trackQuery.isFetching}
						onClick={refreshTracking}
					>
						{trackQuery.isFetching ? (
							<Loader2 data-icon="inline-start" className="animate-spin" />
						) : (
							<RefreshCwIcon data-icon="inline-start" />
						)}
						Refresh tracking
					</Button>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					{!canTrack ? (
						<p className="text-muted-foreground text-sm">
							No AWB yet — tracking waits until the courier manifests the
							shipment.
						</p>
					) : trackQuery.isPending ? (
						<div className="flex flex-col gap-3">
							<Skeleton className="h-4 w-40" />
							<Skeleton className="h-24 w-full" />
						</div>
					) : trackQuery.isError ? (
						<p className="text-sm text-destructive">
							{trackErrorCode === "COURIER_UNAVAILABLE"
								? "Courier unavailable and no prior tracking history to show."
								: "Could not refresh tracking. Try again."}
						</p>
					) : tracking ? (
						<TrackingTimeline history={tracking.history} />
					) : null}
				</CardContent>
			</Card>

			<div className="flex flex-wrap gap-4 text-sm">
				<Link
					to="/orders/new"
					className="text-primary underline-offset-4 hover:underline"
				>
					Create another
				</Link>
				<Link
					to="/lookup"
					className="text-muted-foreground underline-offset-4 hover:underline"
				>
					Look up
				</Link>
				<Link
					to="/"
					className="text-muted-foreground underline-offset-4 hover:underline"
				>
					Dashboard
				</Link>
			</div>
		</main>
	);
}
