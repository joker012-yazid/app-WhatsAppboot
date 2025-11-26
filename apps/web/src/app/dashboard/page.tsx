"use client";

import AuthGuard from '@/components/auth-guard';
import { useAuth } from '@/lib/auth';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <AuthGuard>
      <section className="space-y-4 rounded-xl border bg-card px-6 py-8 shadow-sm">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {user?.name || user?.email}.</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Status</p>
            <p className="text-lg font-semibold">Authenticated as {user?.role}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Next steps</p>
            <ul className="list-disc pl-5 text-sm text-muted-foreground">
              <li>Wire protected API routes</li>
              <li>Add customer list view</li>
              <li>Hook login form to role-based UI</li>
            </ul>
          </div>
        </div>
      </section>
    </AuthGuard>
  );
}

