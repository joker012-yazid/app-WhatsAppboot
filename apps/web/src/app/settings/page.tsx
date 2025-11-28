"use client";

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Cpu,
  HardDrive,
  MessageCircle,
  Inbox,
  ServerCog,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Timer,
  Settings2,
  RefreshCw,
} from 'lucide-react';

import AuthGuard from '@/components/auth-guard';
import { Button } from '@/components/ui/button';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import { useToast } from '@/components/toast-provider';
import { useAuth } from '@/lib/auth';
import { hasAnyRole } from '@/lib/roles';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SectionHeader } from '@/components/section-header';
import { useWhatsappChat } from '@/hooks/use-whatsapp-chat';
import { useWhatsappSession } from '@/hooks/use-whatsapp-session';
import { cn } from '@/lib/utils';

const defaultGeneral = {
  companyName: '',
  businessEmail: '',
  businessPhone: '',
  taxRate: 6,
  currency: 'MYR',
  businessHours: { start: '09:00', end: '18:00', timezone: 'Asia/Kuala_Lumpur' },
  terms: '',
};

const defaultWhatsapp = {
  businessNumber: '',
  sessionName: 'primary',
  dailyLimit: 150,
  randomDelayMin: 30,
  randomDelayMax: 60,
  respectBusinessHours: true,
  optOutKeywords: ['STOP', 'UNSUBSCRIBE'],
};

const defaultAi = {
  provider: 'openai',
  apiKey: '',
  baseUrl: '',
  model: 'gpt-4o-mini',
  temperature: 0.2,
  maxTokens: 512,
};

const defaultBackup = {
  manualEnabled: true,
  includeUploads: true,
  retentionDays: 30,
  schedule: '02:00',
  notifyEmail: '',
};

type SettingsResponse = {
  general: typeof defaultGeneral;
  whatsapp: typeof defaultWhatsapp;
  ai: typeof defaultAi;
  backup: typeof defaultBackup;
};

type SettingKey = keyof SettingsResponse;

type UpdatePayload<K extends SettingKey = SettingKey> = {
  key: K;
  value: SettingsResponse[K];
};

type BackupSummary = {
  filename: string;
  createdAt: string;
  size: number;
};

