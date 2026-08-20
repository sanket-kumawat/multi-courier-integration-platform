import { createFileRoute } from '@tanstack/react-router';

import { BulkCreate } from '@/pages/bulk-create';

export const Route = createFileRoute('/bulk-create')({
  component: BulkCreate,
});
