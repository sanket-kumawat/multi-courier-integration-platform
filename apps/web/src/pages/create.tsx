import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@multi-courier-integration-platform/ui/components/card';
import { Link } from '@tanstack/react-router';

export function Create() {
  return (
    <main className='mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8'>
      <div className='flex flex-col gap-1'>
        <h1 className='font-medium text-xl tracking-tight'>Create shipment</h1>
        <p className='text-muted-foreground text-sm'>
          Single-order create form lands in a later phase. Use the API or return
          home for now.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Coming next</CardTitle>
          <CardDescription>
            This route is wired for navigation. The create form will call{' '}
            <code className='text-foreground'>POST /api/v1/orders</code> via
            oRPC.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            to='/'
            className='text-primary text-sm underline-offset-4 hover:underline'
          >
            Back to dashboard
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
