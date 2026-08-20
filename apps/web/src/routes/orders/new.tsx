import { createFileRoute } from '@tanstack/react-router';

import { CreateOrderPage } from '@/pages/orders/new';

export const Route = createFileRoute('/orders/new')({
  component: CreateOrderPage,
});
