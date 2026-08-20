import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@multi-courier-integration-platform/ui/components/card';
import { Link } from '@tanstack/react-router';

export function Lookup() {
  return (
    <main className='mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8'>
      <div className='flex flex-col gap-1'>
        <h1 className='font-medium text-xl tracking-tight'>Look up order</h1>
        <p className='text-muted-foreground text-sm'>
          Get, track, and cancel by consumer{' '}
          <code className='text-foreground'>order_id</code> lands in a later
          phase.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Coming next</CardTitle>
          <CardDescription>
            This route is wired for navigation. Lookup will call get, track, and
            cancel procedures.
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
