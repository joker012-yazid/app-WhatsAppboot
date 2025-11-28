"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import AuthGuard from '@/components/auth-guard';
import Link from 'next/link';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import { useToast } from '@/components/toast-provider';
import { useConfirm } from '@/components/confirm-provider';
import { useAuth } from '@/lib/auth';
import { hasAnyRole } from '@/lib/roles';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/section-header';
import { Inbox, MonitorSmartphone } from 'lucide-react';

type Customer = { id: string; name: string };
type Device = {
  id: string;
  deviceType: string;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  customer: { id: string; name: string };
  createdAt: string;
  _count?: { jobs: number };
};

export default function DevicesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [customerId, setCustomerId] = useState<string>('');
  const [deviceType, setDeviceType] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

  const customersQuery = useQuery({
    queryKey: ['customers', 'forDeviceForm'],
    queryFn: async () => apiGet<Customer[]>('/api/customers'),
  });

  const devicesQuery = useQuery({
    queryKey: ['devices', customerId || 'all'],
    queryFn: async () =>
      apiGet<Device[]>(`/api/devices${customerId ? `?customerId=${encodeURIComponent(customerId)}` : ''}`),
  });

  const createMutation = useMutation({
    mutationFn: async () =>
      apiPost<Device>('/api/devices', {
        customerId,
        deviceType,
        brand: brand || undefined,
        model: model || undefined,
        serialNumber: serialNumber || undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      setDeviceType('');
      setBrand('');
      setModel('');
      setSerialNumber('');
      setNotes('');
      qc.invalidateQueries({ queryKey: ['devices'] });
      toast.success('Device created');
    },
    onError: (e: any) => {
      const msg = e?.message || 'Failed to create device';
      setError(msg);
      toast.error(msg);
    },
  });

  const customers = customersQuery.data || [];
  const selectedCustomer = useMemo(() => customers.find((c) => c.id === customerId), [customers, customerId]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiDelete(`/api/devices/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devices'] });
      toast.success('Device deleted');
    },
    onError: (e: any) => {
      const msg = e?.message || 'Failed to delete device';
      setError(msg);
      toast.error(msg);
    },
  });

  return (
    <AuthGuard>
      <section className="space-y-6">
        <div className="rounded-xl border bg-card/80 px-6 py-5 shadow-sm backdrop-blur">
          <SectionHeader
            icon={<MonitorSmartphone className="h-4 w-4" />}
            overline="Devices"
            title="Registered Devices"
            description="Filter by customer and add new devices."
            actions={
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="min-w-52 rounded-md border border-input bg-background/80 px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/80 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
              >
                <option value="" className="bg-background text-foreground">
                  All customers
                </option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id} className="bg-background text-foreground">
                    {c.name}
                  </option>
                ))}
              </select>
            }
          />
        </div>

        {!hasAnyRole(user?.role, ['ADMIN', 'MANAGER', 'TECHNICIAN']) ? (
          <div className="rounded-md border border-amber-400/60 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            You have read-only access to devices. Contact an administrator for edit permissions.
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="md:col-span-2 rounded-xl border bg-card/80 shadow-sm backdrop-blur">
            {devicesQuery.isLoading ? (
              <div className="p-6 text-sm text-muted-foreground">Loading...</div>
            ) : devicesQuery.isError ? (
              <div className="p-6 text-sm text-red-500">Error loading devices</div>
            ) : (devicesQuery.data?.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
                <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-slate-800 bg-slate-950/60">
                  <Inbox className="h-7 w-7 text-slate-500" />
                </div>
                <p className="text-sm font-medium text-slate-100">No devices yet</p>
                <p className="text-xs text-slate-400">Add devices to start tracking repairs and links to customers.</p>
                {hasAnyRole(user?.role, ['ADMIN', 'MANAGER', 'TECHNICIAN']) ? (
                  <Button size="sm" className="mt-2" asChild>
                    <Link href="/devices">Add your first device</Link>
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl">
                <table className="w-full text-sm">
                  <thead className="bg-slate-950/60 text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-4 py-3 text-left">Customer</th>
                      <th className="px-4 py-3 text-left">Type</th>
                      <th className="px-4 py-3 text-left">Brand</th>
                      <th className="px-4 py-3 text-left">Model</th>
                      <th className="px-4 py-3 text-left">Serial</th>
                      <th className="px-4 py-3 text-left">Created</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(devicesQuery.data || []).map((d, idx) => (
                      <tr
                        key={d.id}
                        className={`border-b border-slate-800/70 text-sm transition hover:bg-slate-900/70 ${idx % 2 === 0 ? 'bg-slate-950/40' : ''}`}
                      >
                        <td className="px-4 py-2">{d.customer?.name}</td>
                        <td className="px-4 py-2">{d.deviceType}</td>
                        <td className="px-4 py-2">{d.brand || '-'}</td>
                        <td className="px-4 py-2">{d.model || '-'}</td>
                        <td className="px-4 py-2">{d.serialNumber || '-'}</td>
                        <td className="px-4 py-2">{new Date(d.createdAt).toLocaleString()}</td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-2">
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/devices/${d.id}`}>View</Link>
                            </Button>
                            {hasAnyRole(user?.role, ['ADMIN', 'MANAGER']) ? (
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={(!!d._count && d._count.jobs > 0) || deleteMutation.isPending}
                                onClick={async () => {
                                  const ok = await confirm({
                                    title: 'Delete device',
                                    description:
                                      'Are you sure you want to delete this device? This action cannot be undone.',
                                    variant: 'destructive',
                                    confirmText: 'Delete',
                                  });
                                  if (ok) deleteMutation.mutate(d.id);
                                }}
                              >
                                {d._count && d._count.jobs > 0 ? 'Has jobs' : 'Delete'}
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
              <h2 className="mb-3 text-lg font-semibold text-slate-50">New device</h2>
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
                  <label className="text-sm font-medium" htmlFor="deviceType">
                    Device type
                  </label>
                  <input
                    id="deviceType"
                    value={deviceType}
                    onChange={(e) => setDeviceType(e.target.value)}
                    className="w-full rounded-md border border-input bg-background/80 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/80 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
                    placeholder="Phone / Tablet / PC"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium" htmlFor="brand">
                      Brand
                    </label>
                    <input
                      id="brand"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      className="w-full rounded-md border border-input bg-background/80 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/80 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium" htmlFor="model">
                      Model
                    </label>
                    <input
                      id="model"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full rounded-md border border-input bg-background/80 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/80 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium" htmlFor="serial">
                      Serial
                    </label>
                    <input
                      id="serial"
                      value={serialNumber}
                      onChange={(e) => setSerialNumber(e.target.value)}
                      className="w-full rounded-md border border-input bg-background/80 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/80 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium" htmlFor="notes">
                      Notes
                    </label>
                    <input
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full rounded-md border border-input bg-background/80 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/80 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
                    />
                  </div>
                </div>
                {error ? <p className="text-sm text-red-500">{error}</p> : null}
                <Button className="w-full" type="submit" disabled={createMutation.isPending || !customerId}>
                  {createMutation.isPending ? 'Creating...' : `Add device${selectedCustomer ? ` for ${selectedCustomer.name}` : ''}`}
                </Button>
              </form>
            </div>
          ) : null}
        </div>
      </section>
    </AuthGuard>
  );
}
