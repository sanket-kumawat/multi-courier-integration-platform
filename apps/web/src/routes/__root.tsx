import type { AppRouterClient } from '@multi-courier-integration-platform/api/routers/index';
import { Toaster } from '@multi-courier-integration-platform/ui/components/sonner';
import { createORPCClient } from '@orpc/client';
import { createTanstackQueryUtils } from '@orpc/tanstack-query';
import type { QueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
} from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { useState } from 'react';

import { ThemeProvider } from '@/app/providers';
import { Header } from '@/app/ui';
import { link, orpc } from '@/shared/api';

import '@/app/styles/index.css';

export interface RouterAppContext {
  orpc: typeof orpc;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
  head: () => ({
    meta: [
      {
        title: 'Courier ops demo',
      },
      {
        name: 'description',
        content:
          'Demo UI for the Multi-Courier Integration Platform — create, look up, and bulk shipments.',
      },
    ],
    links: [
      {
        rel: 'icon',
        href: '/favicon.ico',
      },
    ],
  }),
});

function RootComponent() {
  const [client] = useState<AppRouterClient>(() => createORPCClient(link));
  const [orpcUtils] = useState(() => createTanstackQueryUtils(client));

  return (
    <>
      <HeadContent />
      <ThemeProvider
        attribute='class'
        defaultTheme='dark'
        disableTransitionOnChange
        storageKey='vite-ui-theme'
      >
        <div className='grid h-svh grid-rows-[auto_1fr]'>
          <Header />
          <Outlet />
        </div>
        <Toaster richColors />
      </ThemeProvider>
      <TanStackRouterDevtools position='bottom-left' />
      <ReactQueryDevtools
        position='bottom'
        buttonPosition='bottom-right'
      />
    </>
  );
}
