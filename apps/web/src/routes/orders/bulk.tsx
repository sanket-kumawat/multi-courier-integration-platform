import { createFileRoute } from "@tanstack/react-router";

import { BulkCreatePage } from "@/pages/orders/bulk";

export const Route = createFileRoute("/orders/bulk")({
	component: BulkCreatePage,
});
