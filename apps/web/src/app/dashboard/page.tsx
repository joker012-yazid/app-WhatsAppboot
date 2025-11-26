"use client";

import { type ComponentType, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  Briefcase,
  ClipboardCheck,
  Layers,
  LineChart,
  Loader2,
  MessageCircle,
  TrendingUp,
  Users,
} from 'lucide-react';

import AuthGuard from '@/components/auth-guard';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/toast-provider';
import { apiGet } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

type DashboardResponse = {
  cards: {
    todaysRevenue: number;
    pendingJobs: number;
    activeJobs: number;
    newCustomers: number;
    lowStockItems: number;
    campaignsRunning: number;
  };
  salesTrend: { date: string; revenue: number; jobs: number }[];
  customerGrowth: { date: string; newCustomers: number }[];
  jobsByStatus: Record<string, number> & {
    PENDING: number;
    QUOTED: number;
    APPROVED: number;
    IN_PROGRESS: number;
    COMPLETED: number;
    REJECTED: number;
  };
  recentActivities: {
    id: string;
    type: 'job' | 'campaign';
    title: string;
    status: string;
    description: string;
    jobId?: string;
    campaignId?: string;
    timestamp: string;
  }[];
};

const currencyFormatter = new Intl.NumberFormat('en-MY', {
  style: 'currency',
  currency: 'MYR',
  maximumFractionDigits: 0,
});

