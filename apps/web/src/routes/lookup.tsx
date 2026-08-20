import { createFileRoute } from '@tanstack/react-router';

import { LookupPage } from '@/pages/lookup';

export const Route = createFileRoute('/lookup')({
  component: LookupPage,
});
