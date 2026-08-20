import { createFileRoute } from '@tanstack/react-router';

import { OrderDetailPage } from '@/pages/orders/detail';

export const Route = createFileRoute('/orders/$orderId')({
  component: OrderDetailRoute,
});

function OrderDetailRoute() {
  const { orderId } = Route.useParams();
  return <OrderDetailPage orderId={orderId} />;
}
