import { createFileRoute } from '@tanstack/react-router';

import { BulkCreatePage } from '@/pages/bulk-create';

export const Route = createFileRoute('/bulk-create')({
  component: BulkCreatePage,
});
