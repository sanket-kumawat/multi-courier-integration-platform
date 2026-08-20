import { createFileRoute } from '@tanstack/react-router';

import { Lookup } from '@/pages/lookup';

export const Route = createFileRoute('/lookup')({
  component: Lookup,
});
