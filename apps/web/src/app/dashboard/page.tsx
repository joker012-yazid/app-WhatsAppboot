"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AuthGuard from '@/components/auth-guard';
import { useAuth } from '@/lib/auth';
import { apiGet } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/toast-provider';

type Stats = {
  customers: number;
  devices: number;
  jobs: number;
  jobsByStatus: {
    PENDING: number;
    QUOTED: number;
    APPROVED: number;
    IN_PROGRESS: number;
    COMPLETED: number;
    REJECTED: number;
  };
};

export default function DashboardPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await apiGet<Stats>('/api/health/stats');
        setStats(data);
      } catch (error: any) {
        console.error('[Dashboard] Failed to load stats:', error);
        const errorMessage = error?.message || 'Failed to load dashboard statistics';
        toast.error(errorMessage);
        setStats(null);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [toast]);

  return (
    <AuthGuard>
      <div className="space-y-6">
        <section className="rounded-xl border bg-card px-6 py-8 shadow-sm">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Welcome back, <span className="font-medium">{user?.name || user?.email}</span>
            </p>
            <p className="text-sm text-muted-foreground mt-1">Role: {user?.role}</p>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading statistics...</div>
          ) : stats ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Overview Cards */}
              <div className="rounded-lg border p-6 bg-card">
                <p className="text-sm text-muted-foreground mb-2">Total Customers</p>
                <p className="text-3xl font-bold">{stats.customers}</p>
                <Button variant="ghost" size="sm" className="mt-4" asChild>
                  <Link href="/customers">View All →</Link>
                </Button>
              </div>

              <div className="rounded-lg border p-6 bg-card">
                <p className="text-sm text-muted-foreground mb-2">Total Devices</p>
                <p className="text-3xl font-bold">{stats.devices}</p>
                <Button variant="ghost" size="sm" className="mt-4" asChild>
                  <Link href="/devices">View All →</Link>
                </Button>
              </div>

              <div className="rounded-lg border p-6 bg-card">
                <p className="text-sm text-muted-foreground mb-2">Total Jobs</p>
                <p className="text-3xl font-bold">{stats.jobs}</p>
                <Button variant="ghost" size="sm" className="mt-4" asChild>
                  <Link href="/jobs">View All →</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">Failed to load statistics</div>
          )}
        </section>

        {stats && (
          <section className="rounded-xl border bg-card px-6 py-8 shadow-sm">
            <h2 className="text-xl font-semibold mb-4">Jobs by Status</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-lg border p-4 bg-yellow-50 dark:bg-yellow-950/20">
                <p className="text-xs text-muted-foreground mb-1">Pending</p>
                <p className="text-2xl font-bold">{stats.jobsByStatus.PENDING}</p>
              </div>
              <div className="rounded-lg border p-4 bg-blue-50 dark:bg-blue-950/20">
                <p className="text-xs text-muted-foreground mb-1">Quoted</p>
                <p className="text-2xl font-bold">{stats.jobsByStatus.QUOTED}</p>
              </div>
              <div className="rounded-lg border p-4 bg-purple-50 dark:bg-purple-950/20">
                <p className="text-xs text-muted-foreground mb-1">Approved</p>
                <p className="text-2xl font-bold">{stats.jobsByStatus.APPROVED}</p>
              </div>
              <div className="rounded-lg border p-4 bg-orange-50 dark:bg-orange-950/20">
                <p className="text-xs text-muted-foreground mb-1">In Progress</p>
                <p className="text-2xl font-bold">{stats.jobsByStatus.IN_PROGRESS}</p>
              </div>
              <div className="rounded-lg border p-4 bg-green-50 dark:bg-green-950/20">
                <p className="text-xs text-muted-foreground mb-1">Completed</p>
                <p className="text-2xl font-bold">{stats.jobsByStatus.COMPLETED}</p>
              </div>
              <div className="rounded-lg border p-4 bg-red-50 dark:bg-red-950/20">
                <p className="text-xs text-muted-foreground mb-1">Rejected</p>
                <p className="text-2xl font-bold">{stats.jobsByStatus.REJECTED}</p>
              </div>
            </div>
          </section>
        )}

        <section className="rounded-xl border bg-card px-6 py-8 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/customers">Add Customer</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/jobs">Create Job</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/devices">Add Device</Link>
            </Button>
          </div>
        </section>
      </div>
    </AuthGuard>
  );
}

