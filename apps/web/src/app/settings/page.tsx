"use client";

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  HardDrive,
  Inbox,
  Loader2,
  MessageCircle,
  QrCode,
  ServerCog,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

import AuthGuard from '@/components/auth-guard';
import { Button } from '@/components/ui/button';
import { apiGet, apiPost, apiPut } from '@/lib/api';
import { useToast } from '@/components/toast-provider';
import { useAuth } from '@/lib/auth';
import { hasAnyRole } from '@/lib/roles';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SectionHeader } from '@/components/section-header';
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
  const { user, status: authStatus, loading: authLoading } = useAuth();
  const router = useRouter();
  const canEdit = hasAnyRole(user?.role, ['ADMIN', 'MANAGER']);
  const qc = useQueryClient();

  const [general, setGeneral] = useState(defaultGeneral);
  const [whatsapp, setWhatsapp] = useState(defaultWhatsapp);
  const [ai, setAi] = useState(defaultAi);
  const [backup, setBackup] = useState(defaultBackup);
  const [keywordsText, setKeywordsText] = useState('STOP, UNSUBSCRIBE');
  const [savingKey, setSavingKey] = useState<SettingKey | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'whatsapp' | 'ai' | 'backup'>('general');
  const [debugOpen, setDebugOpen] = useState(false);
  const {
    status: waStatus,
    loading: waLoading,
    startSession: startWaSession,
    reset: resetWaSession,
    debugStatusJson: waDebugJson,
  } = useWhatsappSession();

  const query = useQuery({
    queryKey: ['settings'],
    queryFn: async () => apiGet<SettingsResponse>('/api/settings'),
    enabled: authStatus === 'authenticated',
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
    enabled: canEdit && authStatus === 'authenticated',
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
    if (state === 'connected') return { label: 'Connected', className: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/50' };
    if (state === 'qr_ready' || (state === 'connecting' && waStatus?.hasQR))
      return { label: 'Scan QR', className: 'bg-amber-500/15 text-amber-200 border-amber-500/50' };
    if (state === 'connecting') return { label: 'Connecting...', className: 'bg-sky-500/15 text-sky-100 border-sky-500/50' };
    if (state === 'error') return { label: 'Error', className: 'bg-rose-500/15 text-rose-200 border-rose-500/60' };
    return { label: 'Disconnected', className: 'bg-slate-800/60 text-slate-200 border-slate-600/60' };
  }, [waStatus?.status]);

  const waState = waStatus?.status ?? 'disconnected';
  const waStatusCopy = useMemo(() => {
    if (waState === 'qr_ready' || (waState === 'connecting' && waStatus?.hasQR)) return 'Scan the QR to link your device.';
    if (waState === 'connected') return 'Connected. Messages will sync to the control room.';
    if (waState === 'connecting') return 'Connecting to WhatsApp... please wait.';
    if (waState === 'error') return 'Something went wrong. Start a new session or reset.';
    return 'Start the session to generate a QR code.';
  }, [waState, waStatus?.hasQR]);
  const activeStep = useMemo(() => {
    if (waState === 'connected') return 3;
    if (waState === 'qr_ready' || (waState === 'connecting' && waStatus?.hasQR)) return 2;
    return 1;
  }, [waState]);
  const friendlyLastError = useMemo(() => {
    const raw = waStatus?.lastError || '';
    if (raw.includes('Backend API server is not running')) {
      return 'The backend API is offline. Please start the API server on port 4000 and try again.';
    }
    return raw || null;
  }, [waStatus?.lastError]);
  const stepItems = useMemo(
    () => [
      { id: 'start', label: 'Start Session' },
      { id: 'scan', label: 'Scan QR' },
      { id: 'connected', label: 'Connected' },
    ],
    [],
  );

  if (authStatus === 'authenticating' || authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center rounded-xl border border-slate-800 bg-slate-950/60 p-6 text-sm text-slate-200">
        Checking your session...
      </div>
    );
  }

  if (authStatus === 'unauthenticated') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <div className="w-full max-w-lg space-y-4 rounded-xl border border-slate-800 bg-slate-950/70 p-6 text-center shadow-lg shadow-black/30">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Access required</p>
          <h2 className="text-xl font-semibold text-slate-100">You’re not signed in</h2>
          <p className="text-sm text-slate-400">Sign in to manage your WhatsApp and application settings.</p>
          <div className="flex items-center justify-center">
            <Button onClick={() => router.push('/login')} className="mt-2">
              Go to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (authStatus === 'error') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <div className="w-full max-w-lg space-y-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-6 text-center shadow-lg shadow-rose-900/30">
          <h2 className="text-xl font-semibold text-rose-100">Session error</h2>
          <p className="text-sm text-rose-50/80">Please login again to continue.</p>
          <div className="flex items-center justify-center">
            <Button variant="outline" onClick={() => router.push('/login')}>
              Go to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthGuard redirectOnFail={false}>
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

                <div className="mt-4 space-y-4 rounded-xl border border-slate-800/80 bg-slate-950/60 p-5 shadow-inner shadow-slate-900/40">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-500/10 text-sky-200">
                        <MessageCircle className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-100">WhatsApp session</p>
                        <p className="text-xs text-muted-foreground">{waStatusCopy}</p>
                      </div>
                    </div>
                    <span className={cn('rounded-full border px-3 py-1 text-xs font-semibold', whatsappPill.className)}>
                      {whatsappPill.label}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    {stepItems.map((step, index) => {
                      const stepNumber = index + 1;
                      const isActive = activeStep === stepNumber;
                      const isCompleted = activeStep > stepNumber && waState !== 'error';
                      const isErrorStep = waState === 'error' && stepNumber === 1;
                      return (
                        <div key={step.id} className="flex items-center gap-3">
                          <div
                            className={cn(
                              'flex min-w-[0] items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition',
                              isErrorStep && 'border-rose-500/60 bg-rose-500/10 text-rose-100',
                              !isErrorStep && isActive && waState === 'connecting' && 'border-sky-500/50 bg-sky-500/10 text-sky-50 animate-pulse',
                              !isErrorStep && isActive && waState !== 'connecting' && 'border-emerald-400/60 bg-emerald-500/10 text-emerald-50 shadow-inner shadow-emerald-900/30',
                              !isErrorStep && !isActive && isCompleted && 'border-emerald-500/40 bg-emerald-500/5 text-emerald-100',
                              !isErrorStep && !isActive && !isCompleted && 'border-slate-800 bg-slate-900/60 text-slate-300',
                            )}
                          >
                            <span
                              className={cn(
                                'block h-2 w-2 rounded-full',
                                isErrorStep
                                  ? 'bg-rose-400'
                                  : isActive || isCompleted
                                    ? 'bg-emerald-400'
                                    : 'bg-slate-500',
                              )}
                            />
                            {isErrorStep ? <AlertCircle className="h-3.5 w-3.5 text-rose-200" /> : null}
                            <span className="truncate">{step.label}</span>
                          </div>
                          {index < stepItems.length - 1 ? (
                            <div
                              className={cn(
                                'h-px w-12 md:w-16',
                                isCompleted ? 'bg-emerald-500/60' : 'bg-slate-800',
                              )}
                            />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-3">
                      {waState === 'qr_ready' ? (
                        <div className="rounded-xl border bg-slate-900/70 px-4 py-4 text-center shadow-lg shadow-emerald-900/30">
                          {waStatus?.qrImage ? (
                            <>
                              <div className="mx-auto max-w-[14rem] overflow-hidden rounded-lg border border-slate-800/80 bg-black/30 p-3">
                                <img src={waStatus.qrImage} alt="WhatsApp QR" className="h-48 w-48 object-contain" />
                              </div>
                              <div className="mt-3 space-y-1">
                                <p className="text-sm font-semibold text-slate-100">Scan this QR with WhatsApp on your phone</p>
                                <p className="text-xs text-slate-400">On your phone, open WhatsApp &gt; Linked Devices &gt; Link a device.</p>
                              </div>
                            </>
                          ) : (
                            <div className="flex flex-col items-center gap-3">
                              <div className="h-48 w-48 rounded-lg border border-slate-800/70 bg-slate-900/80 shadow-inner shadow-slate-900/30 animate-pulse" />
                              <p className="text-xs text-slate-400">Generating QR code...</p>
                            </div>
                          )}
                        </div>
                      ) : waState === 'connecting' ? (
                        <div className="flex items-start gap-3 rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-3 shadow-inner shadow-sky-900/30">
                          <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-sky-100" />
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-sky-100">Connecting to WhatsApp... please wait</p>
                            <p className="text-xs text-slate-200">If this takes too long, start a new session (force) or check connectivity.</p>
                          </div>
                        </div>
                      ) : waState === 'connected' ? (
                        <div className="flex items-start gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 shadow-inner shadow-emerald-900/30">
                          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-200" />
                          <div>
                            <p className="text-sm font-semibold text-emerald-100">Connected to WhatsApp.</p>
                            <p className="text-xs text-emerald-50/80">Messages will sync into the Control Room.</p>
                          </div>
                        </div>
                      ) : waState === 'error' ? (
                        <div className="space-y-2 rounded-lg border border-rose-500/50 bg-rose-500/10 px-4 py-3 shadow-inner shadow-rose-900/30">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="mt-0.5 h-5 w-5 text-rose-200" />
                            <div>
                              <p className="text-sm font-semibold text-rose-100">Failed to connect to WhatsApp.</p>
                              <p className="text-xs text-rose-50/80">Try starting a new session or reset the connection.</p>
                            </div>
                          </div>
                          {friendlyLastError ? (
                            <pre className="text-xs bg-slate-900/70 border border-rose-500/50 rounded-md p-2 overflow-x-auto">
                              {friendlyLastError}
                            </pre>
                          ) : null}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3 text-xs text-slate-300 shadow-inner shadow-slate-900/30">
                          Start a session to generate a QR code and link WhatsApp to the control room.
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-3 rounded-lg border border-slate-800/70 bg-slate-900/60 p-4">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-100">Control the session</p>
                        <p className="text-xs text-slate-400">Kick off a connection, force a new login, or reset if something looks off.</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" onClick={() => startWaSession(false)} disabled={waLoading}>
                          {waLoading ? 'Working...' : 'Start Session'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => startWaSession(true)} disabled={waLoading}>
                          {waLoading ? 'Starting...' : 'Start New Session (force)'}
                        </Button>
                      </div>
                      <button
                        type="button"
                        className="self-start text-xs text-slate-400 underline decoration-dotted underline-offset-4 hover:text-slate-200 disabled:opacity-60"
                        onClick={() => resetWaSession()}
                        disabled={waLoading}
                      >
                        Reset session
                      </button>
                      <div className="rounded-lg border border-dashed border-slate-800/80 bg-slate-950/40 p-3 text-xs text-slate-400">
                        <div className="flex items-start gap-2">
                          <QrCode className="mt-0.5 h-4 w-4 text-slate-500" />
                          <div className="space-y-1">
                            <p>Tips</p>
                            <ul className="list-disc space-y-1 pl-5">
                              <li>Keep this tab open while scanning the QR.</li>
                              <li>Use the force option if the QR refuses to update.</li>
                              <li>Stable internet helps the handshake complete faster.</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-800/70 pt-3">
                    <button
                      type="button"
                      className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200"
                      onClick={() => setDebugOpen((prev) => !prev)}
                    >
                      <span>Developer debug (WhatsApp status)</span>
                      {debugOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {debugOpen ? (
                      <pre className="mt-2 max-h-40 overflow-x-auto rounded-md border border-slate-700 bg-slate-950/80 p-2 text-[10px] text-slate-200">
                        {waDebugJson || 'No status received yet.'}
                      </pre>
                    ) : null}
                  </div>
                </div>

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



