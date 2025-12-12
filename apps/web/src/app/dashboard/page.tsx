'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  MonitorSmartphone,
  Users,
  Wrench,
  TrendingUp,
  DollarSign,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Megaphone,
  Plus,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

import { useAuth } from '@/lib/auth';
import { apiGet } from '@/lib/api';
import { AnimatedButton } from '@/components/ui/animated-button';
import { AnimatedCard } from '@/components/ui/animated-card';
import { CurrencyCounter, AnimatedCounter } from '@/components/ui/animated-counter';
import { Skeleton, SkeletonStats } from '@/components/ui/skeleton';
import { StaggerContainer, StaggerItem, SlideIn } from '@/components/ui/motion';
import { cn } from '@/lib/utils';

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
  urgentJobs: number;
  campaignsRunning: number;
};

type DashboardResponse = {
  cards: DashboardCards;
  salesTrend: { date: string; revenue: number; jobs: number }[];
  customerGrowth: { date: string; newCustomers: number }[];
  recentActivities: {
    id: string;
    type: string;
    title: string;
    status: string;
    timestamp: string;
    description: string;
  }[];
};

// Stat Card Component
interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  change?: number;
  prefix?: string;
  suffix?: string;
  color: string;
  isCurrency?: boolean;
  delay?: number;
}

function StatCard({
  title,
  value,
  icon,
  change,
  prefix,
  suffix,
  color,
  isCurrency,
  delay = 0,
}: StatCardProps) {
  const isPositive = typeof change === 'number' && change > 0;
  const isNegative = typeof change === 'number' && change < 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
    >
      <AnimatedCard
        className="relative overflow-hidden"
        hoverEffect="lift"
      >
        {/* Background Gradient */}
        <div
          className={cn(
            'absolute top-0 right-0 h-24 w-24 rounded-full opacity-10 blur-2xl',
            color
          )}
        />

        {/* Content */}
        <div className="relative">
          <div className="flex items-start justify-between">
            <div className={cn('rounded-lg p-2.5', `bg-${color}/10`)}>
              <span className={cn('text-', color)}>{icon}</span>
            </div>
            {change !== undefined && (
              <div
                className={cn(
                  'flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
                  isPositive && 'bg-green-500/10 text-green-500',
                  isNegative && 'bg-red-500/10 text-red-500',
                  !isPositive && !isNegative && 'bg-muted text-muted-foreground'
                )}
              >
                {isPositive && <ArrowUpRight className="h-3 w-3" />}
                {isNegative && <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(change)}%
              </div>
            )}
          </div>

          <div className="mt-4">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-1 text-3xl font-bold text-foreground">
              {isCurrency ? (
                <CurrencyCounter value={value} delay={delay} />
              ) : (
                <>
                  {prefix}
                  <AnimatedCounter value={value} delay={delay} />
                  {suffix}
                </>
              )}
            </p>
          </div>
        </div>
      </AnimatedCard>
    </motion.div>
  );
}

