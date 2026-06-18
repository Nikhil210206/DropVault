'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './theme-provider';
import { Toaster } from './ui/sonner';
import { makeQueryClient } from '@/lib/query-client';
import { bootstrap } from '@/features/auth/auth-api';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  // Attempt to restore the session once on mount (refresh-cookie → access token).
  useEffect(() => {
    void bootstrap();
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      <Toaster />
    </ThemeProvider>
  );
}
