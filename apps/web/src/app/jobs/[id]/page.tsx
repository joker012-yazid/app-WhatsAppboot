"use client";

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import AuthGuard from '@/components/auth-guard';
import { apiGet, apiPut, apiPost, apiUpload, apiDelete } from '@/lib/api';
import { useToast } from '@/components/toast-provider';
import { useConfirm } from '@/components/confirm-provider';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { hasAnyRole } from '@/lib/roles';

type JobDetail = {
  job: {
    id: string;
    title: string;
    description?: string | null;
    status: 'AWAITING_QUOTE' | 'QUOTATION_SENT' | 'APPROVED' | 'CANCELLED' | 'REPAIRING' | 'COMPLETED';
    priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
    quotedAmount?: number | null;
    approvedAmount?: number | null;
    diagnosis?: string | null;
    dueDate?: string | null;
    createdAt: string;
    customer: { id: string; name: string };
    device: { id: string; deviceType: string; brand?: string | null; model?: string | null };
  };
  qr_url: string;
};

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ['job', id],
    queryFn: async () => apiGet<JobDetail>(`/api/jobs/${id}`),
  });

  const job = q.data?.job;
  const qrUrl = q.data?.qr_url || '';

  const [status, setStatus] = useState<JobDetail['job']['status']>('AWAITING_QUOTE');
  const [priority, setPriority] = useState<JobDetail['job']['priority']>('NORMAL');
  const [dueDate, setDueDate] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [error, setError] = useState<string | null>(null);

  const statusOptions: JobDetail['job']['status'][] = [
    'AWAITING_QUOTE',
    'QUOTATION_SENT',
    'APPROVED',
    'CANCELLED',
    'REPAIRING',
    'COMPLETED',
  ];

  const priorityOptions: JobDetail['job']['priority'][] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

  const resetFormFromJob = () => {
    if (!job) return;
    setStatus(job.status);
    setPriority(job.priority);
    setDueDate(job.dueDate ? job.dueDate.substring(0, 16) : ''); // yyyy-MM-ddTHH:mm
    setDiagnosis(job.diagnosis || '');
  };

  useMemo(() => {
    resetFormFromJob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id]);

  const [isSubmittingForm, setIsSubmittingForm] = useState(false);

  const updateMutation = useMutation({
    mutationFn: async () =>
      apiPut(`/api/jobs/${id}`, {
        status,
        priority,
        dueDate: dueDate ? new Date(dueDate).toISOString() : null,
        diagnosis,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['job', id] });
      await qc.invalidateQueries({ queryKey: ['jobs'] });
      if (!isSubmittingForm) {
        toast.success('Job updated');
      }
    },
    onError: (e: any) => setError(e?.message || 'Failed to update job'),
  });

  const { data: history, refetch: refetchHistory } = useQuery({
    queryKey: ['job-history', id],
    queryFn: async () => apiGet<{ id: string; status: string; notes?: string | null; createdAt: string }[]>(`/api/jobs/${id}/history`),
  });

  const [editingHistoryId, setEditingHistoryId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editingPhotoLabels, setEditingPhotoLabels] = useState<Record<string, string>>({});
  const [newPhotosForHistory, setNewPhotosForHistory] = useState<Record<string, File[]>>({});
  const [newPhotoLabels, setNewPhotoLabels] = useState<Record<string, string>>({});

  // Helper function to get photos related to a history entry (within 5 minutes)
  const getRelatedPhotos = (historyEntry: { createdAt: string }) => {
    if (!photos) return [];
    const historyDate = new Date(historyEntry.createdAt);
    const TIME_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
    
    return photos.filter(photo => {
      const photoDate = new Date(photo.createdAt);
      const timeDiff = Math.abs(photoDate.getTime() - historyDate.getTime());
      return timeDiff <= TIME_WINDOW_MS;
    });
  };

  const deleteHistoryMutation = useMutation({
    mutationFn: async (historyId: string) => apiDelete(`/api/jobs/${id}/history/${historyId}`),
    onSuccess: async () => {
      await refetchHistory();
      toast.success('History entry deleted');
    },
    onError: (e: any) => {
      console.error('Delete history error:', {
        status: e?.status,
        message: e?.message,
        historyId,
        jobId: id
      });

      // Handle different error types appropriately
      if (e?.status === 404 || e?.message?.includes('not found')) {
        // History entry doesn't exist - refresh and show info message
        refetchHistory();
        toast.info('History entry may have already been deleted');
      } else if (e?.status === 502 || e?.message?.includes('Bad Gateway')) {
        // Gateway error - show retry option
        toast.error('Network issue - Please try again', {
          action: {
            label: 'Retry',
            onClick: () => deleteHistoryMutation.mutate(historyId)
          }
        });
      } else if (e?.status === 401 || e?.message?.includes('Unauthorized')) {
        // Authentication issue
        toast.error('Session expired - Please refresh and login again');
      } else {
        // Generic error
        toast.error(e?.message || 'Failed to delete history entry');
      }
    },
  });

  const updateHistoryMutation = useMutation({
    mutationFn: async ({ historyId, notes }: { historyId: string; notes: string }) =>
      apiPut(`/api/jobs/${id}/history/${historyId}`, { notes }),
    onSuccess: async () => {
      await refetchHistory();
      setEditingHistoryId(null);
      setEditNotes('');
      setEditingPhotoLabels({});
      setNewPhotosForHistory({});
      setNewPhotoLabels({});
      toast.success('History entry updated');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to update history entry'),
  });

  const updatePhotoLabelMutation = useMutation({
    mutationFn: async ({ photoId, label }: { photoId: string; label: string }) =>
      apiPut(`/api/jobs/${id}/photos/${photoId}`, { label }),
    onSuccess: async () => {
      await refetchPhotos();
      toast.success('Photo label updated');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to update photo label'),
  });

  const uploadPhotosForHistoryMutation = useMutation({
    mutationFn: async ({ historyId, files, label }: { historyId: string; files: File[]; label?: string }) => {
      const form = new FormData();
      files.forEach((f) => form.append('photos', f));
      if (label) form.append('label', label);
      return apiUpload<any[]>(`/api/jobs/${id}/photos`, form);
    },
    onSuccess: async () => {
      await refetchPhotos();
      toast.success('Photos uploaded');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to upload photos'),
  });

  const renewQr = useMutation({
    mutationFn: async () => apiPost<{ qr_url: string }>(`/api/jobs/${id}/qr/renew`, {}),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['job', id] });
      toast.success('QR reissued');
    },
  });

  // Photos
  const { data: photos, refetch: refetchPhotos } = useQuery({
    queryKey: ['job-photos', id],
    queryFn: async () => apiGet<{ id: string; label?: string | null; filePath: string; url: string; createdAt: string }[]>(`/api/jobs/${id}/photos`),
  });

  const [label, setLabel] = useState('');
  const [files, setFiles] = useState<File[] | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!files || files.length === 0) throw new Error('Select file(s)');
      const form = new FormData();
      files.forEach((f) => form.append('photos', f));
      if (label) form.append('label', label);
      return apiUpload<any[]>(`/api/jobs/${id}/photos`, form);
    },
    onSuccess: async (res: any[]) => {
      setLabel('');
      setFiles(null);
      (document.getElementById('photo-input') as HTMLInputElement | null)?.value && ((document.getElementById('photo-input') as HTMLInputElement).value = '');
      await refetchPhotos();
      if (!isSubmittingForm) {
        toast.success(`Uploaded ${res?.length ?? files?.length ?? 0} photo(s)`);
      }
    },
    onError: (e: any) => {
      const msg = e?.message || 'Failed to upload';
      setPhotoError(msg);
      toast.error(msg);
    },
  });

  const deletePhoto = useMutation({
    mutationFn: async (photoId: string) => apiDelete(`/api/jobs/${id}/photos/${photoId}`),
    onSuccess: async () => {
      await refetchPhotos();
      toast.success('Photo deleted');
    },
  });

  const deleteJob = useMutation({
    mutationFn: async () => apiDelete(`/api/jobs/${id}`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job deleted');
      router.replace('/jobs');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to delete job'),
  });

  return (
    <AuthGuard>
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Job Detail</p>
            <h1 className="text-2xl font-semibold">{job?.title || 'Loading…'}</h1>
            {job ? (
              <p className="text-sm text-muted-foreground">
                {job.customer.name} • {[job.device.deviceType, job.device.brand, job.device.model]
                  .filter(Boolean)
                  .join(' ')}
              </p>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href="/jobs">Back</Link>
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                const ok = await confirm({
                  title: 'Delete job',
                  description: 'Are you sure you want to delete this job? This action cannot be undone.',
                  confirmText: 'Delete',
                  variant: 'destructive',
                });
                if (ok) deleteJob.mutate();
              }}
              disabled={deleteJob.isPending}
            >
              Delete
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-4">
            <div className="rounded-xl border bg-card p-4">
              <h2 className="mb-3 text-lg font-semibold">QR Progress</h2>
              {qrUrl ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground break-all">
                    <span className="font-medium">URL:</span> {qrUrl}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={async () => {
                        try {
                          if (navigator.clipboard && navigator.clipboard.writeText) {
                            await navigator.clipboard.writeText(qrUrl);
                            toast.success('Link copied to clipboard!');
                          } else {
                            // Fallback for older browsers
                            const textArea = document.createElement('textarea');
                            textArea.value = qrUrl;
                            textArea.style.position = 'fixed';
                            textArea.style.opacity = '0';
                            document.body.appendChild(textArea);
                            textArea.select();
                            document.execCommand('copy');
                            document.body.removeChild(textArea);
                            toast.success('Link copied to clipboard!');
                          }
                        } catch (err) {
                          toast.error('Failed to copy link');
                          console.error('Failed to copy:', err);
                        }
                      }}
                    >
                      Copy link
                    </Button>
                    <Button asChild variant="outline">
                      <a href={qrUrl} target="_blank" rel="noreferrer">
                        Open link
                      </a>
                    </Button>
                    {hasAnyRole(user?.role, ['ADMIN','USER']) ? (
                      <Button variant="secondary" type="button" onClick={() => renewQr.mutate()} disabled={renewQr.isPending}>
                        {renewQr.isPending ? 'Reissuing…' : 'Reissue QR'}
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Share this link with the customer to check their job progress and photos.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Loading QR link…</p>
              )}
            </div>

            <div className="rounded-xl border bg-card p-4">
              <h2 className="mb-4 text-lg font-semibold">Status Kerja & Photos</h2>
              
              {/* Main Status Selection */}
              <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                {[
                  { value: 'AWAITING_QUOTE', label: 'Menunggu Quote', icon: '📝', color: 'amber' },
                  { value: 'QUOTATION_SENT', label: 'Quote Dihantar', icon: '📤', color: 'blue' },
                  { value: 'APPROVED', label: 'Disetujui', icon: '✅', color: 'green' },
                  { value: 'REPAIRING', label: 'Sedang Dibaiki', icon: '🔧', color: 'cyan' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => hasAnyRole(user?.role, ['ADMIN','USER']) && setStatus(opt.value as any)}
                    disabled={!hasAnyRole(user?.role, ['ADMIN','USER'])}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-all ${
                      status === opt.value
                        ? opt.color === 'amber' ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                        : opt.color === 'cyan' ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300'
                        : opt.color === 'green' ? 'border-green-500 bg-green-500/20 text-green-300'
                        : 'border-red-500 bg-red-500/20 text-red-300'
                        : 'border-slate-700 bg-slate-900/50 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <span className="text-xl">{opt.icon}</span>
                    <span className="text-xs font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>

              <form
                className="space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setError(null);
                  setPhotoError(null);
                  setIsSubmittingForm(true);
                  
                  try {
                    // First update status (this will create history entry)
                    await updateMutation.mutateAsync();
                    
                    // Then upload photos if any
                    if (files && files.length > 0) {
                      await uploadMutation.mutateAsync();
                    }
                    
                    // Show success message
                    if (files && files.length > 0) {
                      toast.success(`Status updated dan ${files.length} photo(s) uploaded!`);
                    } else {
                      toast.success('Status updated!');
                    }
                  } catch (error: any) {
                    // Error already handled by mutations
                    console.error('Form submission error:', error);
                  } finally {
                    setIsSubmittingForm(false);
                  }
                }}
              >
                {/* Photos Upload Section - Optional */}
                <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-200">📷 Upload Photos</h3>
                    <span className="text-xs text-slate-400 italic">(Pilihan - Skip jika tiada photos)</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <input
                      id="photo-input"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        const MAX_FILES = 6;
                        const MAX_SIZE = 5 * 1024 * 1024;
                        const list = Array.from(e.target.files || []);
                        if (list.length > MAX_FILES) {
                          setFiles(null);
                          setPhotoError(`Select up to ${MAX_FILES} files`);
                          (e.target as HTMLInputElement).value = '';
                          return;
                        }
                        const invalid = list.find((f) => !f.type.startsWith('image/') || f.size > MAX_SIZE);
                        if (invalid) {
                          setFiles(null);
                          setPhotoError('Only images up to 5 MB each are allowed');
                          (e.target as HTMLInputElement).value = '';
                          return;
                        }
                        setPhotoError(null);
                        setFiles(list);
                      }}
                      className="md:col-span-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground file:mr-4 file:rounded-md file:border-0 file:bg-cyan-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-cyan-700"
                      disabled={!hasAnyRole(user?.role, ['ADMIN','USER'])}
                    />
                    <input
                      type="text"
                      placeholder="Label (optional)"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                      disabled={!hasAnyRole(user?.role, ['ADMIN','USER'])}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">PNG/JPG/WebP up to 5 MB each. Max 6 files. <span className="text-slate-500">Boleh skip jika tiada photos untuk upload.</span></p>
                  {photoError ? <p className="mt-2 text-sm text-red-500">{photoError}</p> : null}
                  {files && files.length > 0 && (
                    <div className="mt-3 rounded-md bg-cyan-500/10 border border-cyan-500/30 p-2 text-xs text-cyan-300">
                      📎 {files.length} file{files.length > 1 ? 's' : ''} selected - akan diupload bersama status update
                    </div>
                  )}
                </div>
                {/* Work Phase - Only show when REPAIRING */}
                {(status === 'REPAIRING' || status === 'QUOTATION_SENT' || status === 'APPROVED') && (
                  <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-4">
                    <h3 className="mb-3 text-sm font-semibold text-cyan-300">🔧 Fasa Kerja Semasa</h3>
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                      {[
                        { id: 'troubleshoot', label: 'Troubleshoot', icon: '🔍' },
                        { id: 'repair', label: 'Repair', icon: '🛠️' },
                        { id: 'order', label: 'Order Parts', icon: '📦' },
                        { id: 'install', label: 'Pemasangan', icon: '⚙️' },
                        { id: 'testing', label: 'Testing/QA', icon: '✔️' },
                      ].map((phase) => {
                        // Parse current phase from diagnosis field (format: [PHASE:xxx])
                        const currentPhase = diagnosis.match(/\[PHASE:(\w+)\]/)?.[1] || 'troubleshoot';
                        const isActive = currentPhase === phase.id;
                        const phaseOrder = ['troubleshoot', 'repair', 'order', 'install', 'testing'];
                        const isPast = phaseOrder.indexOf(currentPhase) > phaseOrder.indexOf(phase.id);
                        
                        return (
                          <button
                            key={phase.id}
                            type="button"
                            onClick={() => {
                              if (!hasAnyRole(user?.role, ['ADMIN','USER'])) return;
                              // Update diagnosis with phase marker
                              const cleanDiagnosis = diagnosis.replace(/\[PHASE:\w+\]\s*/g, '');
                              setDiagnosis(`[PHASE:${phase.id}] ${cleanDiagnosis}`);
                            }}
                            disabled={!hasAnyRole(user?.role, ['ADMIN','USER'])}
                            className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-center transition-all ${
                              isActive
                                ? 'border-cyan-400 bg-cyan-500/30 text-cyan-200 ring-2 ring-cyan-500/50'
                                : isPast
                                ? 'border-green-500/50 bg-green-500/20 text-green-400'
                                : 'border-slate-700 bg-slate-800/50 text-slate-500 hover:border-slate-600'
                            }`}
                          >
                            <span className="text-lg">{phase.icon}</span>
                            <span className="text-[10px] font-medium">{phase.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Cannot Repair Section - Only show when CANCELLED */}
                {status === 'CANCELLED' && (
                  <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-4">
                    <h3 className="mb-2 text-sm font-semibold text-red-300">❌ Sebab Tidak Dapat Dibaiki</h3>
                    <p className="mb-2 text-xs text-red-400">Sila nyatakan sebab kenapa barang ini tidak dapat dibaiki:</p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {[
                        'Kerosakan teruk',
                        'Part tidak ada',
                        'Kos repair > nilai barang',
                        'Customer tolak quote',
                        'Masalah lain',
                      ].map((reason) => (
                        <button
                          key={reason}
                          type="button"
                          onClick={() => {
                            if (!hasAnyRole(user?.role, ['ADMIN','USER'])) return;
                            const cleanDiagnosis = diagnosis.replace(/\[REJECT:.*?\]\s*/g, '');
                            setDiagnosis(`[REJECT:${reason}] ${cleanDiagnosis}`);
                          }}
                          className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                            diagnosis.includes(`[REJECT:${reason}]`)
                              ? 'bg-red-500/30 text-red-200 ring-1 ring-red-500'
                              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                          }`}
                        >
                          {reason}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-sm font-medium" htmlFor="priority">
                      Prioriti
                    </label>
                    <select
                      id="priority"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as any)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                      disabled={!hasAnyRole(user?.role, ['ADMIN','USER'])}
                    >
                      {priorityOptions.map((p) => {
                        const priorityLabels: Record<string, string> = {
                          LOW: 'Rendah',
                          NORMAL: 'Biasa',
                          HIGH: 'Tinggi',
                          URGENT: 'Segera',
                        };
                        return (
                          <option key={p} value={p} className="bg-background text-foreground">
                            {priorityLabels[p] || p}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium" htmlFor="due">
                      ETA Siap
                    </label>
                    <input
                      id="due"
                      type="datetime-local"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                      disabled={!hasAnyRole(user?.role, ['ADMIN','USER'])}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="diagnosis">
                    📝 Catatan Technician
                  </label>
                  <textarea
                    id="diagnosis"
                    value={diagnosis.replace(/\[PHASE:\w+\]\s*/g, '').replace(/\[REJECT:.*?\]\s*/g, '')}
                    onChange={(e) => {
                      // Preserve phase/reject markers
                      const phaseMatch = diagnosis.match(/\[PHASE:\w+\]/);
                      const rejectMatch = diagnosis.match(/\[REJECT:.*?\]/);
                      const prefix = phaseMatch ? `${phaseMatch[0]} ` : rejectMatch ? `${rejectMatch[0]} ` : '';
                      setDiagnosis(`${prefix}${e.target.value}`);
                    }}
                    placeholder="Masukkan catatan kerja, masalah yang ditemui, parts yang diganti, dll..."
                    className="h-28 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                    disabled={!hasAnyRole(user?.role, ['ADMIN','USER'])}
                  />
                  <p className="text-xs text-muted-foreground">
                    Catatan ini akan dipaparkan kepada customer dalam timeline progress.
                  </p>
                </div>

                {error ? (
                  <p className="text-sm text-red-500">{error}</p>
                ) : null}
                
                {hasAnyRole(user?.role, ['ADMIN','USER']) ? (
                  <div className="flex gap-2">
                    <Button 
                      type="submit" 
                      disabled={updateMutation.isPending || uploadMutation.isPending} 
                      className="flex-1"
                    >
                      {updateMutation.isPending || uploadMutation.isPending 
                        ? 'Menyimpan…' 
                        : files && files.length > 0
                        ? '💾 Simpan Status & Upload Photos'
                        : '💾 Simpan & Update Timeline'}
                    </Button>
                  </div>
                ) : null}
              </form>

              {/* Existing Photos Display */}
              <div className="mt-6 border-t border-slate-800 pt-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-200">📸 Photos Terkumpul</h3>
                {!photos ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : photos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada photos.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {photos.map((p) => (
                      <figure key={p.id} className="space-y-1">
                        <img src={p.url} alt={p.label || 'Job photo'} className="h-32 w-full rounded-md object-cover border border-slate-700" />
                        <figcaption className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="truncate">{p.label || '—'}</span>
                          {hasAnyRole(user?.role, ['ADMIN','USER']) ? (
                            <button
                              className="rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-red-400 hover:bg-red-500/20 transition-colors"
                              onClick={async () => {
                                const ok = await confirm({
                                  title: 'Delete photo',
                                  description: 'Are you sure you want to delete this photo?',
                                  confirmText: 'Delete',
                                  variant: 'destructive',
                                });
                                if (ok) deletePhoto.mutate(p.id);
                              }}
                              disabled={deletePhoto.isPending}
                            >
                              🗑️
                            </button>
                          ) : null}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl border bg-card p-4">
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Maklumat Job</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between">
                  <span className="text-muted-foreground">Job ID:</span>
                  <span className="font-mono text-xs">{job?.id?.slice(0, 8) || '-'}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted-foreground">Tarikh Masuk:</span>
                  <span>{job ? new Date(job.createdAt).toLocaleDateString('ms-MY') : '-'}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className={`font-medium ${
                    job?.status === 'COMPLETED' ? 'text-green-400' :
                    job?.status === 'REPAIRING' ? 'text-cyan-400' :
                    job?.status === 'CANCELLED' ? 'text-red-400' :
                    job?.status === 'APPROVED' ? 'text-emerald-400' :
                    'text-amber-400'
                  }`}>
                    {(() => {
                      const labels: Record<string, string> = {
                        AWAITING_QUOTE: 'Checked-In',
                        QUOTATION_SENT: 'Diagnosing',
                        APPROVED: 'Approved',
                        CANCELLED: 'Declined',
                        REPAIRING: 'In Repair',
                        COMPLETED: 'Closed',
                      };
                      return labels[job?.status || ''] || job?.status || '-';
                    })()}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted-foreground">Prioriti:</span>
                  <span className={`font-medium ${
                    job?.priority === 'URGENT' ? 'text-red-400' :
                    job?.priority === 'HIGH' ? 'text-orange-400' :
                    job?.priority === 'NORMAL' ? 'text-slate-300' :
                    'text-slate-500'
                  }`}>
                    {(() => {
                      const labels: Record<string, string> = {
                        LOW: 'Rendah',
                        NORMAL: 'Biasa',
                        HIGH: 'Tinggi',
                        URGENT: 'Segera',
                      };
                      return labels[job?.priority || ''] || job?.priority || '-';
                    })()}
                  </span>
                </li>
                {job?.quotedAmount && (
                  <li className="flex justify-between">
                    <span className="text-muted-foreground">Quote:</span>
                    <span className="font-medium text-emerald-400">RM {Number(job.quotedAmount).toFixed(2)}</span>
                  </li>
                )}
              </ul>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Timeline Status</h3>
              {!history ? (
                <p className="text-sm text-muted-foreground">Memuatkan…</p>
              ) : history.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada perubahan.</p>
              ) : (
                <ul className="space-y-3 text-sm max-h-96 overflow-y-auto">
                  {history.map((h) => {
                    const statusLabels: Record<string, string> = {
                      PENDING: 'Checked-In',
                      QUOTED: 'Diagnosing',
                      APPROVED: 'Approved',
                      REJECTED: 'Declined',
                      IN_PROGRESS: 'In Repair',
                      COMPLETED: 'Closed',
                    };
                    const isEditing = editingHistoryId === h.id;
                    const parsedNotes = h.notes || '';
                    const cleanNotes = parsedNotes.replace(/\[PHASE:\w+\]\s*/g, '').replace(/\[REJECT:.*?\]\s*/g, '').trim();
                    const relatedPhotos = getRelatedPhotos(h);
                    const newPhotos = newPhotosForHistory[h.id] || [];
                    
                    return (
                      <li key={h.id} className="border-b border-slate-800 pb-3 last:border-b-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="font-medium text-cyan-300">{statusLabels[h.status] || h.status}</span>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {new Date(h.createdAt).toLocaleString('ms-MY', { 
                                  day: 'numeric', 
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                            
                            {isEditing ? (
                              <div className="mt-2 space-y-3">
                                <div>
                                  <label className="text-xs font-medium mb-1 block">Catatan:</label>
                                  <textarea
                                    value={editNotes}
                                    onChange={(e) => setEditNotes(e.target.value)}
                                    placeholder="Masukkan catatan..."
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground min-h-[60px]"
                                    autoFocus
                                  />
                                </div>
                                
                                {/* Edit Existing Photos */}
                                {relatedPhotos.length > 0 && (
                                  <div>
                                    <label className="text-xs font-medium mb-2 block">📷 Edit Photos:</label>
                                    <div className="space-y-2">
                                      {relatedPhotos.map((photo) => (
                                        <div key={photo.id} className="flex gap-2 items-start p-2 bg-slate-900/50 rounded">
                                          <img src={photo.url} alt={photo.label || 'Photo'} className="w-16 h-16 object-cover rounded" />
                                          <div className="flex-1">
                                            <input
                                              type="text"
                                              value={editingPhotoLabels[photo.id] ?? photo.label ?? ''}
                                              onChange={(e) => setEditingPhotoLabels({ ...editingPhotoLabels, [photo.id]: e.target.value })}
                                              placeholder="Label photo..."
                                              className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground mb-1"
                                            />
                                            <div className="flex gap-1">
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-5 text-xs text-cyan-400"
                                                onClick={() => {
                                                  updatePhotoLabelMutation.mutate({ 
                                                    photoId: photo.id, 
                                                    label: editingPhotoLabels[photo.id] ?? photo.label ?? '' 
                                                  });
                                                }}
                                                disabled={updatePhotoLabelMutation.isPending}
                                              >
                                                Simpan Label
                                              </Button>
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-5 text-xs text-red-400"
                                                onClick={async () => {
                                                  const ok = await confirm({
                                                    title: 'Delete Photo',
                                                    description: 'Are you sure you want to delete this photo?',
                                                    confirmText: 'Delete',
                                                    variant: 'destructive',
                                                  });
                                                  if (ok) deletePhoto.mutate(photo.id);
                                                }}
                                                disabled={deletePhoto.isPending}
                                              >
                                                🗑️
                                              </Button>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Add New Photos */}
                                <div>
                                  <label className="text-xs font-medium mb-2 block">📷 Tambah Photos Baru:</label>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={(e) => {
                                      const files = Array.from(e.target.files || []);
                                      setNewPhotosForHistory({ ...newPhotosForHistory, [h.id]: files });
                                    }}
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground file:mr-4 file:rounded-md file:border-0 file:bg-cyan-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                                  />
                                  {newPhotos.length > 0 && (
                                    <div className="mt-2">
                                      <input
                                        type="text"
                                        value={newPhotoLabels[h.id] ?? ''}
                                        onChange={(e) => setNewPhotoLabels({ ...newPhotoLabels, [h.id]: e.target.value })}
                                        placeholder="Label untuk photos baru (optional)"
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground mb-2"
                                      />
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs"
                                        onClick={() => {
                                          uploadPhotosForHistoryMutation.mutate({
                                            historyId: h.id,
                                            files: newPhotos,
                                            label: newPhotoLabels[h.id],
                                          });
                                        }}
                                        disabled={uploadPhotosForHistoryMutation.isPending}
                                      >
                                        Upload {newPhotos.length} Photo(s)
                                      </Button>
                                    </div>
                                  )}
                                </div>
                                
                                <div className="flex gap-2 pt-2">
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="h-7 text-xs flex-1"
                                    onClick={() => {
                                      updateHistoryMutation.mutate({ historyId: h.id, notes: editNotes });
                                    }}
                                    disabled={updateHistoryMutation.isPending || uploadPhotosForHistoryMutation.isPending}
                                  >
                                    Simpan Semua
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={() => {
                                      setEditingHistoryId(null);
                                      setEditNotes('');
                                      setEditingPhotoLabels({});
                                      setNewPhotosForHistory({});
                                      setNewPhotoLabels({});
                                    }}
                                    disabled={updateHistoryMutation.isPending || uploadPhotosForHistoryMutation.isPending}
                                  >
                                    Batal
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {cleanNotes ? (
                                  <p className="text-xs text-muted-foreground mt-1 bg-slate-900/50 rounded px-2 py-1.5">
                                    {cleanNotes}
                                  </p>
                                ) : null}
                                
                                {/* Show Related Photos */}
                                {relatedPhotos.length > 0 && (
                                  <div className="mt-2 space-y-2">
                                    <div className="text-xs font-medium text-slate-400 mb-1">📷 Photos ({relatedPhotos.length}):</div>
                                    <div className="grid grid-cols-3 gap-2">
                                      {relatedPhotos.map((photo) => (
                                        <div key={photo.id} className="relative group">
                                          <img src={photo.url} alt={photo.label || 'Photo'} className="w-full h-20 object-cover rounded border border-slate-700" />
                                          {photo.label && (
                                            <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-[10px] px-1 py-0.5 rounded-b truncate">
                                              {photo.label}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                
                                {hasAnyRole(user?.role, ['ADMIN', 'ADMIN', 'USER']) && (
                                  <div className="flex gap-2 mt-2">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 text-xs text-cyan-400 hover:text-cyan-300"
                                      onClick={() => {
                                        setEditingHistoryId(h.id);
                                        setEditNotes(cleanNotes);
                                        // Initialize photo labels for editing
                                        const labels: Record<string, string> = {};
                                        relatedPhotos.forEach(photo => {
                                          labels[photo.id] = photo.label || '';
                                        });
                                        setEditingPhotoLabels(labels);
                                      }}
                                    >
                                      ✏️ Edit
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 text-xs text-red-400 hover:text-red-300"
                                      onClick={async () => {
                                        const ok = await confirm({
                                          title: 'Delete History Entry',
                                          description: 'Are you sure you want to delete this timeline entry? This action cannot be undone.',
                                          confirmText: 'Delete',
                                          variant: 'destructive',
                                        });
                                        if (ok) deleteHistoryMutation.mutate(h.id);
                                      }}
                                      disabled={deleteHistoryMutation.isPending}
                                    >
                                      🗑️ Delete
                                    </Button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </section>
       
    </AuthGuard>
  );
}





