"use client";

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import AuthGuard from '@/components/auth-guard';
import { useAuth } from '@/lib/auth';

export default function HomePage() {
  const { user, logout } = useAuth();
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
          <Button variant="outline" onClick={logout}>Logout</Button>
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
