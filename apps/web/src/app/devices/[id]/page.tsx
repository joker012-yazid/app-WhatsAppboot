"use client";

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import AuthGuard from '@/components/auth-guard';
import { apiDelete, apiGet, apiPut } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/toast-provider';
import { useConfirm } from '@/components/confirm-provider';
import { useAuth } from '@/lib/auth';
import { hasAnyRole } from '@/lib/roles';

type DeviceDetail = {
  id: string;
  deviceType: string;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  notes?: string | null;
  createdAt: string;
  customer: { id: string; name: string };
  jobs?: { id: string; title: string }[];
};

export default function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['device', id],
    queryFn: async () => apiGet<DeviceDetail>(`/api/devices/${id}`),
  });

  const d = q.data;

  const [deviceType, setDeviceType] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    if (!d) return;
    setDeviceType(d.deviceType || '');
    setBrand(d.brand || '');
    setModel(d.model || '');
    setSerialNumber(d.serialNumber || '');
    setNotes(d.notes || '');
  }, [d?.id]);

  const updateMutation = useMutation({
    mutationFn: async () =>
      apiPut(`/api/devices/${id}`, {
        deviceType,
        brand,
        model,
        serialNumber,
        notes,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['device', id] });
      await qc.invalidateQueries({ queryKey: ['devices'] });
      toast.success('Device updated');
    },
    onError: (e: any) => {
      const msg = e?.message || 'Failed to save';
      setError(msg);
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => apiDelete(`/api/devices/${id}`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['devices'] });
      toast.success('Device deleted');
      router.replace('/devices');
    },
    onError: (e: any) => {
      const msg = e?.message || 'Failed to delete';
      setError(msg);
      toast.error(msg);
    },
  });

  return (
    <AuthGuard>
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Device Detail</p>
            <h1 className="text-2xl font-semibold">{d ? `${d.deviceType} ${d.brand || ''} ${d.model || ''}` : 'Loading…'}</h1>
            {d ? (
              <p className="text-sm text-muted-foreground">{d.customer.name}</p>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/devices">Back</Link>
            </Button>
            {hasAnyRole(user?.role, ['ADMIN','MANAGER']) ? (
              <Button
                variant="destructive"
                disabled={!!d?.jobs && d.jobs.length > 0 || deleteMutation.isPending}
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Delete device',
                    description: 'Are you sure you want to delete this device? This action cannot be undone.',
                    variant: 'destructive',
                    confirmText: 'Delete',
                  });
                  if (ok) deleteMutation.mutate();
                }}
              >
                {d?.jobs && d.jobs.length > 0 ? 'Has jobs' : 'Delete'}
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="md:col-span-2 rounded-xl border bg-card p-4">
            <h2 className="mb-3 text-lg font-semibold">Edit Device</h2>
            {!hasAnyRole(user?.role, ['ADMIN','MANAGER','TECHNICIAN']) ? (
              <p className="mb-3 text-sm text-amber-700">You have read-only access. Editing is restricted to Admin/Manager/Technician.</p>
            ) : null}
            {d?.jobs && d.jobs.length > 0 ? (
              <p className="mb-3 text-sm text-amber-600">This device has {d.jobs.length} job(s). Deletion is disabled.</p>
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
                  <label className="text-sm font-medium" htmlFor="type">
                    Device type
                  </label>
                  <input
                    id="type"
                    value={deviceType}
                    onChange={(e) => setDeviceType(e.target.value)}
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                    required
                    disabled={!hasAnyRole(user?.role, ['ADMIN','MANAGER','TECHNICIAN'])}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="brand">
                    Brand
                  </label>
                  <input
                    id="brand"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                    disabled={!hasAnyRole(user?.role, ['ADMIN','MANAGER','TECHNICIAN'])}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="model">
                    Model
                  </label>
                  <input
                    id="model"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                    disabled={!hasAnyRole(user?.role, ['ADMIN','MANAGER','TECHNICIAN'])}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="serial">
                    Serial
                  </label>
                  <input
                    id="serial"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                    disabled={!hasAnyRole(user?.role, ['ADMIN','MANAGER','TECHNICIAN'])}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium" htmlFor="notes">
                  Notes
                </label>
                <input
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                  disabled={!hasAnyRole(user?.role, ['ADMIN','MANAGER','TECHNICIAN'])}
                />
              </div>
              {error ? <p className="text-sm text-red-500">{error}</p> : null}
              {hasAnyRole(user?.role, ['ADMIN','MANAGER','TECHNICIAN']) ? (
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving…' : 'Save changes'}
                </Button>
              ) : null}
            </form>
          </div>

          <aside className="rounded-xl border bg-card p-4">
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Related Jobs</h3>
            {!d ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : !d.jobs || d.jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No jobs.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {d.jobs.map((j) => (
                  <li key={j.id}>
                    <Link href={`/jobs/${j.id}`} className="underline hover:no-underline">
                      {j.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </section>
    </AuthGuard>
  );
}
