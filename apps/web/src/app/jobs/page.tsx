"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AuthGuard from '@/components/auth-guard';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/toast-provider';
import { useConfirm } from '@/components/confirm-provider';
import { useAuth } from '@/lib/auth';
import { hasAnyRole } from '@/lib/roles';
import { SegmentedControl } from '@/components/ui/segmented-control';

type Customer = { id: string; name: string };
type Device = { id: string; deviceType: string; model?: string | null; brand?: string | null };
type Job = {
  id: string;
  title: string;
  status: 'PENDING' | 'QUOTED' | 'APPROVED' | 'REJECTED' | 'IN_PROGRESS' | 'COMPLETED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  customer: { id: string; name: string };
  device: { id: string; deviceType: string; brand?: string | null; model?: string | null };
  createdAt: string;
  thumbnailUrl?: string | null;
  photoCount?: number;
};

const statusItems = [
  { id: 'ALL', label: 'All' },
  { id: 'PENDING', label: 'Pending' },
  { id: 'QUOTED', label: 'Quoted' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'IN_PROGRESS', label: 'In Progress' },
  { id: 'COMPLETED', label: 'Completed' },
];

export default function JobsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [filters, setFilters] = useState({ status: '', customer: '' });
  const [customerId, setCustomerId] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [quotedAmount, setQuotedAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

  const customersQuery = useQuery({
    queryKey: ['customers', 'forJobForm'],
    queryFn: async () => apiGet<Customer[]>('/api/customers'),
  });

  const devicesQuery = useQuery({
    queryKey: ['devices', customerId || 'all-for-job'],
    enabled: !!customerId,
    queryFn: async () => apiGet<Device[]>(`/api/devices?customerId=${encodeURIComponent(customerId)}`),
  });

  const jobsQuery = useQuery({
    queryKey: ['jobs', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.customer) params.set('customer', filters.customer);
      const qs = params.toString();
      return apiGet<Job[]>(`/api/jobs${qs ? `?${qs}` : ''}`);
    },
  });

  useEffect(() => {
    setDeviceId('');
  }, [customerId]);

  const createMutation = useMutation({
    mutationFn: async () =>
      apiPost<{ job: Job; qr_url: string }>(`/api/jobs`, {
        customerId,
        deviceId,
        title,
        description: description || undefined,
        priority,
        quotedAmount: quotedAmount ? Number(quotedAmount) : undefined,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      }),
    onSuccess: () => {
      setTitle('');
      setDescription('');
      setQuotedAmount('');
      setDueDate('');
      qc.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job created');
    },
    onError: (e: any) => {
      const msg = e?.message || 'Failed to create job';
      setError(msg);
      toast.error(msg);
    },
  });

  const customers = customersQuery.data || [];
  const devices = devicesQuery.data || [];

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiDelete(`/api/jobs/${id}`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job deleted');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to delete job'),
  });

  const statusValue = filters.status || 'ALL';

  return (
    <AuthGuard>
      <section className="space-y-6">
        <div className="rounded-xl border bg-card/80 px-6 py-5 shadow-sm backdrop-blur flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Jobs</p>
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-50">Jobs & Tickets</h1>
            <p className="text-sm text-muted-foreground">Track repair jobs and create new ones.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl
              items={statusItems}
              value={statusValue}
              onValueChange={(id) => setFilters((f) => ({ ...f, status: id === 'ALL' ? '' : id }))}
            />
            <input
              placeholder="Filter by customer name"
              value={filters.customer}
              onChange={(e) => setFilters((f) => ({ ...f, customer: e.target.value }))}
              className="w-56 rounded-md border border-input bg-background/80 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/80 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
            />
          </div>
        </div>

        {!hasAnyRole(user?.role, ['ADMIN', 'MANAGER', 'TECHNICIAN']) ? (
          <div className="rounded-md border border-amber-400/60 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            You have read-only access to jobs. Contact an administrator for edit permissions.
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="md:col-span-2 rounded-xl border bg-card/80 shadow-sm backdrop-blur">
            {jobsQuery.isLoading ? (
              <div className="p-6 text-sm text-muted-foreground">Loading...</div>
            ) : jobsQuery.isError ? (
              <div className="p-6 text-sm text-red-500">Error loading jobs</div>
            ) : (
              <div className="overflow-hidden rounded-xl">
                <table className="w-full text-sm">
                  <thead className="bg-slate-950/60 text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-4 py-3 text-left">Photo</th>
                      <th className="px-4 py-3 text-left">Title</th>
                      <th className="px-4 py-3 text-left">Customer</th>
                      <th className="px-4 py-3 text-left">Device</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Priority</th>
                      <th className="px-4 py-3 text-left">Created</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(jobsQuery.data || []).map((j, idx) => (
                      <tr
                        key={j.id}
                        className={`border-b border-slate-800/70 text-sm transition hover:bg-slate-900/70 ${idx % 2 === 0 ? 'bg-slate-950/40' : ''}`}
                      >
                        <td className="px-4 py-2">
                          {j.thumbnailUrl ? (
                            <div className="relative inline-block">
                              <img src={j.thumbnailUrl} alt="thumb" className="h-12 w-12 rounded object-cover" />
                              <span className="absolute -right-1 -top-1 rounded-full bg-black/80 px-1.5 py-0.5 text-[10px] text-white">
                                {j.photoCount ?? 1}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <Link href={`/jobs/${j.id}`} className="underline hover:no-underline">
                            {j.title}
                          </Link>
                        </td>
                        <td className="px-4 py-2">{j.customer?.name}</td>
                        <td className="px-4 py-2">
                          {[j.device?.deviceType, j.device?.brand, j.device?.model].filter(Boolean).join(' ')}
                        </td>
                        <td className="px-4 py-2">{j.status}</td>
                        <td className="px-4 py-2">{j.priority}</td>
                        <td className="px-4 py-2">{new Date(j.createdAt).toLocaleString()}</td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-2">
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/jobs/${j.id}`}>View</Link>
                            </Button>
                            {hasAnyRole(user?.role, ['ADMIN', 'MANAGER']) ? (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={async () => {
                                  const ok = await confirm({
                                    title: 'Delete job',
                                    description:
                                      'Are you sure you want to delete this job? This action cannot be undone.',
                                    variant: 'destructive',
                                    confirmText: 'Delete',
                                  });
                                  if (ok) deleteMutation.mutate(j.id);
                                }}
                                disabled={deleteMutation.isPending}
                              >
                                Delete
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {hasAnyRole(user?.role, ['ADMIN', 'MANAGER', 'TECHNICIAN']) ? (
            <div className="rounded-xl border bg-card/80 p-5 shadow-sm backdrop-blur">
              <h2 className="mb-3 text-lg font-semibold text-slate-50">New job</h2>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  setError(null);
                  createMutation.mutate();
                }}
              >
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="customer">
                    Customer
                  </label>
                  <select
                    id="customer"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full rounded-md border border-input bg-background/80 px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/80 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
                    required
                  >
                    <option value="" disabled className="bg-background text-foreground">
                      Select customer
                    </option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id} className="bg-background text-foreground">
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="device">
                    Device
                  </label>
                  <select
                    id="device"
                    value={deviceId}
                    onChange={(e) => setDeviceId(e.target.value)}
                    className="w-full rounded-md border border-input bg-background/80 px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/80 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
                    required
                    disabled={!customerId || devicesQuery.isLoading}
                  >
                    <option value="" disabled className="bg-background text-foreground">
                      {customerId ? 'Select device' : 'Select customer first'}
                    </option>
                    {devices.map((d) => (
                      <option key={d.id} value={d.id} className="bg-background text-foreground">
                        {[d.deviceType, d.brand, d.model].filter(Boolean).join(' ')}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="title">
                    Title
                  </label>
                  <input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-md border border-input bg-background/80 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/80 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="description">
                    Description (optional)
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="h-20 w-full rounded-md border border-input bg-background/80 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/80 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium" htmlFor="priority">
                      Priority
                    </label>
                    <select
                      id="priority"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as any)}
                      className="w-full rounded-md border border-input bg-background/80 px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/80 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
                    >
                      {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((p) => (
                        <option key={p} value={p} className="bg-background text-foreground">
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium" htmlFor="quoted">
                      Quoted (RM)
                    </label>
                    <input
                      id="quoted"
                      type="number"
                      step="0.01"
                      value={quotedAmount}
                      onChange={(e) => setQuotedAmount(e.target.value)}
                      className="w-full rounded-md border border-input bg-background/80 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/80 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="due">
                    Due date (optional)
                  </label>
                  <input
                    id="due"
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-md border border-input bg-background/80 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/80 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
                  />
                </div>
                {error ? <p className="text-sm text-red-500">{error}</p> : null}
                <Button className="w-full" type="submit" disabled={createMutation.isPending || !customerId || !deviceId}>
                  {createMutation.isPending ? 'Creating...' : 'Create job'}
                </Button>
              </form>
            </div>
          ) : null}
        </div>
      </section>
    </AuthGuard>
  );
}
