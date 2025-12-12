import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

import { Providers } from './providers';

// Using system fonts to avoid network requests during build
const fontSans = {
  variable: '--font-sans',
};

const fontMono = {
  variable: '--font-mono',
};

export const metadata: Metadata = {
  title: 'WhatsApp Bot POS SuperApp',
  description: 'Modern WhatsApp automation platform with repair shop management',
  keywords: ['WhatsApp', 'Bot', 'POS', 'Repair Shop', 'CRM'],
  authors: [{ name: 'SuperApp Team' }],
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fontSans.variable} ${fontMono.variable} min-h-screen bg-background font-sans text-foreground antialiased`}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
