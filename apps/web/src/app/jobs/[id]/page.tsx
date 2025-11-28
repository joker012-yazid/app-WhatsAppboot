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
    status: 'PENDING' | 'QUOTED' | 'APPROVED' | 'REJECTED' | 'IN_PROGRESS' | 'COMPLETED';
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

  const [status, setStatus] = useState<JobDetail['job']['status']>('PENDING');
  const [priority, setPriority] = useState<JobDetail['job']['priority']>('NORMAL');
  const [dueDate, setDueDate] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [error, setError] = useState<string | null>(null);

  const statusOptions: JobDetail['job']['status'][] = [
    'PENDING',
    'QUOTED',
    'APPROVED',
    'REJECTED',
    'IN_PROGRESS',
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
      toast.success('Job updated');
    },
    onError: (e: any) => setError(e?.message || 'Failed to update job'),
  });

  const { data: history } = useQuery({
    queryKey: ['job-history', id],
    queryFn: async () => apiGet<{ id: string; status: string; notes?: string | null; createdAt: string }[]>(`/api/jobs/${id}/history`),
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
      return apiUpload(`/api/jobs/${id}/photos`, form);
    },
    onSuccess: async (res: any[]) => {
      setLabel('');
      setFiles(null);
      (document.getElementById('photo-input') as HTMLInputElement | null)?.value && ((document.getElementById('photo-input') as HTMLInputElement).value = '');
      await refetchPhotos();
      toast.success(`Uploaded ${res?.length ?? files?.length ?? 0} photo(s)`);
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
              <h2 className="mb-3 text-lg font-semibold">AI Assistant</h2>
              <AiChat jobId={id} />
            </div>
            <div className="rounded-xl border bg-card p-4">
              <h2 className="mb-3 text-lg font-semibold">QR Registration</h2>
              {qrUrl ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground break-all">
                    <span className="font-medium">URL:</span> {qrUrl}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(qrUrl);
                      }}
                    >
                      Copy link
                    </Button>
                    <Button asChild variant="outline">
                      <a href={qrUrl} target="_blank" rel="noreferrer">
                        Open link
                      </a>
                    </Button>
                    {hasAnyRole(user?.role, ['ADMIN','MANAGER','TECHNICIAN']) ? (
                      <Button variant="secondary" type="button" onClick={() => renewQr.mutate()} disabled={renewQr.isPending}>
                        {renewQr.isPending ? 'Reissuing…' : 'Reissue QR'}
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Share this link with the customer to complete registration.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Loading QR link…</p>
              )}
            </div>

            <div className="rounded-xl border bg-card p-4">
              <h2 className="mb-3 text-lg font-semibold">Photos</h2>
              <form
                className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  setPhotoError(null);
                  uploadMutation.mutate();
                }}
              >
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
                  className="md:col-span-2"
                />
                <input
                  type="text"
                  placeholder="Label (optional)"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                />
                <div className="md:col-span-3">
                  <p className="mb-2 text-xs text-muted-foreground">PNG/JPG/WebP up to 5 MB each. Max 6 files.</p>
                  {photoError ? <p className="mb-2 text-sm text-red-500">{photoError}</p> : null}
                  <Button type="submit" disabled={uploadMutation.isPending || !files || files.length === 0 || !!photoError || !hasAnyRole(user?.role, ['ADMIN','MANAGER','TECHNICIAN'])}>
                    {uploadMutation.isPending ? 'Uploading…' : 'Upload'}
                  </Button>
                </div>
              </form>
              {!photos ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : photos.length === 0 ? (
                <p className="text-sm text-muted-foreground">No photos yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {photos.map((p) => (
                    <figure key={p.id} className="space-y-1">
                      <img src={p.url} alt={p.label || 'Job photo'} className="h-40 w-full rounded-md object-cover" />
                      <figcaption className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="truncate">{p.label || '—'}</span>
                        {hasAnyRole(user?.role, ['ADMIN','MANAGER','TECHNICIAN']) ? (
                        <button
                          className="rounded border px-2 py-0.5"
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
                          Delete
                        </button>
                        ) : null}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border bg-card p-4">
              <h2 className="mb-3 text-lg font-semibold">Status & Scheduling</h2>
              <form
                className="grid grid-cols-1 gap-3 md:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setError(null);
                  updateMutation.mutate();
                }}
              >
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="status">
                    Status
                  </label>
                  <select
                    id="status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                    disabled={!hasAnyRole(user?.role, ['ADMIN','MANAGER','TECHNICIAN'])}
                  >
                    {statusOptions.map((s) => (
                      <option key={s} value={s} className="bg-background text-foreground">
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium" htmlFor="priority">
                    Priority
                  </label>
                  <select
                    id="priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                    disabled={!hasAnyRole(user?.role, ['ADMIN','MANAGER','TECHNICIAN'])}
                  >
                    {priorityOptions.map((p) => (
                      <option key={p} value={p} className="bg-background text-foreground">
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-medium" htmlFor="due">
                    Due date
                  </label>
                  <input
                    id="due"
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                    disabled={!hasAnyRole(user?.role, ['ADMIN','MANAGER','TECHNICIAN'])}
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="text-sm font-medium" htmlFor="diagnosis">
                    Diagnosis (optional)
                  </label>
                  <textarea
                    id="diagnosis"
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    className="h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                    disabled={!hasAnyRole(user?.role, ['ADMIN','MANAGER','TECHNICIAN'])}
                  />
                </div>
                {error ? (
                  <p className="text-sm text-red-500 md:col-span-2">{error}</p>
                ) : null}
                {hasAnyRole(user?.role, ['ADMIN','MANAGER','TECHNICIAN']) ? (
                  <div className="md:col-span-2">
                    <Button type="submit" disabled={updateMutation.isPending}>
                      {updateMutation.isPending ? 'Saving…' : 'Save changes'}
                    </Button>
                  </div>
                ) : null}
              </form>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl border bg-card p-4">
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Meta</h3>
              <ul className="text-sm">
                <li>
                  <span className="text-muted-foreground">Created:</span>{' '}
                  {job ? new Date(job.createdAt).toLocaleString() : '-'}
                </li>
                <li>
                  <span className="text-muted-foreground">Status:</span> {job?.status || '-'}
                </li>
                <li>
                  <span className="text-muted-foreground">Priority:</span> {job?.priority || '-'}
                </li>
              </ul>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Status History</h3>
              {!history ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No changes yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {history.map((h) => (
                    <li key={h.id} className="border-b pb-2 last:border-b-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{h.status}</span>
                        <span className="text-xs text-muted-foreground">{new Date(h.createdAt).toLocaleString()}</span>
                      </div>
                      {h.notes ? <p className="text-muted-foreground">{h.notes}</p> : null}
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

function AiChat({ jobId }: { jobId: string }) {
  const { data, refetch, isFetching } = useQuery({
    queryKey: ['ai-messages', jobId],
    queryFn: async () => apiGet<{ conversationId: string | null; messages: { id: string; role: string; content: string; createdAt: string }[] }>(
      `/api/ai/job/${jobId}/messages`,
    ),
  });
  const toast = useToast();
  const [input, setInput] = useState('');
  const ask = useMutation({
    mutationFn: async () => apiPost<{ conversationId: string; reply: string }>(`/api/ai/ask`, { jobId, message: input }),
    onSuccess: async () => {
      setInput('');
      await refetch();
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to ask AI'),
  });

  return (
    <div className="space-y-3">
      <div className="max-h-64 space-y-2 overflow-auto rounded border p-3 text-sm">
        {!data || isFetching ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : data.messages.length === 0 ? (
          <p className="text-muted-foreground">No messages yet. Ask something about this job.</p>
        ) : (
          data.messages.map((m) => (
            <div key={m.id} className={m.role === 'USER' ? 'text-right' : 'text-left'}>
              <span
                className={`inline-block rounded-md px-2 py-1 ${m.role === 'USER' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}
              >
                {m.content}
              </span>
            </div>
          ))
        )}
      </div>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim()) return;
          ask.mutate();
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask AI about this job…"
          className="flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
        />
        <Button type="submit" disabled={ask.isPending || !input.trim()}>
          {ask.isPending ? 'Sending…' : 'Send'}
        </Button>
      </form>
    </div>
  );
}




