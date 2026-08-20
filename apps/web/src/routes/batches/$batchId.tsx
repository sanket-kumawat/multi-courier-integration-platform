import { createFileRoute } from "@tanstack/react-router";

import { BatchDetailPage } from "@/pages/batches/detail";

export const Route = createFileRoute("/batches/$batchId")({
	component: BatchDetailRoute,
});

function BatchDetailRoute() {
	const { batchId } = Route.useParams();
	return <BatchDetailPage batchId={batchId} />;
}
