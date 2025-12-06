'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { ReactNode, useState } from 'react';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/lib/auth';
import { ToastProvider } from '@/components/toast-provider';
import { ConfirmProvider } from '@/components/confirm-provider';

export const Providers = ({ children }: { children: ReactNode }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange={false}
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ToastProvider>
            <ConfirmProvider>
              {children}
              {/* Sonner Toast - Modern Toast Notifications */}
              <Toaster
                position="top-right"
                expand={true}
                richColors
                closeButton
                theme="system"
                toastOptions={{
                  style: {
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    color: 'hsl(var(--foreground))',
                  },
                  className: 'sonner-toast',
                }}
              />
            </ConfirmProvider>
          </ToastProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
};
