"use client";

import { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CalendarRange,
  ClipboardList,
  Clock3,
  Inbox,
  Loader2,
  Mail,
  PieChart,
  TrendingUp,
  Users,
} from 'lucide-react';

import AuthGuard from '@/components/auth-guard';
import { Button } from '@/components/ui/button';
import { apiGet } from '@/lib/api';
import { useToast } from '@/components/toast-provider';
import { SectionHeader } from '@/components/section-header';

const currencyFormatter = new Intl.NumberFormat('en-MY', {
  style: 'currency',
  currency: 'MYR',
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('en-MY', { month: 'short', day: 'numeric' });

const formatCurrency = (value: number) => currencyFormatter.format(value || 0);
const formatInputDate = (date: Date) => date.toISOString().slice(0, 10);
const buildDefaultRange = () => {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  return { from: formatInputDate(start), to: formatInputDate(end) };
};

type ReportsResponse = {
  range: { from: string; to: string; days: number };
  sales: {
    totalRevenue: number;
    transactions: number;
    averageSale: number;
    perDay: { date: string; revenue: number; jobs: number }[];
    topCustomers: { id: string; name: string; phone: string | null; totalRevenue: number; jobs: number }[];
  };
  jobs: {
    total: number;
    completed: number;
    completionRate: number;
    averageTurnaroundHours: number;
    statusBreakdown: Record<string, number>;
    priorityBreakdown: Record<string, number>;
  };
  customers: {
    new: number;
    returning: number;
    retentionRate: number;
    trend: { date: string; newCustomers: number }[];
  };
  messaging: {
    campaignsCreated: number;
    runningNow: number;
    sent: number;
    failed: number;
    recipientsByStatus: Record<string, number>;
    recentCampaigns: { id: string; name: string; status: string; sentCount: number; failedCount: number; createdAt: string }[];
  };
  inventory: {
    supported: boolean;
    message: string;
    proxyUrgentJobs: number;
  };
};

export default function ReportsPage() {
  const toast = useToast();
  const initialRange = useMemo(() => buildDefaultRange(), []);
  const [formFrom, setFormFrom] = useState(initialRange.from);
  const [formTo, setFormTo] = useState(initialRange.to);
  const [appliedRange, setAppliedRange] = useState(initialRange);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const run = async () => {
      try {
        const query = `?from=${encodeURIComponent(appliedRange.from)}&to=${encodeURIComponent(appliedRange.to)}`;
        const response = await apiGet<ReportsResponse>(`/api/reports/summary${query}`);
        if (!cancelled) {
          setData(response);
          setLoading(false);
        }
      } catch (error: any) {
        if (!cancelled) {
          setLoading(false);
          toast.error(error?.message || 'Unable to load report summary');
        }
      }
    };
    run();

    return () => {
      cancelled = true;
    };
  }, [appliedRange.from, appliedRange.to, toast]);

  const handleApply = () => {
    if (!formFrom || !formTo) {
      toast.error('Please select both start and end dates');
      return;
    }
    setAppliedRange({ from: formFrom, to: formTo });
  };

  const handleReset = () => {
    setFormFrom(initialRange.from);
    setFormTo(initialRange.to);
    setAppliedRange(initialRange);
  };

  const maxRevenue = useMemo(() => Math.max(...(data?.sales?.perDay?.map((point) => point.revenue) ?? [1]), 1), [data]);
  const maxCustomerAdds = useMemo(() => Math.max(...(data?.customers?.trend?.map((point) => point.newCustomers) ?? [1]), 1), [data]);

  return (
    <AuthGuard>
      <div className="space-y-8">
        <section className="space-y-4 rounded-xl border bg-card/80 px-6 py-5 shadow-sm backdrop-blur">
          <SectionHeader
            icon={<BarChart3 className="h-4 w-4" />}
            overline="Reports"
            title="Reports & Analytics"
            description="View revenue, operations, customer, and campaign performance across the selected range."
            actions={
              <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm">
                <CalendarRange className="h-4 w-4 text-primary" />
                <div>
                  <p className="font-medium">
                    {appliedRange.from} &rarr; {appliedRange.to}
                  </p>
                  <p className="text-xs text-muted-foreground">{data?.range.days ?? 0} day window</p>
                </div>
              </div>
            }
          />
          <form
            className="flex flex-wrap items-end gap-3 rounded-xl border bg-card px-4 py-3"
            onSubmit={(event) => {
              event.preventDefault();
              handleApply();
            }}
          >
            <div className="flex flex-col text-sm">
              <label className="mb-1 font-medium" htmlFor="from-date">
                From
              </label>
              <input
                id="from-date"
                type="date"
                value={formFrom}
                max={formTo}
                onChange={(event) => setFormFrom(event.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              />
            </div>
            <div className="flex flex-col text-sm">
              <label className="mb-1 font-medium" htmlFor="to-date">
                To
              </label>
              <input
                id="to-date"
                type="date"
                value={formTo}
                min={formFrom}
                max={formatInputDate(new Date())}
                onChange={(event) => setFormTo(event.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Update
            </Button>
            <Button type="button" variant="ghost" onClick={handleReset} disabled={loading}>
              Reset
            </Button>
          </form>
        </section>

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border bg-card px-4 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading summary...
          </div>
        ) : data ? (
          <div className="space-y-8">
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm font-medium">Sales report</span>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Revenue</p>
                  <p className="mt-2 text-3xl font-semibold">{formatCurrency(data.sales.totalRevenue)}</p>
                  <p className="text-xs text-muted-foreground">{data.sales.transactions} closed jobs</p>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Average sale</p>
                  <p className="mt-2 text-3xl font-semibold">{formatCurrency(data.sales.averageSale)}</p>
                  <p className="text-xs text-muted-foreground">Across all completed jobs</p>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Daily jobs</p>
                  <p className="mt-2 text-3xl font-semibold">
                    {data.sales.perDay.reduce((acc, day) => acc + day.jobs, 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Within selected range</p>
                </div>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Revenue trend</span>
                  <span className="text-muted-foreground">Last {data.range.days} days</span>
                </div>
                <div className="mt-4 h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.sales.perDay}
                      margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value) => dateFormatter.format(new Date(value))}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis
                        hide
                        domain={[0, 'dataMax']}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          name === 'revenue' ? formatCurrency(value) : value,
                          name === 'revenue' ? 'Revenue' : 'Jobs'
                        ]}
                        labelFormatter={(label) => dateFormatter.format(new Date(label))}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar
                        dataKey="revenue"
                        fill="hsl(var(--primary))"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={40}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">Top customers</p>
                    <p className="text-xs text-muted-foreground">By approved amount</p>
                  </div>
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="py-2">Customer</th>
                        <th className="py-2">Jobs</th>
                        <th className="py-2">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.sales.topCustomers.length === 0 ? (
                        <tr>
                          <td className="py-4 text-sm text-muted-foreground" colSpan={3}>
                            <div className="flex flex-col items-center justify-center gap-2 text-center">
                              <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-slate-800 bg-slate-950/60">
                                <Inbox className="h-5 w-5 text-slate-500" />
                              </div>
                              <p className="text-sm font-medium text-slate-100">No completed jobs in this range.</p>
                              <p className="text-xs text-slate-400">Complete jobs to see your top customers here.</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        data.sales.topCustomers.map((customer) => (
                          <tr key={customer.id} className="border-t text-sm">
                            <td className="py-2">
                              <p className="font-medium">{customer.name}</p>
                              <p className="text-xs text-muted-foreground">{customer.phone || 'Unknown phone'}</p>
                            </td>
                            <td className="py-2">{customer.jobs}</td>
                            <td className="py-2">{formatCurrency(customer.totalRevenue)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <ClipboardList className="h-4 w-4" />
                <span className="text-sm font-medium">Job report</span>
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-xs text-muted-foreground">Total jobs</p>
                  <p className="mt-2 text-2xl font-semibold">{data.jobs.total}</p>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-xs text-muted-foreground">Completed</p>
                  <p className="mt-2 text-2xl font-semibold">{data.jobs.completed}</p>
                  <p className="text-xs text-muted-foreground">{data.jobs.completionRate}% completion rate</p>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-xs text-muted-foreground">Avg turnaround</p>
                  <p className="mt-2 text-2xl font-semibold">{data.jobs.averageTurnaroundHours} h</p>
                  <p className="text-xs text-muted-foreground">From intake to completion</p>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-xs text-muted-foreground">Urgent queue</p>
                  <p className="mt-2 text-2xl font-semibold">{data.inventory.proxyUrgentJobs}</p>
                  <p className="text-xs text-muted-foreground">Priority jobs in range</p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border bg-card p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Status breakdown</span>
                    <PieChart className="h-4 w-4 text-primary" />
                  </div>
                  <div className="mt-4 space-y-2 text-sm">
                    {Object.entries(data.jobs.statusBreakdown).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between">
                        <span className="uppercase tracking-wide text-muted-foreground">{status.replace('_', ' ')}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Priority mix</span>
                    <Activity className="h-4 w-4 text-primary" />
                  </div>
                  <div className="mt-4 space-y-2 text-sm">
                    {Object.entries(data.jobs.priorityBreakdown).map(([priority, count]) => (
                      <div key={priority} className="flex items-center justify-between">
                        <span className="uppercase tracking-wide text-muted-foreground">{priority}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                <span className="text-sm font-medium">Customer report</span>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-xs text-muted-foreground">New customers</p>
                  <p className="mt-2 text-2xl font-semibold">{data.customers.new}</p>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-xs text-muted-foreground">Returning customers</p>
                  <p className="mt-2 text-2xl font-semibold">{data.customers.returning}</p>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-xs text-muted-foreground">Retention rate</p>
                  <p className="mt-2 text-2xl font-semibold">{data.customers.retentionRate}%</p>
                </div>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Acquisition trend</span>
                  <BarChart3 className="h-4 w-4 text-primary" />
                </div>
                <div className="mt-4 h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.customers.trend}
                      margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value) => dateFormatter.format(new Date(value))}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis
                        hide
                        domain={[0, 'dataMax']}
                      />
                      <Tooltip
                        formatter={(value: number) => [value, 'New Customers']}
                        labelFormatter={(label) => dateFormatter.format(new Date(label))}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar
                        dataKey="newCustomers"
                        fill="hsl(var(--primary))"
                        fillOpacity={0.7}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={40}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span className="text-sm font-medium">WhatsApp & Campaigns</span>
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-xs text-muted-foreground">Campaigns created</p>
                  <p className="mt-2 text-2xl font-semibold">{data.messaging.campaignsCreated}</p>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-xs text-muted-foreground">Running now</p>
                  <p className="mt-2 text-2xl font-semibold">{data.messaging.runningNow}</p>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-xs text-muted-foreground">Messages sent</p>
                  <p className="mt-2 text-2xl font-semibold">{data.messaging.sent}</p>
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <p className="text-xs text-muted-foreground">Failed deliveries</p>
                  <p className="mt-2 text-2xl font-semibold">{data.messaging.failed}</p>
                </div>
              </div>
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Recent campaigns</span>
                  <Clock3 className="h-4 w-4 text-primary" />
                </div>
                <div className="mt-3 space-y-3 text-sm">
                  {data.messaging.recentCampaigns.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-4 text-center text-muted-foreground">
                      <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-slate-800 bg-slate-950/60">
                        <Inbox className="h-5 w-5 text-slate-500" />
                      </div>
                      <p className="text-sm font-medium text-slate-100">No campaigns in this range.</p>
                      <p className="text-xs text-slate-400">Launch a campaign to see delivery stats here.</p>
                    </div>
                  ) : (
                    data.messaging.recentCampaigns.slice(0, 5).map((campaign) => (
                      <div key={campaign.id} className="rounded-lg border p-3">
                        <p className="font-medium">{campaign.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {campaign.status} - {campaign.sentCount} sent / {campaign.failedCount} failed
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-amber-500">
                <AlertTriangle className="h-4 w-4" />
                <p className="text-sm font-semibold">Inventory report pending</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {data.inventory.message}
              </p>
              <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Current urgent jobs in range: {data.inventory.proxyUrgentJobs}
              </p>
            </section>
          </div>
        ) : (
          <div className="rounded-xl border bg-card px-4 py-6 text-sm text-muted-foreground">
            Unable to load reports for this range.
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
