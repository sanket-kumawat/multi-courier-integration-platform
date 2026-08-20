import { Separator } from '@multi-courier-integration-platform/ui/components/separator';
import { Link } from '@tanstack/react-router';

import { ModeToggle } from './mode-toggle';

const links = [
  { to: '/', label: 'Home' },
  { to: '/orders/new', label: 'Create' },
  { to: '/lookup', label: 'Look up' },
  { to: '/bulk-create', label: 'Bulk' },
] as const;

export function Header() {
  return (
    <header>
      <div className='flex flex-row items-center justify-between gap-4 px-4 py-2'>
        <nav
          className='flex flex-wrap items-center gap-4 text-sm'
          aria-label='Primary'
        >
          {links.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className='text-muted-foreground transition-colors hover:text-foreground [&.active]:font-medium [&.active]:text-foreground'
              activeOptions={{ exact: to === '/' }}
            >
              {label}
            </Link>
          ))}
        </nav>
        <ModeToggle />
      </div>
      <Separator />
    </header>
  );
}
