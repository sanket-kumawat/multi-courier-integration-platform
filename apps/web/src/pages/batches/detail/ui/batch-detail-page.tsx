import type { BatchResponse } from "@multi-courier-integration-platform/api/dto/batches";
import { Badge } from "@multi-courier-integration-platform/ui/components/badge";
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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@multi-courier-integration-platform/ui/components/table";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2, PackageSearchIcon } from "lucide-react";
import { useEffect } from "react";

import { StatusBadge } from "@/entities/order";
import { orpc } from "@/shared/api";
import { getApiErrorCode, toastApiError } from "@/shared/lib";

type BatchDetailPageProps = {
	batchId: string;
};

const POLL_MS = 2_500;

const TERMINAL_BATCH = new Set(["COMPLETED", "FAILED"]);

function formatTimestamp(value: string | null): string {
	if (!value) {
		return "—";
	}
	return new Date(value).toLocaleString();
}

function ProgressStat({
	label,
	value,
}: {
	label: string;
	value: number;
}) {
	return (
		<div className="flex flex-col gap-0.5">
			<dt className="text-muted-foreground text-xs">{label}</dt>
			<dd className="font-medium tabular-nums text-lg">{value}</dd>
		</div>
	);
}

function BatchStatusBadge({ status }: { status: BatchResponse["status"] }) {
	const variant =
		status === "FAILED"
			? "destructive"
			: status === "COMPLETED"
				? "default"
				: status === "PROCESSING"
					? "secondary"
					: "outline";

	return <Badge variant={variant}>{status}</Badge>;
}

export function BatchDetailPage({ batchId }: BatchDetailPageProps) {
	const navigate = useNavigate();

	const batchQuery = useQuery({
		...orpc.getBatch.queryOptions({
			input: { batch_id: batchId },
		}),
		meta: { skipGlobalErrorToast: true },
		refetchInterval: (query) => {
			const status = query.state.data?.status;
			if (status && TERMINAL_BATCH.has(status)) {
				return false;
			}
			return POLL_MS;
		},
		refetchIntervalInBackground: false,
		retry: (failureCount, error) =>
			getApiErrorCode(error) !== "ORDER_NOT_FOUND" && failureCount < 2,
	});

	useEffect(() => {
		if (!batchQuery.isError) {
			return;
		}
		if (getApiErrorCode(batchQuery.error) === "ORDER_NOT_FOUND") {
			return;
		}
		toastApiError(batchQuery.error);
	}, [batchQuery.error, batchQuery.isError]);

	if (batchQuery.isPending) {
		return (
			<main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
				<Skeleton className="h-8 w-64" />
				<Skeleton className="h-4 w-80" />
				<Skeleton className="h-40 w-full" />
			</main>
		);
	}

	if (batchQuery.isError || !batchQuery.data) {
		const notFound = getApiErrorCode(batchQuery.error) === "ORDER_NOT_FOUND";

		return (
			<main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
				<Empty className="border border-border">
					<EmptyHeader>
						<PackageSearchIcon className="size-8 text-muted-foreground" />
						<EmptyTitle>
							{notFound ? "Batch not found" : "Could not load batch"}
						</EmptyTitle>
						<EmptyDescription>
							{notFound ? (
								<>
									No batch for <code className="text-foreground">{batchId}</code>.
								</>
							) : (
								<>Something went wrong loading this batch.</>
							)}
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button render={<Link to="/orders/bulk" />}>Bulk create</Button>
					</EmptyContent>
				</Empty>
			</main>
		);
	}

	const batch = batchQuery.data;
	const isPolling = !TERMINAL_BATCH.has(batch.status);
	const showResults = batch.status === "COMPLETED";

	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
			<div className="flex flex-col gap-2">
				<div className="flex flex-wrap items-center gap-3">
					<h1 className="font-medium text-xl tracking-tight">{batch.batch_id}</h1>
					<BatchStatusBadge status={batch.status} />
					{isPolling ? (
						<span className="inline-flex items-center gap-1.5 text-muted-foreground text-xs">
							<Loader2 className="size-3.5 animate-spin" />
							Polling every {POLL_MS / 1000}s
						</span>
					) : null}
				</div>
				<p className="text-muted-foreground text-sm">
					getBatch while QUEUED / PROCESSING. Results stay empty until
					COMPLETED — then open any row for the order detail.
				</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Progress</CardTitle>
					<CardDescription>
						Created {formatTimestamp(batch.created_at)}
						{batch.completed_at
							? ` · Completed ${formatTimestamp(batch.completed_at)}`
							: null}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
						<ProgressStat label="Total" value={batch.total} />
						<ProgressStat label="Succeeded" value={batch.succeeded} />
						<ProgressStat label="Failed" value={batch.failed} />
						<ProgressStat label="Pending" value={batch.pending} />
					</dl>
				</CardContent>
			</Card>

			{batch.status === "FAILED" ? (
				<p className="text-destructive text-sm">
					Batch worker failed before finishing. Remaining items may be reclaimed
					on the next tick — refresh or check the API.
				</p>
			) : null}

			{showResults ? (
				<Card>
					<CardHeader>
						<CardTitle>Results</CardTitle>
						<CardDescription>
							Per-order outcomes. Click a row to open getOrder for that consumer
							id.
						</CardDescription>
					</CardHeader>
					<CardContent>
						{batch.results.length === 0 ? (
							<p className="text-muted-foreground text-sm">
								No per-order rows returned for this batch.
							</p>
						) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead className="w-12">#</TableHead>
									<TableHead>Order id</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>AWB</TableHead>
									<TableHead>Outcome</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{batch.results.map((row) => (
									<TableRow
										key={`${row.position}-${row.order_id}`}
										className="cursor-pointer"
										tabIndex={0}
										onClick={() => {
											void navigate({
												to: "/orders/$orderId",
												params: { orderId: row.order_id },
											});
										}}
										onKeyDown={(event) => {
											if (event.key === "Enter" || event.key === " ") {
												event.preventDefault();
												void navigate({
													to: "/orders/$orderId",
													params: { orderId: row.order_id },
												});
											}
										}}
									>
										<TableCell className="tabular-nums text-muted-foreground">
											{row.position}
										</TableCell>
										<TableCell className="font-medium">{row.order_id}</TableCell>
										<TableCell>
											<StatusBadge status={row.status} />
										</TableCell>
										<TableCell className="tabular-nums">
											{row.awb ?? "—"}
										</TableCell>
										<TableCell>
											{row.success ? (
												<span className="text-muted-foreground">OK</span>
											) : (
												<span className="text-destructive">
													{row.error
														? `${row.error.code}: ${row.error.message}`
														: "Failed"}
												</span>
											)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
						)}
					</CardContent>
				</Card>
			) : isPolling ? (
				<p className="text-muted-foreground text-sm">
					Results stay empty until the batch completes (
					<code className="text-foreground">results: []</code> while QUEUED /
					PROCESSING).
				</p>
			) : null}

			<div className="flex flex-wrap gap-4 text-sm">
				<Link
					to="/orders/bulk"
					className="text-primary underline-offset-4 hover:underline"
				>
					New bulk
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