export default function SettingsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const canEdit = hasAnyRole(user?.role, ['ADMIN', 'MANAGER']);
  const qc = useQueryClient();

  const [general, setGeneral] = useState(defaultGeneral);
  const [whatsapp, setWhatsapp] = useState(defaultWhatsapp);
  const [ai, setAi] = useState(defaultAi);
  const [backup, setBackup] = useState(defaultBackup);
  const [keywordsText, setKeywordsText] = useState('STOP, UNSUBSCRIBE');
  const [savingKey, setSavingKey] = useState<SettingKey | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'whatsapp' | 'ai' | 'backup'>('general');
  const { status: waStatus, loading: waLoading, startSession: startWaSession, reset: resetWaSession } = useWhatsappSession();

  const query = useQuery({
    queryKey: ['settings'],
    queryFn: async () => apiGet<SettingsResponse>('/api/settings'),
  });

  useEffect(() => {
    if (!query.data) return;
    setGeneral(query.data.general);
    setWhatsapp(query.data.whatsapp);
    setAi(query.data.ai);
    setBackup(query.data.backup);
    setKeywordsText(query.data.whatsapp.optOutKeywords.join(', '));
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: async ({ key, value }: UpdatePayload) => {
      await apiPut(`/api/settings/${key}`, value);
      return { key, value };
    },
    onSuccess: ({ key, value }) => {
      qc.setQueryData(['settings'], (prev) => (prev ? { ...prev, [key]: value } : prev));
      toast.success('Settings saved');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to save settings');
    },
    onSettled: () => setSavingKey(null),
  });

  const backupListQuery = useQuery({
    queryKey: ['backups'],
    queryFn: async () => apiGet<BackupSummary[]>('/api/backups'),
    enabled: canEdit,
    refetchInterval: 60_000,
  });

  const backupMutation = useMutation({
    mutationFn: async () => apiPost<BackupSummary>('/api/backups'),
    onSuccess: (result) => {
      toast.success(`Backup created (${(result.size / (1024 * 1024)).toFixed(1)} MB)`);
      qc.invalidateQueries({ queryKey: ['backups'] });
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to create backup'),
  });

  const restoreMutation = useMutation({
    mutationFn: async (filename: string) => apiPost(`/api/backups/${encodeURIComponent(filename)}/restore`),
    onSuccess: (result: any) => {
      toast.success('Backup extracted to ' + (result?.extractedTo || 'restore folder'));
    },
    onError: (error: any) => toast.error(error?.message || 'Restore failed'),
  });

  const handleSave = (payload: UpdatePayload) => {
    if (!canEdit) {
      toast.error('You need admin or manager access to edit settings');
      return;
    }
    setSavingKey(payload.key);
    mutation.mutate(payload);
  };

  const whatsappForm = useMemo(() => {
    const keywords = keywordsText
      .split(',')
      .map((keyword) => keyword.trim())
      .filter(Boolean);
    return { ...whatsapp, optOutKeywords: keywords.length ? keywords : defaultWhatsapp.optOutKeywords };
  }, [keywordsText, whatsapp]);

  const whatsappPill = useMemo(() => {
    const state = waStatus?.status || 'disconnected';
    if (state === 'connected') return { label: 'Connected', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' };
    if (state === 'qr_ready') return { label: 'Scan QR', className: 'bg-amber-500/15 text-amber-300 border-amber-500/40' };
    if (state === 'connecting') return { label: 'Connecting', className: 'bg-sky-500/15 text-sky-300 border-sky-500/40' };
    if (state === 'error') return { label: 'Error', className: 'bg-rose-500/15 text-rose-300 border-rose-500/40' };
    return { label: 'Disconnected', className: 'bg-slate-700/30 text-slate-200 border-slate-600/50' };
  }, [waStatus?.status]);

  return (
    <AuthGuard>
      <div className="space-y-8">
        <section className="rounded-xl border bg-card/80 px-6 py-5 shadow-sm backdrop-blur">
          <SectionHeader
            icon={<Settings2 className="h-4 w-4" />}
            overline="Settings"
            title="Application Settings"
            description="Manage business identity, WhatsApp guardrails, AI preferences, and backup routines."
            actions={
              <SegmentedControl
                items={[
                  { id: 'general', label: 'General' },
                  { id: 'whatsapp', label: 'WhatsApp' },
                  { id: 'ai', label: 'AI & Automation' },
                  { id: 'backup', label: 'Backup' },
                ]}
                value={activeTab}
                onValueChange={(id) => setActiveTab(id as typeof activeTab)}
              />
            }
          />
          {!canEdit ? (
            <div className="mt-4 rounded-md border border-amber-400/60 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              You are in read-only mode. Contact an administrator to update settings.
            </div>
          ) : null}
        </section>

        {query.isLoading ? (
          <div className="rounded-xl border bg-card/80 px-4 py-6 text-sm text-muted-foreground backdrop-blur">
            Loading settings...
          </div>
        ) : query.isError ? (
          <div className="rounded-xl border bg-card/80 px-4 py-6 text-sm text-red-500 backdrop-blur">
            Failed to load settings
          </div>
        ) : (
          <div className="space-y-6">
            {activeTab === 'general' ? (
            <section className="rounded-xl border bg-card/80 p-6 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">General</p>
                  <h2 className="text-xl font-semibold">Business profile</h2>
                </div>
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <form
                className="mt-6 grid gap-4 md:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSave({ key: 'general', value: general });
                }}
              >
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="companyName">
                    Company name
                  </label>
                  <input
                    id="companyName"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={general.companyName}
                    onChange={(event) => setGeneral((prev) => ({ ...prev, companyName: event.target.value }))}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="businessEmail">
                    Billing email
                  </label>
                  <input
                    id="businessEmail"
                    type="email"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={general.businessEmail}
                    onChange={(event) => setGeneral((prev) => ({ ...prev, businessEmail: event.target.value }))}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="businessPhone">
                    Hotline / WhatsApp number
                  </label>
                  <input
                    id="businessPhone"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={general.businessPhone}
                    onChange={(event) => setGeneral((prev) => ({ ...prev, businessPhone: event.target.value }))}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="currency">
                    Currency code
                  </label>
                  <input
                    id="currency"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm uppercase"
                    value={general.currency}
                    onChange={(event) => setGeneral((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="taxRate">
                    Tax rate (%)
                  </label>
                  <input
                    id="taxRate"
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={general.taxRate}
                    onChange={(event) => setGeneral((prev) => ({ ...prev, taxRate: Number(event.target.value) }))}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Business hours</label>
                  <div className="flex gap-2">
                    <input
                      type="time"
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={general.businessHours.start}
                      onChange={(event) =>
                        setGeneral((prev) => ({ ...prev, businessHours: { ...prev.businessHours, start: event.target.value } }))
                      }
                      disabled={!canEdit}
                    />
                    <input
                      type="time"
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={general.businessHours.end}
                      onChange={(event) =>
                        setGeneral((prev) => ({ ...prev, businessHours: { ...prev.businessHours, end: event.target.value } }))
                      }
                      disabled={!canEdit}
                    />
                  </div>
                  <input
                    className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={general.businessHours.timezone}
                    onChange={(event) =>
                      setGeneral((prev) => ({ ...prev, businessHours: { ...prev.businessHours, timezone: event.target.value } }))
                    }
                    disabled={!canEdit}
                  />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="text-sm font-medium" htmlFor="terms">
                    Terms & conditions (shown on invoices & WhatsApp quotes)
                  </label>
                  <textarea
                    id="terms"
                    rows={4}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={general.terms}
                    onChange={(event) => setGeneral((prev) => ({ ...prev, terms: event.target.value }))}
                    disabled={!canEdit}
                  />
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <Button type="submit" disabled={!canEdit || savingKey === 'general'}>
                    {savingKey === 'general' ? 'Saving...' : 'Save general settings'}
                  </Button>
                </div>
              </form>
            </section>

            ) : null}

            {activeTab === 'whatsapp' ? (
            <section className="rounded-xl border bg-card/80 p-6 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">WhatsApp</p>
                  <h2 className="text-xl font-semibold">Anti-ban controls</h2>
                </div>
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500/10 text-sky-300">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-100">WhatsApp session</p>
                    <p className="text-xs text-muted-foreground">
                      {waStatus?.status === 'qr_ready'
                        ? 'Scan QR to link your device.'
                        : waStatus?.status === 'connected'
                          ? 'Connected. Messages will sync to the control room.'
                          : 'Start the session to generate a QR code.'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('rounded-full border px-3 py-1 text-xs font-semibold', whatsappPill.className)}>
                    {whatsappPill.label}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => startWaSession(false)} disabled={waLoading}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Start Session
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => resetWaSession()} disabled={waLoading}>
                    Reset Session
                  </Button>
                </div>
              </div>
              {waStatus?.status === 'qr_ready' && waStatus.qrImage ? (
                <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-slate-800 bg-slate-900/50 p-4">
                  <div className="overflow-hidden rounded-lg border border-slate-800 bg-black/20 shadow">
                    <img src={waStatus.qrImage} alt="WhatsApp QR" className="h-48 w-48 object-contain" />
                  </div>
                  <div className="flex-1 space-y-2 text-sm text-muted-foreground">
                    <p className="text-slate-100">Scan this QR with WhatsApp on your phone</p>
                    <ol className="list-decimal space-y-1 pl-5">
                      <li>Open WhatsApp → Linked devices</li>
                      <li>Tap “Link a device” and scan</li>
                      <li>Wait until status turns Connected</li>
                    </ol>
                  </div>
                </div>
              ) : null}
              <form
                className="mt-6 grid gap-4 md:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSave({ key: 'whatsapp', value: whatsappForm });
                }}
              >
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="businessNumber">
                    Business number
                  </label>
                  <input
                    id="businessNumber"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={whatsapp.businessNumber}
                    onChange={(event) => setWhatsapp((prev) => ({ ...prev, businessNumber: event.target.value }))}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="sessionName">
                    Session name
                  </label>
                  <input
                    id="sessionName"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={whatsapp.sessionName}
                    onChange={(event) => setWhatsapp((prev) => ({ ...prev, sessionName: event.target.value }))}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="dailyLimit">
                    Daily limit
                  </label>
                  <input
                    id="dailyLimit"
                    type="number"
                    min={10}
                    max={5000}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={whatsapp.dailyLimit}
                    onChange={(event) => setWhatsapp((prev) => ({ ...prev, dailyLimit: Number(event.target.value) }))}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Random delay (seconds)</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={whatsapp.randomDelayMin}
                      onChange={(event) => setWhatsapp((prev) => ({ ...prev, randomDelayMin: Number(event.target.value) }))}
                      disabled={!canEdit}
                    />
                    <input
                      type="number"
                      min={0}
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={whatsapp.randomDelayMax}
                      onChange={(event) => setWhatsapp((prev) => ({ ...prev, randomDelayMax: Number(event.target.value) }))}
                      disabled={!canEdit}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="optOut">
                    Opt-out keywords (comma separated)
                  </label>
                  <input
                    id="optOut"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={keywordsText}
                    onChange={(event) => setKeywordsText(event.target.value)}
                    disabled={!canEdit}
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    id="respectBusinessHours"
                    type="checkbox"
                    className="h-4 w-4"
                    checked={whatsapp.respectBusinessHours}
                    onChange={(event) => setWhatsapp((prev) => ({ ...prev, respectBusinessHours: event.target.checked }))}
                    disabled={!canEdit}
                  />
                  <label htmlFor="respectBusinessHours" className="text-sm text-muted-foreground">
                    Respect business hours window
                  </label>
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <Button type="submit" disabled={!canEdit || savingKey === 'whatsapp'}>
                    {savingKey === 'whatsapp' ? 'Saving...' : 'Save WhatsApp settings'}
                  </Button>
                </div>
              </form>
            </section>
            ) : null}

            {activeTab === 'ai' ? (
            <section className="rounded-xl border bg-card/80 p-6 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">AI</p>
                    <h2 className="text-xl font-semibold">Assistant preferences</h2>
                  </div>
                </div>
                <Cpu className="h-5 w-5 text-primary" />
              </div>
              <form
                className="mt-6 grid gap-4 md:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSave({ key: 'ai', value: ai });
                }}
              >
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="provider">
                    Provider
                  </label>
                  <input
                    id="provider"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={ai.provider}
                    onChange={(event) => setAi((prev) => ({ ...prev, provider: event.target.value }))}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="model">
                    Model
                  </label>
                  <input
                    id="model"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={ai.model}
                    onChange={(event) => setAi((prev) => ({ ...prev, model: event.target.value }))}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-medium" htmlFor="apiKey">
                    API key
                  </label>
                  <input
                    id="apiKey"
                    type="password"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={ai.apiKey}
                    onChange={(event) => setAi((prev) => ({ ...prev, apiKey: event.target.value }))}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-medium" htmlFor="baseUrl">
                    Base URL (optional)
                  </label>
                  <input
                    id="baseUrl"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={ai.baseUrl}
                    onChange={(event) => setAi((prev) => ({ ...prev, baseUrl: event.target.value }))}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="temperature">
                    Temperature
                  </label>
                  <input
                    id="temperature"
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={ai.temperature}
                    onChange={(event) => setAi((prev) => ({ ...prev, temperature: Number(event.target.value) }))}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="maxTokens">
                    Max tokens
                  </label>
                  <input
                    id="maxTokens"
                    type="number"
                    min={64}
                    max={4000}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={ai.maxTokens}
                    onChange={(event) => setAi((prev) => ({ ...prev, maxTokens: Number(event.target.value) }))}
                    disabled={!canEdit}
                  />
                </div>
                <div className="md:col-span-2 flex justify-between gap-2">
                  <Button type="submit" disabled={!canEdit || savingKey === 'ai'}>
                    {savingKey === 'ai' ? 'Saving...' : 'Save AI settings'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => toast.success('Test command queued - implement transport hook next.')}
                    disabled={!canEdit}
                  >
                    Run test prompt
                  </Button>
                </div>
              </form>
            </section>
            ) : null}

            {activeTab === 'backup' ? (
            <section className="rounded-xl border bg-card/80 p-6 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Backup & safety</p>
                  <h2 className="text-xl font-semibold">Disaster recovery</h2>
                </div>
                <ServerCog className="h-5 w-5 text-primary" />
              </div>
              <form
                className="mt-6 grid gap-4 md:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleSave({ key: 'backup', value: backup });
                }}
              >
                <div className="flex items-center gap-2">
                  <input
                    id="manualEnabled"
                    type="checkbox"
                    className="h-4 w-4"
                    checked={backup.manualEnabled}
                    onChange={(event) => setBackup((prev) => ({ ...prev, manualEnabled: event.target.checked }))}
                    disabled={!canEdit}
                  />
                  <label htmlFor="manualEnabled" className="text-sm text-muted-foreground">
                    Enable manual backup button in dashboard
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="includeUploads"
                    type="checkbox"
                    className="h-4 w-4"
                    checked={backup.includeUploads}
                    onChange={(event) => setBackup((prev) => ({ ...prev, includeUploads: event.target.checked }))}
                    disabled={!canEdit}
                  />
                  <label htmlFor="includeUploads" className="text-sm text-muted-foreground">
                    Include uploads & WhatsApp sessions
                  </label>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="retentionDays">
                    Retention (days)
                  </label>
                  <input
                    id="retentionDays"
                    type="number"
                    min={1}
                    max={365}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={backup.retentionDays}
                    onChange={(event) => setBackup((prev) => ({ ...prev, retentionDays: Number(event.target.value) }))}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="schedule">
                    Daily schedule (24h)
                  </label>
                  <input
                    id="schedule"
                    type="time"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={backup.schedule}
                    onChange={(event) => setBackup((prev) => ({ ...prev, schedule: event.target.value }))}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-medium" htmlFor="notifyEmail">
                    Notify email
                  </label>
                  <input
                    id="notifyEmail"
                    type="email"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={backup.notifyEmail}
                    onChange={(event) => setBackup((prev) => ({ ...prev, notifyEmail: event.target.value }))}
                    disabled={!canEdit}
                  />
                </div>
                <div className="md:col-span-2 flex justify-between gap-2">
                  <Button type="submit" disabled={!canEdit || savingKey === 'backup'}>
                    {savingKey === 'backup' ? 'Saving...' : 'Save backup plan'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!canEdit || backupMutation.isPending}
                    onClick={() => backupMutation.mutate()}
                  >
                    {backupMutation.isPending ? 'Creating backup...' : (
                      <span className="inline-flex items-center gap-2">
                        <HardDrive className="h-4 w-4" />
                        <span>Trigger manual backup</span>
                      </span>
                    )}
                  </Button>
                </div>
                <div className="md:col-span-2 rounded-lg border border-dashed px-4 py-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Checklist before production</span>
                  </div>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>Verify S3 / local backup destination has enough storage.</li>
                    <li>Store encryption password safely (preferably in a vault).</li>
                    <li>Test restore on a staging database monthly.</li>
                  </ul>
                </div>
              </form>
              <div className="mt-6 rounded-xl border border-dashed bg-card/30 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Recent backups</p>
                  <Button variant="ghost" size="sm" onClick={() => backupListQuery.refetch()} disabled={backupListQuery.isFetching}>
                    {backupListQuery.isFetching ? 'Refreshing...' : 'Refresh'}
                  </Button>
                </div>
                {backupListQuery.isLoading ? (
                  <p className="mt-4 text-sm text-muted-foreground">Loading backup history...</p>
                ) : backupListQuery.data && backupListQuery.data.length > 0 ? (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="py-2">File</th>
                          <th className="py-2">Size</th>
                          <th className="py-2">Created</th>
                          <th className="py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {backupListQuery.data.map((backup) => (
                          <tr key={backup.filename} className="border-t">
                            <td className="py-2 font-mono text-xs">{backup.filename}</td>
                            <td className="py-2">{(backup.size / (1024 * 1024)).toFixed(1)} MB</td>
                            <td className="py-2">{new Date(backup.createdAt).toLocaleString()}</td>
                            <td className="py-2 text-right">
                              <div className="flex justify-end gap-2">
                                <a
                                  href={`/api/backups/${encodeURIComponent(backup.filename)}/download`}
                                  className="text-xs text-primary underline"
                                >
                                  Download
                                </a>
                                <button
                                  className="text-xs text-muted-foreground underline disabled:opacity-50"
                                  disabled={restoreMutation.isPending}
                                  onClick={() => restoreMutation.mutate(backup.filename)}
                                >
                                  {restoreMutation.isPending ? 'Restoring...' : 'Extract'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 py-6 text-center text-muted-foreground">
                      <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-slate-800 bg-slate-950/60">
                        <Inbox className="h-6 w-6 text-slate-500" />
                      </div>
                      <p className="text-sm font-medium text-slate-100">No backups generated yet.</p>
                      <p className="text-xs text-slate-400">Run a manual backup to start your recovery history.</p>
                    </div>
                  )}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}



