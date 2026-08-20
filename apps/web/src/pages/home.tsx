import { ORDER_STATUSES } from '@multi-courier-integration-platform/api/dto/orders';
import { Button } from '@multi-courier-integration-platform/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@multi-courier-integration-platform/ui/components/card';
import { Separator } from '@multi-courier-integration-platform/ui/components/separator';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import { CourierSelect } from '@/shared/components/courier-select';
import { StatusBadge } from '@/shared/components/status-badge';
import { orpc } from '@/utils/orpc';

const quickLinks = [
  {
    to: '/create' as const,
    title: 'Create',
    description: 'Submit a single shipment through a registered courier.',
  },
  {
    to: '/lookup' as const,
    title: 'Look up',
    description: 'Get, track, or cancel an order by consumer order id.',
  },
  {
    to: '/bulk-create' as const,
    title: 'Bulk',
    description: 'Queue up to 100 creates and poll the batch result.',
  },
];

export function Home() {
  const healthCheck = useQuery(orpc.healthCheck.queryOptions());
  const [courier, setCourier] = useState<string | null>(null);

  const healthLabel = healthCheck.isLoading
    ? 'Checking…'
    : healthCheck.data
      ? 'Connected'
      : 'Disconnected';

  return (
    <main className='mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8'>
      <div className='flex flex-col gap-1'>
        <h1 className='font-medium text-xl tracking-tight'>Operations demo</h1>
        <p className='text-muted-foreground text-sm'>
          Showcase the courier-agnostic API: create, look up, and bulk — without
          partner payload shapes.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API status</CardTitle>
          <CardDescription>
            Process health from the server. Does not check partners.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex items-center gap-2'>
            <span
              className={`size-2 rounded-full ${
                healthCheck.data ? 'bg-primary' : 'bg-destructive'
              }`}
              aria-hidden
            />
            <span className='text-sm'>{healthLabel}</span>
          </div>
        </CardContent>
      </Card>

      <section className='flex flex-col gap-3'>
        <h2 className='font-medium text-sm'>Workflows</h2>
        <div className='flex flex-col gap-3'>
          {quickLinks.map((link) => (
            <div
              key={link.to}
              className='flex flex-col gap-2 border border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between'
            >
              <div className='flex flex-col gap-0.5'>
                <span className='font-medium text-sm'>{link.title}</span>
                <span className='text-muted-foreground text-xs'>
                  {link.description}
                </span>
              </div>
              <Button
                variant='outline'
                size='sm'
                render={<Link to={link.to} />}
              >
                Open
              </Button>
            </div>
          ))}
        </div>
      </section>

      <Separator />

      <section className='flex flex-col gap-4'>
        <div className='flex flex-col gap-1'>
          <h2 className='font-medium text-sm'>Registered couriers</h2>
          <p className='text-muted-foreground text-xs'>
            Fed by <code className='text-foreground'>listCouriers</code>. Valid{' '}
            <code className='text-foreground'>courier_partner</code> values for
            create and bulk.
          </p>
        </div>
        <CourierSelect
          value={courier}
          onValueChange={setCourier}
        />
        {courier ? (
          <p className='text-muted-foreground text-xs'>
            Selected: <span className='text-foreground'>{courier}</span>
          </p>
        ) : null}
      </section>

      <section className='flex flex-col gap-3'>
        <h2 className='font-medium text-sm'>Canonical statuses</h2>
        <div className='flex flex-wrap gap-2'>
          {ORDER_STATUSES.map((status) => (
            <StatusBadge
              key={status}
              status={status}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
