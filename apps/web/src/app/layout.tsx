import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Space_Grotesk } from 'next/font/google';
import './globals.css';

import { ThemeToggle } from '@/components/theme-toggle';
import { Providers } from './providers';
import { UserMenu } from '@/components/user-menu';
import { TopNav } from '@/components/top-nav';

const fontSans = Space_Grotesk({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'WhatsApp Bot POS SuperApp',
  description: 'Phase 1 foundation stack for the WhatsApp automation platform',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fontSans.variable} min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 font-sans text-foreground`}
      >
        <Providers>
          <div className="flex min-h-screen flex-col">
            <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur">
              <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
                <div className="flex items-baseline gap-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Phase 1</p>
                    <p className="text-lg font-semibold text-slate-50">WhatsApp Bot POS SuperApp</p>
                  </div>
                  <TopNav />
                </div>
                <div className="flex items-center gap-3">
                  <ThemeToggle />
                  <UserMenu />
                </div>
              </div>
            </header>
            <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}