// Activity Item Component
function ActivityItem({
  activity,
  index,
}: {
  activity: DashboardResponse['recentActivities'][0];
  index: number;
}) {
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      COMPLETED: 'bg-green-500',
      IN_PROGRESS: 'bg-blue-500',
      PENDING: 'bg-yellow-500',
      APPROVED: 'bg-purple-500',
      REJECTED: 'bg-red-500',
    };
    return colors[status] || 'bg-muted';
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-start gap-3 rounded-lg p-3 hover:bg-muted/50 transition-colors"
    >
      <div className={cn('mt-1 h-2 w-2 rounded-full', getStatusColor(activity.status))} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{activity.title}</p>
        <p className="text-xs text-muted-foreground">{activity.description}</p>
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {new Date(activity.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </span>
    </motion.div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [statsData, dashboardData] = await Promise.all([
          apiGet<Stats>('/api/health/stats'),
          apiGet<DashboardResponse>('/api/dashboard'),
        ]);
        setStats(statsData);
        setDashboard(dashboardData);
      } catch (error) {
        console.error('[Dashboard] Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
  return (
      <div className="space-y-6">
        <SkeletonStats />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Skeleton className="h-80 w-full rounded-xl" />
          </div>
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
              </div>
    );
  }

  const cards = dashboard?.cards;

  return (
    <div className="space-y-6">
      {/* Header */}
      <SlideIn direction="down">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Welcome back, {user?.name || 'Admin'}! 👋
            </h1>
            <p className="text-muted-foreground">
              Here's what's happening with your business today.
            </p>
          </div>
          <div className="flex gap-3">
            <AnimatedButton variant="outline" asChild>
              <Link href="/reports">View Reports</Link>
            </AnimatedButton>
            <AnimatedButton leftIcon={<Plus className="h-4 w-4" />} asChild>
              <Link href="/jobs">New Job</Link>
            </AnimatedButton>
          </div>
                </div>
      </SlideIn>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Today's Revenue"
          value={cards?.todaysRevenue || 0}
          icon={<DollarSign className="h-5 w-5 text-green-500" />}
          color="green-500"
          isCurrency
          change={12}
          delay={0}
        />
        <StatCard
          title="Pending Jobs"
          value={cards?.pendingJobs || 0}
          icon={<Clock className="h-5 w-5 text-yellow-500" />}
          color="yellow-500"
          delay={0.1}
        />
        <StatCard
          title="Active Jobs"
          value={cards?.activeJobs || 0}
          icon={<Wrench className="h-5 w-5 text-blue-500" />}
          color="blue-500"
          change={5}
          delay={0.2}
        />
        <StatCard
          title="New Customers"
          value={cards?.newCustomers || 0}
          icon={<Users className="h-5 w-5 text-purple-500" />}
          color="purple-500"
          change={8}
          delay={0.3}
        />
        <StatCard
          title="Urgent Jobs"
          value={cards?.urgentJobs || 0}
          icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
          color="red-500"
          delay={0.4}
        />
        <StatCard
          title="Campaigns"
          value={cards?.campaignsRunning || 0}
          icon={<Megaphone className="h-5 w-5 text-cyan-500" />}
          color="cyan-500"
          delay={0.5}
        />
              </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <AnimatedCard className="p-6" hoverEffect="none">
            <div className="flex items-center justify-between mb-6">
                <div>
                <h3 className="font-semibold text-foreground">Revenue Overview</h3>
                <p className="text-sm text-muted-foreground">Last 7 days performance</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-green-500">
                <TrendingUp className="h-4 w-4" />
                +12.5%
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dashboard?.salesTrend || []}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    tickFormatter={(date) =>
                      new Date(date).toLocaleDateString('en-US', { weekday: 'short' })
                    }
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#colorRevenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </AnimatedCard>
        </motion.div>

        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <AnimatedCard className="p-6 h-full" hoverEffect="none">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Recent Activity</h3>
              <Link href="/jobs" className="text-xs text-primary hover:underline">
                View all
              </Link>
              </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {dashboard?.recentActivities?.slice(0, 6).map((activity, index) => (
                <ActivityItem key={activity.id} activity={activity} index={index} />
              )) || (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No recent activity
                </p>
              )}
            </div>
          </AnimatedCard>
        </motion.div>
      </div>

      {/* Jobs by Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <AnimatedCard className="p-6" hoverEffect="none">
          <h3 className="font-semibold text-foreground mb-6">Jobs by Status</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Pending', value: stats?.jobsByStatus.PENDING || 0, color: 'bg-yellow-500' },
              { label: 'Quoted', value: stats?.jobsByStatus.QUOTED || 0, color: 'bg-blue-500' },
              { label: 'Approved', value: stats?.jobsByStatus.APPROVED || 0, color: 'bg-purple-500' },
              { label: 'In Progress', value: stats?.jobsByStatus.IN_PROGRESS || 0, color: 'bg-orange-500' },
              { label: 'Completed', value: stats?.jobsByStatus.COMPLETED || 0, color: 'bg-green-500' },
              { label: 'Rejected', value: stats?.jobsByStatus.REJECTED || 0, color: 'bg-red-500' },
            ].map((status, index) => (
              <motion.div
                key={status.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 + index * 0.05 }}
                className="rounded-lg border border-border p-4 text-center hover:bg-muted/50 transition-colors"
              >
                <div className={cn('mx-auto mb-2 h-2 w-12 rounded-full', status.color)} />
                <p className="text-2xl font-bold text-foreground">
                  <AnimatedCounter value={status.value} delay={0.6 + index * 0.05} />
                </p>
                <p className="text-xs text-muted-foreground">{status.label}</p>
              </motion.div>
            ))}
          </div>
        </AnimatedCard>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <AnimatedCard className="p-6" hoverEffect="none">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-foreground">Quick Actions</h3>
              <p className="text-sm text-muted-foreground">
                Jump straight into your most common workflows
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <AnimatedButton leftIcon={<Users className="h-4 w-4" />} asChild>
                <Link href="/customers">Add Customer</Link>
              </AnimatedButton>
              <AnimatedButton variant="outline" leftIcon={<Wrench className="h-4 w-4" />} asChild>
                <Link href="/jobs">Create Job</Link>
              </AnimatedButton>
              <AnimatedButton variant="outline" leftIcon={<MonitorSmartphone className="h-4 w-4" />} asChild>
                <Link href="/devices">Add Device</Link>
              </AnimatedButton>
            </div>
          </div>
        </AnimatedCard>
      </motion.div>
      </div>
  );
}
