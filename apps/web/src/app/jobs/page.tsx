"use client";

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import AuthGuard from '@/components/auth-guard';
import { apiGet, apiDelete, apiPut, claimJob } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/toast-provider';
import { useAuth } from '@/lib/auth';
import { hasAnyRole } from '@/lib/roles';
import { Wrench, LayoutGrid, List } from 'lucide-react';
import { SectionHeader } from '@/components/section-header';
import { JobKanbanBoard } from '@/components/job-kanban-board';

type Job = {
  id: string;
  title: string;
  status: 'AWAITING_QUOTE' | 'QUOTATION_SENT' | 'APPROVED' | 'REPAIRING' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  customer: { id: string; name: string };
  device: { id: string; deviceType: string; brand?: string | null; model?: string | null };
  createdAt: string;
  thumbnailUrl?: string | null;
  photoCount?: number;
  quotedAmount?: number | null;
  description?: string | null;
  ownerUserId?: string | null;
  ownerName?: string | null;
  isOwner?: boolean;
};

export default function JobsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const toast = useToast();

  const jobsQuery = useQuery({
    queryKey: ['jobs'],
    queryFn: async () => apiGet<Job[]>(`/api/jobs`),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ jobId, status }: { jobId: string; status: Job['status'] }) => {
      const job = jobs.find(j => j.id === jobId);
      console.log('Updating job:', jobId, 'to status:', status);

      // Check if this is a job claim (from AWAITING_QUOTE to QUOTATION_SENT)
      if (job && job.status === 'AWAITING_QUOTE' && status === 'QUOTATION_SENT' && !job.ownerUserId) {
        console.log('Job claim detected for:', job.title);
      }

      return apiPut(`/api/jobs/${jobId}`, { status });
    },
    onMutate: async ({ jobId, status }) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await qc.cancelQueries({ queryKey: ['jobs'] });

      // Snapshot the previous value
      const previousJobs = qc.getQueryData<Job[]>(['jobs']);

      // Optimistically update to the new value
      qc.setQueryData<Job[]>(['jobs'], (old) => {
        if (!old) return old;
        return old.map(job => {
          if (job.id === jobId) {
            const isBeingClaimed = job.status === 'AWAITING_QUOTE' && status !== 'AWAITING_QUOTE' && !job.ownerUserId;
            return {
              ...job,
              status,
              // Optimistically set owner if this is a claim
              ...(isBeingClaimed && user ? {
                ownerUserId: user.id,
                ownerName: user.name || user.username,
                isOwner: true,
              } : {})
            };
          }
          return job;
        });
      });

      // Return a context object with the snapshotted value
      return { previousJobs };
    },
    onSuccess: async (data, variables) => {
      // Refetch to get the latest data from server
      await qc.invalidateQueries({ queryKey: ['jobs'] });

      const job = jobs.find(j => j.id === variables.jobId);

      // Check if job was claimed (moved from AWAITING_QUOTE to QUOTATION_SENT)
      if (job && job.status === 'AWAITING_QUOTE' && variables.status === 'QUOTATION_SENT' && !job.ownerUserId) {
        toast.success(`🎯 Job "${job.title}" telah berjaya dituntut! Sekarang ia adalah milik anda.`, {
          duration: 5000,
        });
      } else {
        toast.success('Job status updated');
      }
    },
    onError: (e: any, variables, context) => {
      // Rollback to the previous value on error
      if (context?.previousJobs) {
        qc.setQueryData(['jobs'], context.previousJobs);
      }
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
    onError: (e: any) => {
      // If job not found, it might have been deleted already - just refresh
      if (e?.message?.includes('not found') || e?.status === 404) {
        qc.invalidateQueries({ queryKey: ['jobs'] });
        toast.info('Job may have already been deleted');
      } else {
        toast.error(e?.message || 'Failed to delete job');
      }
    },
  });

  const claimJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return claimJob(jobId);
    },
    onMutate: async (jobId) => {
      // Cancel any outgoing refetches
      await qc.cancelQueries({ queryKey: ['jobs'] });

      // Snapshot the previous value
      const previousJobs = qc.getQueryData<Job[]>(['jobs']);

      // Optimistically update the job
      qc.setQueryData<Job[]>(['jobs'], (old) => {
        if (!old) return old;
        return old.map(job => {
          if (job.id === jobId && user) {
            return {
              ...job,
              ownerUserId: user.id,
              ownerName: user.name || user.username,
              isOwner: true,
            };
          }
          return job;
        });
      });

      return { previousJobs };
    },
    onSuccess: async (_, jobId) => {
      toast.success('Job successfully claimed!');
      await qc.invalidateQueries({ queryKey: ['jobs'] });
    },
    onError: (err: any, variables, context) => {
      // Rollback on error
      if (context?.previousJobs) {
        qc.setQueryData(['jobs'], context.previousJobs);
      }
      toast.error(err?.message || 'Failed to claim job');
    },
  });

  const jobs = jobsQuery.data || [];

  const handleStatusChange = async (jobId: string, newStatus: Job['status']) => {
    await updateStatusMutation.mutateAsync({ jobId, status: newStatus });
  };

  const handleClaimJob = async (jobId: string) => {
    await claimJobMutation.mutateAsync(jobId);
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

        {!hasAnyRole(user?.role, ['ADMIN', 'USER']) ? (
          <div className="rounded-md border border-amber-400/60 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            You have read-only access to jobs. Contact an administrator for edit permissions.
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6">
          {/* Kanban Board - Full Width */}
          <div>
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
                    onClaimJob={handleClaimJob}
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
                              {hasAnyRole(user?.role, ['ADMIN']) ? (
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
        </div>
      </section>
    </AuthGuard>
  );
}
