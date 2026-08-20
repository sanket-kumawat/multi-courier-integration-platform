import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@multi-courier-integration-platform/ui/components/card';
import { Link } from '@tanstack/react-router';

import { OrderLookupForm } from '@/features/lookup-order';

export function LookupPage() {
  return (
    <main className='mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8'>
      <div className='flex flex-col gap-1'>
        <h1 className='font-medium text-xl tracking-tight'>Look up order</h1>
        <p className='text-muted-foreground text-sm'>
          Open a shipment by consumer{' '}
          <code className='text-foreground'>order_id</code>. Detail uses
          getOrder (database only).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Find order</CardTitle>
          <CardDescription>
            Enter the same id used at create. You will land on{' '}
            <code className='text-foreground'>/orders/$orderId</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OrderLookupForm />
        </CardContent>
      </Card>

      <p className='text-muted-foreground text-sm'>
        Need a new shipment?{' '}
        <Link
          to='/orders/new'
          className='text-primary underline-offset-4 hover:underline'
        >
          Create order
        </Link>
      </p>
    </main>
  );
}
