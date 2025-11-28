"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import AuthGuard from '@/components/auth-guard';
import { apiDelete, apiGet, apiPost } from '@/lib/api';
import { useToast } from '@/components/toast-provider';
import { useConfirm } from '@/components/confirm-provider';
import { useAuth } from '@/lib/auth';
import { hasAnyRole } from '@/lib/roles';
import { Button } from '@/components/ui/button';

type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
  createdAt: string;
  _count?: { devices: number; jobs: number };
};

export default function CustomersPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

  const listQuery = useQuery({
    queryKey: ['customers', search],
    queryFn: async () =>
      apiGet<Customer[]>(`/api/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  });

  const createMutation = useMutation({
    mutationFn: async () =>
      apiPost<Customer>('/api/customers', { name, phone, email: email || undefined, notes: notes || undefined }),
    onSuccess: () => {
      setName('');
      setPhone('');
      setEmail('');
      setNotes('');
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer created');
    },
    onError: (e: any) => {
      const msg = e?.message || 'Failed to create customer';
      setError(msg);
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiDelete(`/api/customers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer deleted');
    },
    onError: (e: any) => {
      const msg = e?.message || 'Failed to delete customer';
      setError(msg);
      toast.error(msg);
    },
  });

  return (
    <AuthGuard>
      <section className="space-y-6">
        <div className="rounded-xl border bg-card/80 px-6 py-5 shadow-sm backdrop-blur flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Customers</p>
            <h1 className="text-2xl md:text-3xl font-semibold text-slate-50">Customer Directory</h1>
            <p className="text-sm text-muted-foreground">Search, view and create customers.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or phone"
              className="w-64 rounded-md border border-input bg-background/80 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/80 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
            />
          </div>
        </div>

        {!hasAnyRole(user?.role, ['ADMIN', 'MANAGER']) ? (
          <div className="rounded-md border border-amber-400/60 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            You have read-only access to customers. Contact an administrator for edit permissions.
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="md:col-span-2 rounded-xl border bg-card/80 shadow-sm backdrop-blur">
            {listQuery.isLoading ? (
              <div className="p-6 text-sm text-muted-foreground">Loading...</div>
            ) : listQuery.isError ? (
              <div className="p-6 text-sm text-red-500">Error loading customers</div>
            ) : (
              <div className="overflow-hidden rounded-xl">
                <table className="w-full text-sm">
                  <thead className="bg-slate-950/60 text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-4 py-3 text-left">Name</th>
                      <th className="px-4 py-3 text-left">Phone</th>
                      <th className="px-4 py-3 text-left">Email</th>
                      <th className="px-4 py-3 text-left">Created</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listQuery.data?.map((c, idx) => (
                      <tr
                        key={c.id}
                        className={`border-b border-slate-800/70 text-sm transition hover:bg-slate-900/70 ${idx % 2 === 0 ? 'bg-slate-950/40' : ''}`}
                      >
                        <td className="px-4 py-2">{c.name}</td>
                        <td className="px-4 py-2">{c.phone}</td>
                        <td className="px-4 py-2">{c.email || '-'}</td>
                        <td className="px-4 py-2">{new Date(c.createdAt).toLocaleString()}</td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-2">
                            <Button asChild size="sm" variant="outline">
                              <a href={`/customers/${c.id}`}>View</a>
                            </Button>
                            {hasAnyRole(user?.role, ['ADMIN', 'MANAGER']) ? (
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={
                                  (!!c._count && (c._count.devices > 0 || c._count.jobs > 0)) ||
                                  deleteMutation.isPending
                                }
                                onClick={async () => {
                                  const ok = await confirm({
                                    title: 'Delete customer',
                                    description:
                                      'Are you sure you want to delete this customer? This action cannot be undone.',
                                    variant: 'destructive',
                                    confirmText: 'Delete',
                                  });
                                  if (ok) deleteMutation.mutate(c.id);
                                }}
                              >
                                {c._count && (c._count.devices > 0 || c._count.jobs > 0)
                                  ? 'Has records'
                                  : 'Delete'}
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

          {hasAnyRole(user?.role, ['ADMIN', 'MANAGER']) ? (
            <div className="rounded-xl border bg-card/80 p-5 shadow-sm backdrop-blur">
              <h2 className="mb-3 text-lg font-semibold text-slate-50">New customer</h2>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  setError(null);
                  createMutation.mutate();
                }}
              >
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="name">
                    Name
                  </label>
                  <input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-md border border-input bg-background/80 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/80 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="phone">
                    Phone
                  </label>
                  <input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-md border border-input bg-background/80 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/80 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="email">
                    Email (optional)
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-md border border-input bg-background/80 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/80 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="notes">
                    Notes (optional)
                  </label>
                  <textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="h-20 w-full rounded-md border border-input bg-background/80 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/80 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
                  />
                </div>
                {error ? <p className="text-sm text-red-500">{error}</p> : null}
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create customer'}
                </Button>
              </form>
            </div>
          ) : null}
        </div>
      </section>
    </AuthGuard>
  );
}
