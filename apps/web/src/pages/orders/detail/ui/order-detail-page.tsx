import { Button } from '@multi-courier-integration-platform/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@multi-courier-integration-platform/ui/components/card';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@multi-courier-integration-platform/ui/components/empty';
import { Skeleton } from '@multi-courier-integration-platform/ui/components/skeleton';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { PackageSearchIcon } from 'lucide-react';
import { useEffect } from 'react';

import { StatusBadge } from '@/entities/order';
import { orpc } from '@/shared/api';
import { getApiErrorCode, toastApiError } from '@/shared/lib';

type OrderDetailPageProps = {
  orderId: string;
};

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString();
}

export function OrderDetailPage({ orderId }: OrderDetailPageProps) {
  const orderQuery = useQuery({
    ...orpc.getOrder.queryOptions({
      input: { order_id: orderId },
    }),
    meta: { skipGlobalErrorToast: true },
    retry: (failureCount, error) =>
      getApiErrorCode(error) !== 'ORDER_NOT_FOUND' && failureCount < 2,
  });

  useEffect(() => {
    if (!orderQuery.isError) {
      return;
    }
    if (getApiErrorCode(orderQuery.error) === 'ORDER_NOT_FOUND') {
      return;
    }
    toastApiError(orderQuery.error);
  }, [orderQuery.error, orderQuery.isError]);

  if (orderQuery.isPending) {
    return (
      <main className='mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8'>
        <Skeleton className='h-8 w-56' />
        <Skeleton className='h-4 w-72' />
        <Skeleton className='h-48 w-full' />
      </main>
    );
  }

  if (orderQuery.isError || !orderQuery.data) {
    const notFound = getApiErrorCode(orderQuery.error) === 'ORDER_NOT_FOUND';

    return (
      <main className='mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8'>
        <Empty className='border border-border'>
          <EmptyHeader>
            <PackageSearchIcon className='size-8 text-muted-foreground' />
            <EmptyTitle>
              {notFound ? 'Order not found' : 'Could not load order'}
            </EmptyTitle>
            <EmptyDescription>
              {notFound ? (
                <>
                  No persisted order for{' '}
                  <code className='text-foreground'>{orderId}</code>. getOrder
                  reads the database only — it never calls the courier.
                </>
              ) : (
                <>
                  Something went wrong loading{' '}
                  <code className='text-foreground'>{orderId}</code>.
                </>
              )}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <div className='flex flex-wrap items-center justify-center gap-3'>
              <Button render={<Link to='/orders/new' />}>Create order</Button>
              <Button
                variant='outline'
                render={<Link to='/lookup' />}
              >
                Look up another
              </Button>
            </div>
          </EmptyContent>
        </Empty>
      </main>
    );
  }

  const order = orderQuery.data;

  return (
    <main className='mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8'>
      <div className='flex flex-col gap-2'>
        <div className='flex flex-wrap items-center gap-3'>
          <h1 className='font-medium text-xl tracking-tight'>
            {order.order_id}
          </h1>
          <StatusBadge status={order.status} />
        </div>
        <p className='text-muted-foreground text-sm'>
          Persisted snapshot via getOrder. Refreshing this page does not call
          the courier partner.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Shipment</CardTitle>
          <CardDescription>
            Consumer order id is the primary key in the ops UI. Platform UUIDs
            stay off the primary surface.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className='grid gap-4 text-sm sm:grid-cols-2'>
            <div className='flex flex-col gap-0.5'>
              <dt className='text-muted-foreground'>Status</dt>
              <dd>
                <StatusBadge status={order.status} />
              </dd>
            </div>
            <div className='flex flex-col gap-0.5'>
              <dt className='text-muted-foreground'>Courier partner</dt>
              <dd className='font-medium'>{order.courier_partner}</dd>
            </div>
            <div className='flex flex-col gap-0.5'>
              <dt className='text-muted-foreground'>AWB</dt>
              <dd className='font-medium tabular-nums'>{order.awb ?? '—'}</dd>
            </div>
            <div className='flex flex-col gap-0.5'>
              <dt className='text-muted-foreground'>Courier shipment id</dt>
              <dd className='font-medium tabular-nums'>
                {order.courier_shipment_id ?? '—'}
              </dd>
            </div>
            <div className='flex flex-col gap-0.5'>
              <dt className='text-muted-foreground'>Created</dt>
              <dd className='tabular-nums'>
                {formatTimestamp(order.created_at)}
              </dd>
            </div>
            <div className='flex flex-col gap-0.5'>
              <dt className='text-muted-foreground'>Updated</dt>
              <dd className='tabular-nums'>
                {formatTimestamp(order.updated_at)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <div className='flex flex-wrap gap-4 text-sm'>
        <Link
          to='/orders/new'
          className='text-primary underline-offset-4 hover:underline'
        >
          Create another
        </Link>
        <Link
          to='/lookup'
          className='text-muted-foreground underline-offset-4 hover:underline'
        >
          Look up
        </Link>
        <Link
          to='/'
          className='text-muted-foreground underline-offset-4 hover:underline'
        >
          Dashboard
        </Link>
      </div>
    </main>
  );
}
