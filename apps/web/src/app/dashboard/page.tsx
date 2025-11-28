"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LayoutDashboard, MonitorSmartphone, Users, Wrench } from 'lucide-react';
import AuthGuard from '@/components/auth-guard';
import { useAuth } from '@/lib/auth';
import { apiGet } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/toast-provider';
import { SectionHeader } from '@/components/section-header';

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

type DashboardCards = {
  todaysRevenue: number;
  pendingJobs: number;
  activeJobs: number;
  newCustomers: number;
  // Count of urgent/prioritized jobs, not an inventory metric
  urgentJobs: number;
  campaignsRunning: number;
};

type DashboardResponse = {
  cards: DashboardCards;
};

export default function DashboardPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<DashboardCards | null>(null);
  const [cardsLoading, setCardsLoading] = useState(true);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-MY', {
      style: 'currency',
      currency: 'MYR',
      maximumFractionDigits: 0,
    }).format(value || 0);

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

  useEffect(() => {
    const fetchCards = async () => {
      try {
        setCardsLoading(true);
        const data = await apiGet<DashboardResponse>('/api/dashboard');
        setCards(data.cards || null);
      } catch (error: any) {
        console.error('[Dashboard] Failed to load cards:', error);
        const errorMessage = error?.message || 'Failed to load dashboard metrics';
        toast.error(errorMessage);
        setCards(null);
      } finally {
        setCardsLoading(false);
      }
    };

    fetchCards();
  }, [toast]);

  return (
    <AuthGuard>
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-slate-950/80 via-slate-900/80 to-slate-950/40 px-6 py-8 shadow-lg shadow-black/40 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-sky-500/60 before:to-transparent">
          <div className="pointer-events-none absolute inset-0 opacity-30 blur-3xl" aria-hidden="true">
            <div className="absolute -left-10 top-10 h-48 w-48 rounded-full bg-sky-500/30" />
            <div className="absolute right-0 bottom-0 h-40 w-40 rounded-full bg-emerald-500/20" />
          </div>

          <div className="relative grid gap-4 md:grid-cols-[1.4fr,1fr] md:items-center">
            <SectionHeader
              icon={<LayoutDashboard className="h-4 w-4" />}
              overline="Dashboard"
              title="Repair Shop Overview"
              description={`Welcome back, ${user?.name || user?.email || 'admin'}. Role: ${user?.role ?? 'unknown'}. High-level overview of today's repair shop performance.`}
            />
            <div className="relative flex w-full flex-col items-start justify-end gap-3 rounded-lg border border-slate-700/70 bg-slate-900/60 px-5 py-4 text-left shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-sky-500/60 hover:shadow-lg hover:shadow-sky-500/20 md:items-end md:text-right">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="rounded-full bg-sky-500/15 px-3 py-1 font-semibold text-sky-300">Today</span>
                <span className="uppercase tracking-wide">Today's Revenue</span>
              </div>
              <p className="text-4xl font-semibold text-slate-50">
                {cards ? formatCurrency(cards.todaysRevenue) : 'N/A'}
              </p>
              <p className="text-xs text-slate-400">Realtime snapshot of sales across all outlets.</p>
            </div>
          </div>

          <div className="relative mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cardsLoading &&
              Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-full rounded-lg border border-slate-800/70 bg-slate-900/50 px-5 py-4 shadow-sm animate-pulse"
                >
                  <div className="h-3 w-28 rounded bg-slate-700/60" />
                  <div className="mt-4 h-7 w-16 rounded bg-slate-700/60" />
                  <div className="mt-4 h-3 w-24 rounded bg-slate-700/50" />
                </div>
              ))}
            {!cardsLoading && cards && (
              <>
                <div className="group rounded-lg border border-slate-700/70 bg-slate-900/60 px-5 py-4 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-sky-500/80 hover:shadow-lg hover:shadow-sky-500/20">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Today's Revenue</p>
                    <span className="h-2 w-2 rounded-full bg-sky-400/80" />
                  </div>
                  <p className="mt-2 text-3xl font-semibold text-slate-50">{formatCurrency(cards.todaysRevenue)}</p>
                  <p className="mt-1 text-xs text-slate-400/90">Updated in real-time</p>
                </div>

                <div className="group rounded-lg border border-slate-700/70 bg-slate-900/60 px-5 py-4 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-sky-500/80 hover:shadow-lg hover:shadow-sky-500/20">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Pending Jobs</p>
                    <span className="h-2 w-2 rounded-full bg-amber-400/80" />
                  </div>
                  <p className="mt-2 text-3xl font-semibold text-slate-50">{cards.pendingJobs}</p>
                  <p className="mt-1 text-xs text-slate-400/90">Jobs still waiting to be processed</p>
                </div>

                <div className="group rounded-lg border border-slate-700/70 bg-slate-900/60 px-5 py-4 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-sky-500/80 hover:shadow-lg hover:shadow-sky-500/20">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Active Jobs</p>
                    <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
                  </div>
                  <p className="mt-2 text-3xl font-semibold text-slate-50">{cards.activeJobs}</p>
                  <p className="mt-1 text-xs text-slate-400/90">Currently in progress across technicians</p>
                </div>

                <div className="group rounded-lg border border-slate-700/70 bg-slate-900/60 px-5 py-4 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-sky-500/80 hover:shadow-lg hover:shadow-sky-500/20">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">New Customers Today</p>
                    <span className="h-2 w-2 rounded-full bg-indigo-400/80" />
                  </div>
                  <p className="mt-2 text-3xl font-semibold text-slate-50">{cards.newCustomers}</p>
                  <p className="mt-1 text-xs text-slate-400/90">Fresh leads captured in the last 24h</p>
                </div>

                <div className="group rounded-lg border border-slate-700/70 bg-slate-900/60 px-5 py-4 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-sky-500/80 hover:shadow-lg hover:shadow-sky-500/20">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Urgent Jobs</p>
                    <span className="h-2 w-2 rounded-full bg-rose-400/80" />
                  </div>
                  <p className="mt-2 text-3xl font-semibold text-slate-50">{cards.urgentJobs}</p>
                  <p className="mt-1 text-xs text-slate-400/90">Tickets marked priority by support</p>
                </div>

                <div className="group rounded-lg border border-slate-700/70 bg-slate-900/60 px-5 py-4 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-sky-500/80 hover:shadow-lg hover:shadow-sky-500/20">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Campaigns Running</p>
                    <span className="h-2 w-2 rounded-full bg-cyan-400/80" />
                  </div>
                  <p className="mt-2 text-3xl font-semibold text-slate-50">{cards.campaignsRunning}</p>
                  <p className="mt-1 text-xs text-slate-400/90">Live WhatsApp outreach right now</p>
                </div>
              </>
            )}
            {!cardsLoading && !cards && (
              <div className="col-span-full rounded-lg border border-slate-800/70 bg-slate-900/50 px-5 py-6 text-center text-sm text-muted-foreground">
                Failed to load dashboard metrics
              </div>
            )}
          </div>
        </section>

        <section className="rounded-xl border bg-card/80 px-6 py-7 shadow-sm backdrop-blur">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-slate-800 bg-slate-900/40 px-5 py-4 animate-pulse">
                  <div className="h-3 w-24 rounded bg-slate-700/60" />
                  <div className="mt-4 h-7 w-16 rounded bg-slate-700/60" />
                  <div className="mt-5 h-3 w-20 rounded bg-slate-700/60" />
                </div>
              ))}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="flex flex-col justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-5 py-4 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-sky-500/60 hover:shadow-lg hover:shadow-sky-500/10">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total Customers</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-50">{stats.customers}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-4 px-0 text-sm text-sky-400 hover:text-sky-300"
                  asChild
                >
                  <Link href="/customers">View All -></Link>
                </Button>
              </div>

              <div className="flex flex-col justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-5 py-4 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-sky-500/60 hover:shadow-lg hover:shadow-sky-500/10">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total Devices</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-50">{stats.devices}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-4 px-0 text-sm text-sky-400 hover:text-sky-300"
                  asChild
                >
                  <Link href="/devices">View All -></Link>
                </Button>
              </div>

              <div className="flex flex-col justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-5 py-4 shadow-sm transition duration-150 hover:-translate-y-0.5 hover:border-sky-500/60 hover:shadow-lg hover:shadow-sky-500/10">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total Jobs</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-50">{stats.jobs}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-4 px-0 text-sm text-sky-400 hover:text-sky-300"
                  asChild
                >
                  <Link href="/jobs">View All -></Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-800/70 bg-slate-900/50 px-5 py-6 text-center text-sm text-muted-foreground">
              Failed to load statistics
            </div>
          )}
        </section>

        {stats && (
          <section className="rounded-xl border bg-card/80 px-6 py-7 shadow-sm backdrop-blur">
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Jobs Overview</h2>
            <p className="mb-4 text-lg font-semibold text-slate-50">Jobs by Status</p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              <div className="rounded-lg border border-yellow-400/40 bg-yellow-500/5 px-4 py-3 shadow-sm">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-yellow-300/90">Pending</p>
                <p className="text-2xl font-semibold text-slate-50">{stats.jobsByStatus.PENDING}</p>
              </div>
              <div className="rounded-lg border border-blue-400/40 bg-blue-500/5 px-4 py-3 shadow-sm">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-blue-300/90">Quoted</p>
                <p className="text-2xl font-semibold text-slate-50">{stats.jobsByStatus.QUOTED}</p>
              </div>
              <div className="rounded-lg border border-violet-400/40 bg-violet-500/5 px-4 py-3 shadow-sm">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-violet-300/90">Approved</p>
                <p className="text-2xl font-semibold text-slate-50">{stats.jobsByStatus.APPROVED}</p>
              </div>
              <div className="rounded-lg border border-orange-400/40 bg-orange-500/5 px-4 py-3 shadow-sm">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-orange-300/90">In Progress</p>
                <p className="text-2xl font-semibold text-slate-50">{stats.jobsByStatus.IN_PROGRESS}</p>
              </div>
              <div className="rounded-lg border border-emerald-400/40 bg-emerald-500/5 px-4 py-3 shadow-sm">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-emerald-300/90">Completed</p>
                <p className="text-2xl font-semibold text-slate-50">{stats.jobsByStatus.COMPLETED}</p>
              </div>
              <div className="rounded-lg border border-red-400/40 bg-red-500/5 px-4 py-3 shadow-sm">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-red-300/90">Rejected</p>
                <p className="text-2xl font-semibold text-slate-50">{stats.jobsByStatus.REJECTED}</p>
              </div>
            </div>
          </section>
        )}

        <section className="rounded-xl border bg-card/80 px-6 py-5 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Quick Actions</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Jump straight into your most common workflows.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/customers" className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>Add Customer</span>
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/jobs" className="inline-flex items-center gap-2">
                  <Wrench className="h-4 w-4" />
                  <span>Create Job</span>
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/devices" className="inline-flex items-center gap-2">
                  <MonitorSmartphone className="h-4 w-4" />
                  <span>Add Device</span>
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </AuthGuard>
  );
}