const weekdayFormatter = new Intl.DateTimeFormat('en-MY', {
  weekday: 'short',
  day: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat('en-MY', {
  hour: '2-digit',
  minute: '2-digit',
});

const formatCurrency = (value: number) => currencyFormatter.format(value || 0);

const MetricCard = ({
  label,
  value,
  helper,
  icon: Icon,
  href,
}: {
  label: string;
  value: string;
  helper: string;
  icon: ComponentType<{ className?: string }>;
  href?: string;
}) => (
  <div className="rounded-xl border bg-card p-5 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      </div>
      <div className="rounded-full bg-primary/10 p-2 text-primary">
        <Icon className="h-5 w-5" />
      </div>
    </div>
    <p className="mt-4 text-xs text-muted-foreground">{helper}</p>
    {href && (
      <Button variant="ghost" size="sm" asChild className="mt-3 text-xs">
        <Link href={href}>Open</Link>
      </Button>
    )}
  </div>
);

const TrendChart = ({ data }: { data: DashboardResponse['salesTrend'] }) => {
  const maxRevenue = useMemo(() => Math.max(...data.map((d) => d.revenue), 0), [data]);
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Last 7 days</p>
          <h3 className="text-xl font-semibold">Revenue trend</h3>
        </div>
        <LineChart className="h-5 w-5 text-primary" />
      </div>
      <div className="mt-6 flex h-40 items-end gap-3">
        {data.map((point) => {
          const height = maxRevenue ? Math.max((point.revenue / maxRevenue) * 100, 8) : 8;
          return (
            <div key={point.date} className="flex flex-1 flex-col items-center gap-2 text-center">
              <div className="flex h-32 w-full items-end justify-center rounded bg-primary/10">
                <div
                  className="w-full rounded bg-primary"
                  style={{ height: `${height}%` }}
                  title={`${formatCurrency(point.revenue)} – ${point.jobs} jobs`}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {weekdayFormatter.format(new Date(point.date))}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const GrowthChart = ({ data }: { data: DashboardResponse['customerGrowth'] }) => {
  const maxValue = useMemo(() => Math.max(...data.map((d) => d.newCustomers), 0), [data]);
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">New customers</p>
          <h3 className="text-xl font-semibold">Acquisition</h3>
        </div>
        <Users className="h-5 w-5 text-primary" />
      </div>
      <div className="mt-6 grid grid-cols-7 gap-3">
        {data.map((point) => {
          const fill = maxValue ? (point.newCustomers / maxValue) * 100 : 20;
          return (
            <div key={point.date} className="flex flex-col items-center gap-2 text-center">
              <div className="flex h-28 w-8 items-end justify-center overflow-hidden rounded bg-muted">
                <div
                  className="w-full rounded bg-primary/70"
                  style={{ height: `${Math.max(fill, 10)}%` }}
                  title={`${point.newCustomers} new customers`}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                {weekdayFormatter.format(new Date(point.date))}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const JobsByStatus = ({ data }: { data: DashboardResponse['jobsByStatus'] }) => {
  const entries = [
    { label: 'Pending', value: data.PENDING, tone: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-950/20 dark:text-yellow-100' },
    { label: 'Quoted', value: data.QUOTED, tone: 'bg-blue-100 text-blue-900 dark:bg-blue-950/20 dark:text-blue-100' },
    { label: 'Approved', value: data.APPROVED, tone: 'bg-purple-100 text-purple-900 dark:bg-purple-950/20 dark:text-purple-100' },
    { label: 'In progress', value: data.IN_PROGRESS, tone: 'bg-orange-100 text-orange-900 dark:bg-orange-950/20 dark:text-orange-100' },
    { label: 'Completed', value: data.COMPLETED, tone: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-100' },
    { label: 'Rejected', value: data.REJECTED, tone: 'bg-rose-100 text-rose-900 dark:bg-rose-950/20 dark:text-rose-100' },
  ];

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Job pipeline</p>
          <h3 className="text-xl font-semibold">Status overview</h3>
        </div>
        <Briefcase className="h-5 w-5 text-primary" />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
        {entries.map((entry) => (
          <div key={entry.label} className={cn('rounded-lg border p-4', entry.tone)}>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{entry.label}</p>
            <p className="text-2xl font-semibold">{entry.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const ActivityFeed = ({ activities }: { activities: DashboardResponse['recentActivities'] }) => (
  <div className="rounded-xl border bg-card p-6 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-muted-foreground">Latest updates</p>
        <h3 className="text-xl font-semibold">Activity feed</h3>
      </div>
      <Activity className="h-5 w-5 text-primary" />
    </div>
    <div className="mt-4 space-y-4">
      {activities.length === 0 && (
        <p className="text-sm text-muted-foreground">No recent updates yet.</p>
      )}
      {activities.map((item) => (
        <div key={item.id} className="flex items-start gap-3 rounded-lg border p-3">
          <div className={cn('rounded-full p-2', item.type === 'job' ? 'bg-blue-100 text-blue-900 dark:bg-blue-950/20' : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/20')}>
            {item.type === 'job' ? <Layers className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
          </div>
          <div className="space-y-1 text-sm">
            <p className="font-medium">{item.title}</p>
            <p className="text-muted-foreground text-xs">{item.description}</p>
            <p className="text-[11px] text-muted-foreground">{timeFormatter.format(new Date(item.timestamp))}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default function DashboardPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let intervalHandle: ReturnType<typeof setInterval>;

    const fetchStats = async () => {
      try {
        const response = await apiGet<DashboardResponse>('/api/dashboard');
        setData(response);
        setLoading(false);
      } catch (error: any) {
        setLoading(false);
        toast.error(error?.message || 'Failed to load dashboard metrics');
      }
    };

    fetchStats();
    intervalHandle = setInterval(fetchStats, 30000);

    return () => { if (intervalHandle) clearInterval(intervalHandle); };
  }, [toast]);

  const cards = data?.cards;

  return (
    <AuthGuard>
      <div className="space-y-6">
        <section className="rounded-xl border bg-card px-6 py-8 shadow-sm">
          <div className="mb-6 flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">Signed in as {user?.role?.toLowerCase()}</p>
            <h1 className="text-3xl font-bold">Welcome back, {user?.name || user?.email}</h1>
            <p className="text-muted-foreground text-sm">Real-time repair shop overview</p>
          </div>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading dashboard
            </div>
          ) : cards ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <MetricCard
                label="Today's revenue"
                value={formatCurrency(cards.todaysRevenue)}
                helper="Completed job approvals"
                icon={TrendingUp}
              />
              <MetricCard
                label="Pending jobs"
                value={cards.pendingJobs.toString()}
                helper="Waiting for technician intake"
                icon={ClipboardCheck}
                href="/jobs?status=PENDING"
              />
              <MetricCard
                label="Active jobs"
                value={cards.activeJobs.toString()}
                helper="Approved or in progress"
                icon={Briefcase}
                href="/jobs"
              />
              <MetricCard
                label="New customers"
                value={cards.newCustomers.toString()}
                helper="Created today"
                icon={Users}
                href="/customers"
              />
              <MetricCard
                label="Urgent queue"
                value={cards.lowStockItems.toString()}
                helper="Priority repairs (proxy for low stock)"
                icon={Layers}
                href="/jobs?priority=URGENT"
              />
              <MetricCard
                label="Campaigns running"
                value={cards.campaignsRunning.toString()}
                helper="Scheduled or live"
                icon={MessageCircle}
                href="/campaigns"
              />
            </div>
          ) : (
            <div className="text-center text-sm text-muted-foreground">Unable to load metrics.</div>
          )}
        </section>

        {data && (
          <>
            <div className="grid gap-6 lg:grid-cols-2">
              <TrendChart data={data.salesTrend} />
              <GrowthChart data={data.customerGrowth} />
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              <JobsByStatus data={data.jobsByStatus} />
              <ActivityFeed activities={data.recentActivities} />
              <div className="rounded-xl border bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Handy shortcuts</p>
                    <h3 className="text-xl font-semibold">Quick actions</h3>
                  </div>
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                </div>
                <div className="mt-4 flex flex-col gap-3">
                  <Button asChild>
                    <Link href="/customers">Add customer</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/jobs">Create job</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/campaigns/create">Launch campaign</Link>
                  </Button>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  Tip: start campaigns after confirming business hours & anti-ban limits in settings.
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </AuthGuard>
  );
}
