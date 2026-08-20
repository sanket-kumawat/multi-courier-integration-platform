import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@multi-courier-integration-platform/ui/components/card";
import { Skeleton } from "@multi-courier-integration-platform/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { StatusBadge } from "@/entities/order";
import { orpc } from "@/shared/api";

type OrderDetailPageProps = {
	orderId: string;
};

export function OrderDetailPage({ orderId }: OrderDetailPageProps) {
	const orderQuery = useQuery(
		orpc.getOrder.queryOptions({
			input: { order_id: orderId },
		}),
	);

	if (orderQuery.isPending) {
		return (
			<main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-40 w-full" />
			</main>
		);
	}

	if (orderQuery.isError || !orderQuery.data) {
		return (
			<main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
				<div className="flex flex-col gap-1">
					<h1 className="font-medium text-xl tracking-tight">Order not found</h1>
					<p className="text-muted-foreground text-sm">
						No order with id{" "}
						<code className="text-foreground">{orderId}</code>.
					</p>
				</div>
				<Link
					to="/orders/new"
					className="text-primary text-sm underline-offset-4 hover:underline"
				>
					Create another order
				</Link>
			</main>
		);
	}

	const order = orderQuery.data;

	return (
		<main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
			<div className="flex flex-col gap-1">
				<h1 className="font-medium text-xl tracking-tight">{order.order_id}</h1>
				<p className="text-muted-foreground text-sm">
					Persisted order from getOrder — no live courier call on this page.
				</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="flex flex-wrap items-center gap-2">
						Status <StatusBadge status={order.status} />
					</CardTitle>
					<CardDescription>
						Courier <code className="text-foreground">{order.courier_partner}</code>
					</CardDescription>
				</CardHeader>
				<CardContent>
					<dl className="grid gap-3 text-sm sm:grid-cols-2">
						<div className="flex flex-col gap-0.5">
							<dt className="text-muted-foreground">AWB</dt>
							<dd className="font-medium tabular-nums">
								{order.awb ?? "—"}
							</dd>
						</div>
						<div className="flex flex-col gap-0.5">
							<dt className="text-muted-foreground">Courier shipment id</dt>
							<dd className="font-medium tabular-nums">
								{order.courier_shipment_id ?? "—"}
							</dd>
						</div>
						<div className="flex flex-col gap-0.5">
							<dt className="text-muted-foreground">Internal id</dt>
							<dd className="font-mono text-xs">{order.internal_id}</dd>
						</div>
						<div className="flex flex-col gap-0.5">
							<dt className="text-muted-foreground">Updated</dt>
							<dd className="tabular-nums">
								{new Date(order.updated_at).toLocaleString()}
							</dd>
						</div>
					</dl>
				</CardContent>
			</Card>

			<div className="flex flex-wrap gap-4 text-sm">
				<Link
					to="/orders/new"
					className="text-primary underline-offset-4 hover:underline"
				>
					Create another
				</Link>
				<Link to="/" className="text-muted-foreground underline-offset-4 hover:underline">
					Dashboard
				</Link>
			</div>
		</main>
	);
}
