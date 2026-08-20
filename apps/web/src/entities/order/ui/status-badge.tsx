import { ORDER_STATUSES } from '@multi-courier-integration-platform/api/dto/orders';
import { Badge } from '@multi-courier-integration-platform/ui/components/badge';
import type { ComponentProps } from 'react';

export type OrderStatus = (typeof ORDER_STATUSES)[number];

const STATUS_VARIANT: Record<
  OrderStatus,
  NonNullable<ComponentProps<typeof Badge>['variant']>
> = {
  PENDING: 'outline',
  CREATED: 'secondary',
  PICKED_UP: 'secondary',
  IN_TRANSIT: 'default',
  OUT_FOR_DELIVERY: 'default',
  DELIVERED: 'default',
  RTO: 'outline',
  CANCELLED: 'secondary',
  FAILED: 'destructive',
};

type StatusBadgeProps = {
  status: OrderStatus;
  className?: string;
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge
      variant={STATUS_VARIANT[status]}
      className={className}
    >
      {status}
    </Badge>
  );
}

export { ORDER_STATUSES };
