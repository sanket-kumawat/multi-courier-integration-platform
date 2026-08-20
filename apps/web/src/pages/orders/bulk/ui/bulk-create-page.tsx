import { bulkCreateSchema } from "@multi-courier-integration-platform/api/dto/orders";
import { Button } from "@multi-courier-integration-platform/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@multi-courier-integration-platform/ui/components/card";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldLabel,
} from "@multi-courier-integration-platform/ui/components/field";
import { Textarea } from "@multi-courier-integration-platform/ui/components/textarea";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/shared/api";
import { toastApiError } from "@/shared/lib";

import { formatSampleBulkJson } from "../model/sample-orders";
import { validateBulkJson } from "../model/validate-bulk-json";

export function BulkCreatePage() {
	const navigate = useNavigate();
	const [json, setJson] = useState("");
	const [clientError, setClientError] = useState<string | null>(null);
	const [clientDetails, setClientDetails] = useState<string[]>([]);

	const bulkMutation = useMutation({
		...orpc.createBulkOrders.mutationOptions(),
		onSuccess: (accepted) => {
			toast.success(
				`Batch ${accepted.batch_id} accepted (${accepted.accepted} orders)`,
			);
			void navigate({
				to: "/batches/$batchId",
				params: { batchId: accepted.batch_id },
			});
		},
		onError: (error) => {
			toastApiError(error);
		},
	});

	const useSample = () => {
		setJson(formatSampleBulkJson());
		setClientError(null);
		setClientDetails([]);
	};

	const submit = () => {
		const result = validateBulkJson(json);
		if (!result.ok) {
			setClientError(result.error.message);
			setClientDetails(result.error.details ?? []);
			toast.error(`VALIDATION_ERROR: ${result.error.message}`);
			return;
		}

		const parsed = bulkCreateSchema.safeParse({ orders: result.orders });
		if (!parsed.success) {
			const details = parsed.error.issues.map(
				(issue) => `${issue.path.join(".") || "orders"}: ${issue.message}`,
			);
			setClientError("Request validation failed");
			setClientDetails(details.slice(0, 8));
			toast.error("VALIDATION_ERROR: Fix the highlighted payload");
			return;
		}

		setClientError(null);
		setClientDetails([]);
		bulkMutation.mutate(parsed.data);
	};

	return (
		<main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
			<div className="flex flex-col gap-1">
				<h1 className="font-medium text-xl tracking-tight">Bulk create</h1>
				<p className="text-muted-foreground text-sm">
					Submit 1–100 orders via createBulkOrders. Returns{" "}
					<code className="text-foreground">202</code> with a batch id — poll
					getBatch until COMPLETED.
				</p>
			</div>

			<Card>
				<CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
					<div className="flex flex-col gap-1">
						<CardTitle>Orders JSON</CardTitle>
						<CardDescription>
							Same schema as single create, wrapped in{" "}
							<code className="text-foreground">{"{ orders: [...] }"}</code>.
							Client checks length and duplicate order_id before enqueue.
						</CardDescription>
					</div>
					<Button type="button" variant="outline" size="sm" onClick={useSample}>
						Use sample
					</Button>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<Field data-invalid={clientError ? true : undefined}>
						<FieldLabel htmlFor="bulk-orders-json">Payload</FieldLabel>
						<Textarea
							id="bulk-orders-json"
							value={json}
							onChange={(event) => {
								setJson(event.target.value);
								if (clientError) {
									setClientError(null);
									setClientDetails([]);
								}
							}}
							spellCheck={false}
							aria-invalid={clientError ? true : undefined}
							className="min-h-64 resize-y font-mono text-xs leading-relaxed"
							placeholder='{ "orders": [ /* createOrderSchema… */ ] }'
						/>
						<FieldDescription>
							Sample loads 20 mock orders (~95/5): one order_id contains FAIL so
							the mock courier rejects it.
						</FieldDescription>
						{clientError ? (
							<FieldError>
								{clientError}
								{clientDetails.length > 0 ? (
									<ul className="mt-1 list-disc pl-4">
										{clientDetails.map((detail) => (
											<li key={detail}>{detail}</li>
										))}
									</ul>
								) : null}
							</FieldError>
						) : null}
					</Field>

					<div className="flex flex-wrap items-center gap-3">
						<Button
							type="button"
							disabled={bulkMutation.isPending}
							onClick={submit}
						>
							{bulkMutation.isPending ? (
								<Loader2 data-icon="inline-start" className="animate-spin" />
							) : null}
							Submit batch
						</Button>
						<Link
							to="/"
							className="text-muted-foreground text-sm underline-offset-4 hover:underline"
						>
							Dashboard
						</Link>
					</div>
				</CardContent>
			</Card>
		</main>
	);
}
