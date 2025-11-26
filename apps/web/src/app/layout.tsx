import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Space_Grotesk } from 'next/font/google';
import './globals.css';

import { ThemeToggle } from '@/components/theme-toggle';
import { Providers } from './providers';
import Link from 'next/link';
import { UserMenu } from '@/components/user-menu';

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
      <body className={`${fontSans.variable} min-h-screen bg-background font-sans text-foreground`}>
        <Providers>
          <div className="flex min-h-screen flex-col">
            <header className="border-b">
              <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
                <div className="flex items-baseline gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Phase 1</p>
                    <p className="text-lg font-semibold">WhatsApp Bot POS SuperApp</p>
                  </div>
                  <nav className="hidden sm:flex items-center gap-3 text-sm">
                    <Link href="/" className="text-muted-foreground hover:text-foreground">Home</Link>
                    <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">Dashboard</Link>
                    <Link href="/docs/roadmap" className="text-muted-foreground hover:text-foreground">Roadmap</Link>
                  </nav>
                </div>
                <div className="flex items-center gap-2">
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
