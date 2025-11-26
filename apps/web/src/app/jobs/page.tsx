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
    // Reset device when customer changes
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

  return (
    <AuthGuard>
      <section className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Jobs</h1>
            <p className="text-sm text-muted-foreground">Track repair jobs and create new ones.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className="rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            >
              <option value="">All status</option>
              {['PENDING', 'QUOTED', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED'].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              placeholder="Filter by customer name"
              value={filters.customer}
              onChange={(e) => setFilters((f) => ({ ...f, customer: e.target.value }))}
              className="rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
          </div>
        </header>

        {!hasAnyRole(user?.role, ['ADMIN','MANAGER','TECHNICIAN']) ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            You have read-only access to jobs. Contact an administrator for edit permissions.
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="md:col-span-2 rounded-xl border bg-card p-4">
            {jobsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : jobsQuery.isError ? (
              <p className="text-sm text-red-500">Error loading jobs</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-2">Photo</th>
                    <th className="py-2">Title</th>
                    <th className="py-2">Customer</th>
                    <th className="py-2">Device</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Priority</th>
                    <th className="py-2">Created</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(jobsQuery.data || []).map((j) => (
                    <tr key={j.id} className="border-t">
                      <td className="py-2">
                        {j.thumbnailUrl ? (
                          <div className="relative inline-block">
                            <img src={j.thumbnailUrl} alt="thumb" className="h-12 w-12 rounded object-cover" />
                            <span className="absolute -right-1 -top-1 rounded-full bg-black/80 px-1.5 py-0.5 text-[10px] text-white">
                              {j.photoCount ?? 1}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2"><Link href={`/jobs/${j.id}`} className="underline hover:no-underline">{j.title}</Link></td>
                      <td className="py-2">{j.customer?.name}</td>
                      <td className="py-2">{[j.device?.deviceType, j.device?.brand, j.device?.model].filter(Boolean).join(' ')}</td>
                      <td className="py-2">{j.status}</td>
                      <td className="py-2">{j.priority}</td>
                      <td className="py-2">{new Date(j.createdAt).toLocaleString()}</td>
                      <td className="py-2">
                        <div className="flex gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/jobs/${j.id}`}>View</Link>
                          </Button>
                          {hasAnyRole(user?.role, ['ADMIN','MANAGER']) ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={async () => {
                              const ok = await confirm({
                                title: 'Delete job',
                                description: 'Are you sure you want to delete this job? This action cannot be undone.',
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
            )}
          </div>

          {hasAnyRole(user?.role, ['ADMIN','MANAGER','TECHNICIAN']) ? (
          <div className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 text-lg font-semibold">New job</h2>
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
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                  required
                >
                  <option value="" disabled>
                    Select customer
                  </option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
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
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                  required
                  disabled={!customerId || devicesQuery.isLoading}
                >
                  <option value="" disabled>
                    {customerId ? 'Select device' : 'Select customer first'}
                  </option>
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
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
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
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
                  className="h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
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
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                  >
                    {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((p) => (
                      <option key={p} value={p}>
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
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
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
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                />
              </div>
              {error ? <p className="text-sm text-red-500">{error}</p> : null}
              <Button className="w-full" type="submit" disabled={createMutation.isPending || !customerId || !deviceId}>
                {createMutation.isPending ? 'Creating…' : 'Create job'}
              </Button>
            </form>
          </div>
          ) : null}
        </div>
      </section>
    </AuthGuard>
  );
}
