'use client';

import { AppLayout } from '@/components/app-layout';

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}

