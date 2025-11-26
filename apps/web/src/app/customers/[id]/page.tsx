"use client";

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import AuthGuard from '@/components/auth-guard';
import { apiDelete, apiGet, apiPut } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/toast-provider';
import { useConfirm } from '@/components/confirm-provider';
import { useAuth } from '@/lib/auth';
import { hasAnyRole } from '@/lib/roles';

type DeviceLite = { id: string; deviceType: string; brand?: string | null; model?: string | null };
type JobLite = { id: string; title: string; device?: DeviceLite | null; createdAt: string };
type CustomerDetail = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
  createdAt: string;
  _count?: { devices: number; jobs: number };
  devices: DeviceLite[];
  jobs: JobLite[];
};

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['customer', id], queryFn: async () => apiGet<CustomerDetail>(`/api/customers/${id}`) });
  const { user } = useAuth();

  const c = q.data;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    if (!c) return;
    setName(c.name);
    setPhone(c.phone);
    setEmail(c.email || '');
    setNotes(c.notes || '');
  }, [c?.id]);

  const updateMutation = useMutation({
    mutationFn: async () => apiPut(`/api/customers/${id}`, { name, phone, email, notes }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['customer', id] });
      await qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer updated');
    },
    onError: (e: any) => {
      const msg = e?.message || 'Failed to save';
      setError(msg);
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => apiDelete(`/api/customers/${id}`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Customer deleted');
      router.replace('/customers');
    },
    onError: (e: any) => {
      const msg = e?.message || 'Failed to delete';
      setError(msg);
      toast.error(msg);
    },
  });

  const hasRecords = !!c && (c._count?.devices || 0) + (c._count?.jobs || 0) > 0;

  return (
    <AuthGuard>
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Customer Detail</p>
            <h1 className="text-2xl font-semibold">{c ? c.name : 'Loading…'}</h1>
            {c ? <p className="text-sm text-muted-foreground">{c.phone}</p> : null}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/customers">Back</Link>
            </Button>
            {hasAnyRole(user?.role, ['ADMIN','MANAGER']) ? (
              <Button
                variant="destructive"
                disabled={hasRecords || deleteMutation.isPending}
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Delete customer',
                    description: 'Are you sure you want to delete this customer? This action cannot be undone.',
                    variant: 'destructive',
                    confirmText: 'Delete',
                  });
                  if (ok) deleteMutation.mutate();
                }}
              >
                {hasRecords ? 'Has records' : 'Delete'}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="md:col-span-2 rounded-xl border bg-card p-4">
            <h2 className="mb-3 text-lg font-semibold">Edit Customer</h2>
            {!hasAnyRole(user?.role, ['ADMIN','MANAGER']) ? (
              <p className="mb-3 text-sm text-amber-700">You have read-only access. Editing is restricted to Admin/Manager.</p>
            ) : null}
            {hasRecords ? (
              <p className="mb-3 text-sm text-muted-foreground">This customer has related records. You can update details but deletion is disabled.</p>
            ) : null}
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                updateMutation.mutate();
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="name">Name</label>
                  <input id="name" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" required disabled={!hasAnyRole(user?.role, ['ADMIN','MANAGER'])} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="phone">Phone</label>
                  <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" required disabled={!hasAnyRole(user?.role, ['ADMIN','MANAGER'])} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="email">Email</label>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" disabled={!hasAnyRole(user?.role, ['ADMIN','MANAGER'])} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="notes">Notes</label>
                <input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" disabled={!hasAnyRole(user?.role, ['ADMIN','MANAGER'])} />
              </div>
              {error ? <p className="text-sm text-red-500">{error}</p> : null}
              {hasAnyRole(user?.role, ['ADMIN','MANAGER']) ? (
                <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Saving…' : 'Save changes'}</Button>
              ) : null}
            </form>
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl border bg-card p-4">
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Devices</h3>
              {!c ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : c.devices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No devices.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {c.devices.map((d) => (
                    <li key={d.id}>
                      <Link href={`/devices/${d.id}`} className="underline hover:no-underline">
                        {[d.deviceType, d.brand, d.model].filter(Boolean).join(' ')}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border bg-card p-4">
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Jobs</h3>
              {!c ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : c.jobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No jobs.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {c.jobs.map((j) => (
                    <li key={j.id} className="flex items-center justify-between gap-2">
                      <Link href={`/jobs/${j.id}`} className="underline hover:no-underline">
                        {j.title}
                      </Link>
                      <span className="text-xs text-muted-foreground">{new Date(j.createdAt).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </section>
    </AuthGuard>
  );
}
