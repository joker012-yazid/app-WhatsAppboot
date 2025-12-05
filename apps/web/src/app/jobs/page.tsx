"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import AuthGuard from '@/components/auth-guard';
import { apiGet, apiPost, apiDelete, apiPut } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/toast-provider';
import { useAuth } from '@/lib/auth';
import { hasAnyRole } from '@/lib/roles';
import { Wrench, LayoutGrid, List } from 'lucide-react';
import { SectionHeader } from '@/components/section-header';
import { JobKanbanBoard } from '@/components/job-kanban-board';

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
  quotedAmount?: number | null;
  description?: string | null;
};

export default function JobsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [customerId, setCustomerId] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [quotedAmount, setQuotedAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const toast = useToast();

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
    queryKey: ['jobs'],
    queryFn: async () => apiGet<Job[]>(`/api/jobs`),
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

  const updateStatusMutation = useMutation({
    mutationFn: async ({ jobId, status }: { jobId: string; status: Job['status'] }) => {
      console.log('Updating job:', jobId, 'to status:', status);
      return apiPut(`/api/jobs/${jobId}`, { status });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job status updated');
    },
    onError: (e: any) => {
      console.error('Update error:', e);
      toast.error(e?.message || 'Failed to update job status');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiDelete(`/api/jobs/${id}`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job deleted');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to delete job'),
  });

  const customers = customersQuery.data || [];
  const devices = devicesQuery.data || [];
  const jobs = jobsQuery.data || [];

  const handleStatusChange = async (jobId: string, newStatus: Job['status']) => {
    await updateStatusMutation.mutateAsync({ jobId, status: newStatus });
  };

  return (
    <AuthGuard>
      <section className="space-y-6">
        <div className="rounded-xl border bg-gradient-to-br from-blue-900/20 to-cyan-900/20 px-6 py-5 shadow-lg backdrop-blur">
          <SectionHeader
            icon={<Wrench className="h-5 w-5" />}
            overline="Work Management"
            title="Repair Jobs Workflow"
            description="Track and manage repair jobs through the complete lifecycle with drag & drop."
            actions={
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-lg bg-cyan-900/20 border border-cyan-500/20 px-3 py-1.5">
                  <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse"></div>
                  <span className="text-sm font-semibold text-cyan-300">{jobs.length} Active</span>
                </div>
                <div className="flex rounded-lg border border-slate-800/70 bg-slate-950/60 p-1 shadow-inner">
                  <button
                    onClick={() => setViewMode('kanban')}
                    className={`flex items-center gap-2 rounded px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                      viewMode === 'kanban'
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/50'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <LayoutGrid className="h-4 w-4" />
                    Kanban
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`flex items-center gap-2 rounded px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                      viewMode === 'list'
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/50'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <List className="h-4 w-4" />
                    List
                  </button>
                </div>
              </div>
            }
          />
        </div>

        {!hasAnyRole(user?.role, ['ADMIN', 'MANAGER', 'TECHNICIAN']) ? (
          <div className="rounded-md border border-amber-400/60 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            You have read-only access to jobs. Contact an administrator for edit permissions.
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Kanban Board - Full Width or 3/4 */}
          <div className={`${hasAnyRole(user?.role, ['ADMIN', 'MANAGER', 'TECHNICIAN']) ? 'lg:col-span-3' : 'lg:col-span-4'}`}>
            {viewMode === 'kanban' ? (
              <div className="rounded-xl border bg-card/80 p-4 shadow-sm backdrop-blur">
                {jobsQuery.isLoading ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">Loading jobs...</div>
                ) : jobsQuery.isError ? (
                  <div className="p-6 text-center text-sm text-red-500">Error loading jobs</div>
                ) : jobs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-20 text-center text-muted-foreground">
                    <Wrench className="h-12 w-12 text-slate-600" />
                    <p className="text-sm font-medium text-slate-100">No jobs yet</p>
                    <p className="text-xs text-slate-400">Create your first repair job to get started.</p>
                  </div>
                ) : (
                  <JobKanbanBoard
                    jobs={jobs}
                    onStatusChange={handleStatusChange}
                    onDelete={(id) => deleteMutation.mutate(id)}
                    userRole={user?.role}
                  />
                )}
              </div>
            ) : (
              /* List View - Table */
              <div className="rounded-xl border bg-card/80 shadow-sm backdrop-blur overflow-hidden">
                {jobsQuery.isLoading ? (
                  <div className="p-6 text-sm text-muted-foreground">Loading...</div>
                ) : jobsQuery.isError ? (
                  <div className="p-6 text-sm text-red-500">Error loading jobs</div>
                ) : jobs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
                    <p className="text-sm font-medium text-slate-100">No jobs yet</p>
                    <p className="text-xs text-slate-400">Create your first job to get started.</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-950/60 text-xs uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="px-4 py-3 text-left">Title</th>
                        <th className="px-4 py-3 text-left">Customer</th>
                        <th className="px-4 py-3 text-left">Device</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-left">Priority</th>
                        <th className="px-4 py-3 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map((j, idx) => (
                        <tr
                          key={j.id}
                          className={`border-b border-slate-800/70 text-sm transition hover:bg-slate-900/70 ${idx % 2 === 0 ? 'bg-slate-950/40' : ''}`}
                        >
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
                          <td className="px-4 py-2">
                            <div className="flex gap-2">
                              <Button asChild size="sm" variant="outline">
                                <Link href={`/jobs/${j.id}`}>View</Link>
                              </Button>
                              {hasAnyRole(user?.role, ['ADMIN', 'MANAGER']) ? (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => deleteMutation.mutate(j.id)}
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
            )}
          </div>

          {/* New Job Form - Sidebar */}
          {hasAnyRole(user?.role, ['ADMIN', 'MANAGER', 'TECHNICIAN']) ? (
            <div className="rounded-xl border bg-card/80 p-5 shadow-sm backdrop-blur lg:col-span-1">
              <h2 className="mb-3 text-lg font-semibold text-slate-50">New Job</h2>
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
                    className="w-full rounded-md border border-input bg-background/80 px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/80"
                    required
                  >
                    <option value="">Select customer</option>
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
                    className="w-full rounded-md border border-input bg-background/80 px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/80"
                    required
                    disabled={!customerId || devicesQuery.isLoading}
                  >
                    <option value="">
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
                    className="w-full rounded-md border border-input bg-background/80 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/80"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="description">
                    Description
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="h-16 w-full rounded-md border border-input bg-background/80 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/80"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="priority">
                    Priority
                  </label>
                  <select
                    id="priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full rounded-md border border-input bg-background/80 px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/80"
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
                    className="w-full rounded-md border border-input bg-background/80 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/80"
                  />
                </div>
                {error ? <p className="text-sm text-red-500">{error}</p> : null}
                <Button className="w-full" type="submit" disabled={createMutation.isPending || !customerId || !deviceId}>
                  {createMutation.isPending ? 'Creating...' : 'Create Job'}
                </Button>
              </form>
            </div>
          ) : null}
        </div>
      </section>
    </AuthGuard>
  );
}
