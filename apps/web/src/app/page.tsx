"use client";

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import AuthGuard from '@/components/auth-guard';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/toast-provider';

export default function HomePage() {
  const { user, logout } = useAuth();
  const toast = useToast();
  return (
    <AuthGuard>
      <section className="space-y-6 rounded-xl border bg-card px-6 py-8 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.35em] text-muted-foreground">Foundation</p>
            <h1 className="text-3xl font-bold">Developer Control Room</h1>
            <p className="text-muted-foreground">
              Authenticated as <span className="font-medium">{user?.email}</span> ({user?.role})
            </p>
          </div>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await logout();
                toast.success('Logged out');
              } catch (e: any) {
                toast.error(e?.message || 'Logout failed');
              }
            }}
          >
            Logout
          </Button>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/docs/roadmap">View Roadmap</Link>
          </Button>
        </div>
      </section>
    </AuthGuard>
  );
}
