"use client";

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AuthGuard from '@/components/auth-guard';
import { apiGet, apiPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/toast-provider';
import { Megaphone, Inbox } from 'lucide-react';
import { SectionHeader } from '@/components/section-header';

const campaignKinds = ['PROMOTIONAL', 'ANNOUNCEMENT', 'FOLLOW_UP', 'CUSTOM'] as const;
const customerTypes = ['VIP', 'REGULAR', 'NEW', 'PROSPECT'] as const;

type CampaignListItem = {
  id: string;
  name: string;
  kind: string;
  status: string;
  targetCount: number;
  sentCount: number;
  failedCount: number;
  dailyLimit: number;
  createdAt: string;
  scheduledFor?: string | null;
  startedAt?: string | null;
};

type PreviewResponse = {
  totalCustomers: number;
  sample: { customerId: string | null; name: string; phone: string }[];
  manualTargets: { name: string; phone: string }[];
  manualCount: number;
};

const timeToMinutes = (value: string) => {
  if (!value) return 0;
  const [hours, minutes] = value.split(':').map((part) => Number(part));
  return hours * 60 + minutes;
};

export default function CampaignsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState('New Campaign');
  const [kind, setKind] = useState<(typeof campaignKinds)[number]>('PROMOTIONAL');
  const [message, setMessage] = useState('Hi {name}, kami ada promo terbaru minggu ini. Balas jika berminat!');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['REGULAR']);
  const [tags, setTags] = useState('');
  const [excludeTags, setExcludeTags] = useState('OPT_OUT');
  const [lastVisitDays, setLastVisitDays] = useState('90');
  const [inactiveDays, setInactiveDays] = useState('');
  const [manualPhones, setManualPhones] = useState('');
  const [businessStart, setBusinessStart] = useState('09:00');
  const [businessEnd, setBusinessEnd] = useState('18:00');
  const [dailyLimit, setDailyLimit] = useState('150');
  const [delayMin, setDelayMin] = useState('30');
  const [delayMax, setDelayMax] = useState('60');
  const [scheduledFor, setScheduledFor] = useState('');
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);

  const listQuery = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => apiGet<CampaignListItem[]>('/api/campaigns'),
  });

  const buildFiltersPayload = () => {
    const manualList = manualPhones
      .split(/\n|,/)
      .map((v) => v.trim())
      .filter(Boolean);
    return {
      customerTypes: selectedTypes.length ? selectedTypes : undefined,
      tags: tags ? tags.split(',').map((tag) => tag.trim()).filter(Boolean) : undefined,
      excludeTags: excludeTags ? excludeTags.split(',').map((tag) => tag.trim()).filter(Boolean) : undefined,
      lastVisitDays: lastVisitDays ? Number(lastVisitDays) : undefined,
      inactiveDays: inactiveDays ? Number(inactiveDays) : undefined,
      manualPhones: manualList.length ? manualList : undefined,
    };
  };

  const createCampaign = useMutation({
    mutationFn: async () =>
      apiPost('/api/campaigns', {
        name,
        kind,
        message,
        filters: buildFiltersPayload(),
        businessHours: { start: timeToMinutes(businessStart), end: timeToMinutes(businessEnd) },
        dailyLimit: Number(dailyLimit) || 150,
        randomDelay: { min: Number(delayMin) || 30, max: Number(delayMax) || 60 },
        scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : undefined,
      }),
    onSuccess: () => {
      toast.success('Campaign saved');
      qc.invalidateQueries({ queryKey: ['campaigns'] });
    },
    onError: (err: any) => toast.error(err?.message || 'Unable to save campaign'),
  });

  const previewTargets = useMutation({
    mutationFn: async () => apiPost<PreviewResponse>('/api/campaigns/preview', { filters: buildFiltersPayload() }),
    onSuccess: (data) => setPreviewData(data),
    onError: (err: any) => toast.error(err?.message || 'Preview failed'),
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'start' | 'pause' | 'resume' | 'cancel' }) =>
      apiPost(`/api/campaigns/${id}/${action}`, {}),
    onSuccess: (_, vars) => {
      toast.success(`Campaign ${vars.action}`);
      qc.invalidateQueries({ queryKey: ['campaigns'] });
    },
    onError: (err: any) => toast.error(err?.message || 'Action failed'),
  });

  const statusClass = (status: string) => {
    switch (status) {
      case 'RUNNING':
        return 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300';
      case 'PAUSED':
        return 'bg-amber-500/20 text-amber-700 dark:text-amber-300';
      case 'COMPLETED':
        return 'bg-blue-500/20 text-blue-700 dark:text-blue-300';
      case 'CANCELLED':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <AuthGuard>
      <section className="space-y-8">
        <div className="rounded-xl border bg-card/80 px-6 py-5 shadow-sm backdrop-blur">
          <SectionHeader
            icon={<Megaphone className="h-4 w-4" />}
            overline="Campaigns"
            title="Campaigns"
            description="Configure outbound WhatsApp campaigns with anti-ban rules."
            actions={
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => previewTargets.mutate()} disabled={previewTargets.isPending}>
                  {previewTargets.isPending ? 'Previewing...' : 'Preview filters'}
                </Button>
                <Button onClick={() => createCampaign.mutate()} disabled={createCampaign.isPending}>
                  {createCampaign.isPending ? 'Saving...' : 'Save Draft'}
                </Button>
              </div>
            }
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 rounded-xl border bg-card p-4 lg:col-span-2">
            <h2 className="font-semibold">Campaign brief</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium">Name</span>
                <input className="w-full rounded-md border bg-transparent px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Kind</span>
                <select className="w-full rounded-md border bg-background px-3 py-2 text-foreground" value={kind} onChange={(e) => setKind(e.target.value as any)}>
                  {campaignKinds.map((k) => (
                    <option key={k} value={k} className="bg-background text-foreground">
                      {k.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Business hours (start)</span>
                <input type="time" className="w-full rounded-md border bg-transparent px-3 py-2" value={businessStart} onChange={(e) => setBusinessStart(e.target.value)} />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Business hours (end)</span>
                <input type="time" className="w-full rounded-md border bg-transparent px-3 py-2" value={businessEnd} onChange={(e) => setBusinessEnd(e.target.value)} />
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium">Daily limit</span>
                <input type="number" className="w-full rounded-md border bg-transparent px-3 py-2" value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Delay min (s)</span>
                  <input type="number" className="w-full rounded-md border bg-transparent px-3 py-2" value={delayMin} onChange={(e) => setDelayMin(e.target.value)} />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium">Delay max (s)</span>
                  <input type="number" className="w-full rounded-md border bg-transparent px-3 py-2" value={delayMax} onChange={(e) => setDelayMax(e.target.value)} />
                </label>
              </div>
              <label className="space-y-1 text-sm md:col-span-2">
                <span className="font-medium">Schedule (optional)</span>
                <input type="datetime-local" className="w-full rounded-md border bg-transparent px-3 py-2" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} />
              </label>
            </div>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Message Template</span>
              <textarea className="min-h-[140px] w-full rounded-md border bg-transparent px-3 py-2" value={message} onChange={(e) => setMessage(e.target.value)} />
              <p className="text-xs text-muted-foreground">Use variables like {'{name}'} or {'{phone}'}. Delays & business hours are enforced automatically.</p>
            </label>
          </div>

          <div className="space-y-4 rounded-xl border bg-card p-4">
            <h2 className="font-semibold">Filters</h2>
            <div className="space-y-2 text-sm">
              <div>
                <p className="font-medium">Customer Types</p>
                <div className="flex flex-wrap gap-2 pt-1 text-xs">
                  {customerTypes.map((type) => (
                    <button
                      type="button"
                      key={type}
                      onClick={() =>
                        setSelectedTypes((prev) =>
                          prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
                        )
                      }
                      className={`rounded-full border px-3 py-1 ${
                        selectedTypes.includes(type) ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <label className="space-y-1">
                <span className="font-medium">Include tags (comma separated)</span>
                <input className="w-full rounded-md border bg-transparent px-3 py-2" value={tags} onChange={(e) => setTags(e.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="font-medium">Exclude tags</span>
                <input className="w-full rounded-md border bg-transparent px-3 py-2" value={excludeTags} onChange={(e) => setExcludeTags(e.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="font-medium">Last visit within (days)</span>
                <input type="number" className="w-full rounded-md border bg-transparent px-3 py-2" value={lastVisitDays} onChange={(e) => setLastVisitDays(e.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="font-medium">Inactive for at least (days)</span>
                <input type="number" className="w-full rounded-md border bg-transparent px-3 py-2" value={inactiveDays} onChange={(e) => setInactiveDays(e.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="font-medium">Manual phone numbers</span>
                <textarea className="h-24 w-full rounded-md border bg-transparent px-3 py-2" value={manualPhones} onChange={(e) => setManualPhones(e.target.value)} placeholder="Separate numbers with commas or new lines" />
              </label>
            </div>
            {previewData ? (
              <div className="rounded-lg border bg-background p-3 text-xs">
                <p className="font-semibold">Preview</p>
                <p className="text-muted-foreground">Matches: {previewData.totalCustomers} | Manual: {previewData.manualCount}</p>
                <ul className="mt-2 space-y-1">
                  {previewData.sample.slice(0, 5).map((row) => (
                    <li key={`${row.phone}-${row.customerId}`} className="flex justify-between">
                      <span>{row.name}</span>
                      <span className="font-mono">{row.phone}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Existing campaigns</h2>
            <Button variant="ghost" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ['campaigns'] })}>
              Refresh
            </Button>
          </div>
          {listQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading campaigns...</p>
          ) : listQuery.isError ? (
            <p className="text-sm text-red-500">Failed to load campaigns</p>
          ) : !listQuery.data?.length ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
              <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-slate-800 bg-slate-950/60">
                <Inbox className="h-7 w-7 text-slate-500" />
              </div>
              <p className="text-sm font-medium text-slate-100">No campaigns yet</p>
              <p className="text-xs text-slate-400">Draft a campaign and preview your filters to begin outreach.</p>
              <Button
                size="sm"
                className="mt-2"
                onClick={() => createCampaign.mutate()}
                disabled={createCampaign.isPending}
              >
                {createCampaign.isPending ? 'Saving...' : 'Create your first campaign'}
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {listQuery.data.map((campaign) => (
                <article key={campaign.id} className="rounded-xl border bg-card p-4">
                  <header className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{campaign.kind}</p>
                      <h3 className="text-lg font-semibold">{campaign.name}</h3>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClass(campaign.status)}`}>
                      {campaign.status}
                    </span>
                  </header>
                  <dl className="mt-3 grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Targets</dt>
                      <dd className="text-base font-semibold">{campaign.targetCount}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Sent</dt>
                      <dd className="text-base font-semibold text-emerald-600">{campaign.sentCount}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Failed</dt>
                      <dd className="text-base font-semibold text-red-600">{campaign.failedCount}</dd>
                    </div>
                  </dl>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    {campaign.scheduledFor ? (
                      <span className="rounded bg-muted px-2 py-1">Scheduled: {new Date(campaign.scheduledFor).toLocaleString()}</span>
                    ) : null}
                    {campaign.startedAt ? (
                      <span className="rounded bg-muted px-2 py-1">Started: {new Date(campaign.startedAt).toLocaleString()}</span>
                    ) : null}
                    <span className="rounded bg-muted px-2 py-1">Daily limit: {campaign.dailyLimit}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-sm">
                    {['DRAFT', 'SCHEDULED', 'PAUSED'].includes(campaign.status as any) ? (
                      <Button size="sm" onClick={() => actionMutation.mutate({ id: campaign.id, action: 'start' })} disabled={actionMutation.isPending}>
                        Start
                      </Button>
                    ) : null}
                    {campaign.status === 'RUNNING' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => actionMutation.mutate({ id: campaign.id, action: 'pause' })}
                        disabled={actionMutation.isPending}
                      >
                        Pause
                      </Button>
                    ) : null}
                    {campaign.status === 'PAUSED' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => actionMutation.mutate({ id: campaign.id, action: 'resume' })}
                        disabled={actionMutation.isPending}
                      >
                        Resume
                      </Button>
                    ) : null}
                    {!['COMPLETED', 'CANCELLED'].includes(campaign.status) ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => actionMutation.mutate({ id: campaign.id, action: 'cancel' })}
                        disabled={actionMutation.isPending}
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </AuthGuard>
  );
}
