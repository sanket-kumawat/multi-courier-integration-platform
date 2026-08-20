import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@multi-courier-integration-platform/ui/components/alert-dialog";
import { Button } from "@multi-courier-integration-platform/ui/components/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/shared/api";
import { toastApiError } from "@/shared/lib";

type CancelOrderDialogProps = {
	orderId: string;
	enabled: boolean;
};

export function CancelOrderDialog({ orderId, enabled }: CancelOrderDialogProps) {
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);

	const cancelMutation = useMutation({
		...orpc.cancelOrder.mutationOptions(),
		onSuccess: async (result) => {
			toast.success(`Cancelled ${result.order_id}`);
			setOpen(false);
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: orpc.getOrder.queryKey({ input: { order_id: orderId } }),
				}),
				queryClient.invalidateQueries({
					queryKey: orpc.trackOrder.queryKey({ input: { order_id: orderId } }),
				}),
			]);
		},
		onError: (error) => {
			toastApiError(error);
		},
	});

	const confirmCancel = () => {
		cancelMutation.mutate({ order_id: orderId });
	};

	if (!enabled) {
		return (
			<Button type="button" variant="destructive" size="sm" disabled>
				Cancel shipment
			</Button>
		);
	}

	return (
		<AlertDialog
			open={open}
			onOpenChange={(next) => {
				if (cancelMutation.isPending) {
					return;
				}
				setOpen(next);
			}}
		>
			<AlertDialogTrigger
				render={<Button type="button" variant="destructive" size="sm" />}
			>
				Cancel shipment
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Cancel this shipment?</AlertDialogTitle>
					<AlertDialogDescription>
						Calls cancelOrder for{" "}
						<code className="text-foreground">{orderId}</code>. Allowed only while
						status is PENDING, CREATED, or FAILED. This cannot be undone from the
						ops UI.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={cancelMutation.isPending}>
						Keep shipment
					</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						disabled={cancelMutation.isPending}
						onClick={(event) => {
							event.preventDefault();
							confirmCancel();
						}}
					>
						{cancelMutation.isPending ? (
							<Loader2 data-icon="inline-start" className="animate-spin" />
						) : null}
						Confirm cancel
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
