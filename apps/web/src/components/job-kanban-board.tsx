'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Clock,
  CheckCircle2,
  PlayCircle,
  Package,
  MoreVertical,
  Trash2,
  Eye,
  User,
  UserCircle,
  UserCheck,
  Smartphone,
  Calendar,
  DollarSign,
  Briefcase,
  HandMetal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatedButton } from './ui/animated-button';
import { useConfirm } from './confirm-provider';
import { hasAnyRole } from '@/lib/roles';

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

type KanbanColumn = {
  id: string;
  title: string;
  status: Job['status'];
  icon: React.ReactNode;
  color: string;
  bgGradient: string;
};

// Use Object.freeze to ensure the columns array cannot be modified
const columns: KanbanColumn[] = Object.freeze([
  {
    id: 'AWAITING_QUOTE',
    title: 'Awaiting Quote',
    status: 'AWAITING_QUOTE',
    icon: <Clock className="h-4 w-4" />,
    color: 'text-amber-400',
    bgGradient: 'from-amber-500/20 to-orange-500/10',
  },
  {
    id: 'QUOTATION_SENT',
    title: 'Quotation Sent',
    status: 'QUOTATION_SENT',
    icon: <Package className="h-4 w-4" />,
    color: 'text-blue-400',
    bgGradient: 'from-blue-500/20 to-cyan-500/10',
  },
  {
    id: 'APPROVED',
    title: 'Approved',
    status: 'APPROVED',
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: 'text-violet-400',
    bgGradient: 'from-violet-500/20 to-purple-500/10',
  },
  {
    id: 'REPAIRING',
    title: 'Repairing',
    status: 'REPAIRING',
    icon: <PlayCircle className="h-4 w-4" />,
    color: 'text-orange-400',
    bgGradient: 'from-orange-500/20 to-red-500/10',
  },
  {
    id: 'COMPLETED',
    title: 'Completed',
    status: 'COMPLETED',
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: 'text-emerald-400',
    bgGradient: 'from-emerald-500/20 to-green-500/10',
  },
]);

const priorityConfig = {
  LOW: { color: 'bg-slate-500', label: 'Low', dot: 'bg-slate-400' },
  NORMAL: { color: 'bg-blue-500', label: 'Normal', dot: 'bg-blue-400' },
  HIGH: { color: 'bg-orange-500', label: 'High', dot: 'bg-orange-400' },
  URGENT: { color: 'bg-red-500 animate-pulse', label: 'Urgent', dot: 'bg-red-400 animate-pulse' },
};

// Job Card Component
interface JobCardProps {
  job: Job;
  onDelete?: (id: string) => void;
  onClaimJob?: (id: string) => Promise<void>;
  userRole?: string;
  isDragging?: boolean;
}

const JobCard = React.forwardRef<HTMLDivElement, JobCardProps>(
  ({ job, onDelete, onClaimJob, userRole, isDragging }, forwardedRef) => {
    const [isDeleting, setIsDeleting] = React.useState(false);
    
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging: sortableIsDragging,
    } = useSortable({
      id: job.id,
      data: { job },
    });

    // Combine forwarded ref with dnd-kit ref
    const ref = React.useCallback(
      (node: HTMLDivElement | null) => {
        setNodeRef(node);
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else if (forwardedRef) {
          (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }
      },
      [setNodeRef, forwardedRef]
    );

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    const confirm = useConfirm();
    const priority = priorityConfig[job.priority];

    return (
      <motion.div
        ref={ref}
      style={style}
      {...attributes}
      {...listeners}
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{
        opacity: sortableIsDragging ? 0.5 : 1,
        scale: sortableIsDragging ? 1.05 : 1,
        rotateZ: sortableIsDragging ? 3 : 0,
      }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -2 }}
      className={cn(
        'group relative cursor-grab active:cursor-grabbing',
        'rounded-xl border border-border bg-card/80 backdrop-blur-sm',
        'shadow-sm hover:shadow-lg hover:shadow-primary/5',
        'transition-all duration-200'
      )}
    >
      {/* Priority Indicator */}
      <div
        className={cn(
          'absolute left-0 top-0 h-full w-1 rounded-l-xl',
          priority.color
        )}
      />
      
      {/* Thumbnail */}
      {job.thumbnailUrl && (
        <div className="relative overflow-hidden rounded-t-xl">
          <img 
            src={job.thumbnailUrl} 
            alt="thumbnail"
            className="h-28 w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {job.photoCount && job.photoCount > 1 && (
            <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
              {job.photoCount} photos
            </span>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
        </div>
      )}

      {/* Ownership Indicators */}
      <div className="px-3 pt-2">
        {job.status === 'AWAITING_QUOTE' && !job.ownerUserId ? (
          <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-2 py-1">
            <HandMetal className="h-3 w-3 text-amber-400" />
            <span className="text-xs font-medium text-amber-400">Available - Drag to claim</span>
          </div>
        ) : job.isOwner ? (
          <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-2 py-1">
            <UserCheck className="h-3 w-3 text-emerald-300" />
            <span className="text-xs font-bold text-emerald-300">Job Saya</span>
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse"></div>
          </div>
        ) : job.ownerName ? (
          <div className="flex items-center gap-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 px-2 py-1">
            <div className="h-6 w-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <UserCircle className="h-4 w-4 text-blue-400" />
            </div>
            <span className="text-xs font-medium text-blue-400">{job.ownerName}</span>
            <div className="text-xs text-blue-500/70">Owner</div>
          </div>
        ) : null}
      </div>

      <div className="p-3">
      {/* Title */}
      <Link href={`/jobs/${job.id}`}>
          <h4 className="font-semibold text-sm text-foreground line-clamp-2 hover:text-primary transition-colors">
          {job.title}
        </h4>
      </Link>

        {/* Meta Info */}
        <div className="mt-2 space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            <span className="truncate">{job.customer?.name}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Smartphone className="h-3 w-3" />
            <span className="truncate">
              {[job.device?.deviceType, job.device?.brand, job.device?.model]
                .filter(Boolean)
                .join(' ')}
            </span>
          </div>
        {job.quotedAmount && (
            <div className="flex items-center gap-2 text-xs">
              <DollarSign className="h-3 w-3 text-green-500" />
              <span className="font-semibold text-green-500">
                RM {Number(job.quotedAmount).toFixed(2)}
              </span>
            </div>
        )}
      </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between">
          {/* Priority Badge */}
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white',
              priority.color
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full bg-primary-foreground', job.priority === 'URGENT' && 'animate-pulse')} />
            {priority.label}
        </span>

          {/* Date */}
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Calendar className="h-3 w-3" />
          {new Date(job.createdAt).toLocaleDateString()}
          </div>
      </div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-3 flex gap-2 overflow-hidden"
        >
          <AnimatedButton
            size="sm"
            variant="outline"
            className="h-7 flex-1 text-xs"
            asChild
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Link href={`/jobs/${job.id}`} onClick={(e) => e.stopPropagation()}>
              <Eye className="h-3 w-3 mr-1" />
              View
            </Link>
          </AnimatedButton>
          {/* Claim button for available jobs */}
          {job.status === 'AWAITING_QUOTE' && !job.ownerUserId && !hasAnyRole(userRole, ['ADMIN']) && onClaimJob && (
            <AnimatedButton
              size="sm"
              variant="gradient"
              className="h-7 text-xs flex-1"
              onPointerDown={(e) => {
                e.stopPropagation();
              }}
              onClick={async (e) => {
                e.stopPropagation();
                e.preventDefault();
                await onClaimJob(job.id);
              }}
            >
              <UserCheck className="h-3 w-3 mr-1" />
              Claim Job
            </AnimatedButton>
          )}
        {hasAnyRole(userRole, ['ADMIN']) && onDelete && (
            <AnimatedButton
            size="sm"
            variant="destructive"
            className="h-7 text-xs"
            onPointerDown={(e) => {
              // Stop dnd-kit from capturing this event
              e.stopPropagation();
            }}
            onClick={async (e) => {
              e.stopPropagation();
              e.preventDefault();
              if (isDeleting) return; // Prevent multiple clicks
              
              const ok = await confirm({
                  title: 'Delete Job',
                  description: 'Are you sure you want to delete this job? This action cannot be undone.',
                variant: 'destructive',
                confirmText: 'Delete',
              });
              if (ok && onDelete) {
                setIsDeleting(true);
                onDelete(job.id);
                // Reset after a delay to allow mutation to complete
                setTimeout(() => setIsDeleting(false), 2000);
              }
            }}
            disabled={isDeleting}
          >
              <Trash2 className="h-3 w-3" />
            </AnimatedButton>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
});

JobCard.displayName = 'JobCard';

// Droppable Column Component
interface DroppableColumnProps {
  column: KanbanColumn;
  jobs: Job[];
  activeId: string | null;
  onDelete: (id: string) => void;
  onClaimJob?: (id: string) => Promise<void>;
  userRole?: string;
}

function DroppableColumn({ column, jobs, activeId, onDelete, onClaimJob, userRole }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.status,
  });

  // Calculate job breakdown for columns beyond Awaiting Quote
  const jobBreakdown = React.useMemo(() => {
    if (column.status === 'AWAITING_QUOTE') {
      return null;
    }

    const breakdown = jobs.reduce((acc, job) => {
      if (!job.ownerName) {
        acc.unassigned++;
      } else {
        acc.users[job.ownerName] = (acc.users[job.ownerName] || 0) + 1;
      }
      return acc;
    }, { unassigned: 0, users: {} as Record<string, number> });

    return breakdown;
  }, [jobs, column.status]);

  return (
    <div className="flex flex-col h-full">
      {/* Column Header */}
      <motion.div
        className={cn(
          'flex items-center justify-between rounded-t-xl border border-b-0 border-border px-4 py-3',
          'bg-gradient-to-br backdrop-blur-sm',
          column.bgGradient
        )}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-2">
          <div className={cn('rounded-lg bg-card/50 p-2', column.color)}>
            {column.icon}
          </div>
          <h3 className="font-bold text-sm text-foreground">{column.title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <motion.span
            className={cn(
              'rounded-full bg-card/80 border border-border px-2.5 py-1 text-xs font-bold',
              column.color
            )}
            key={jobs.length}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
          >
            {jobs.length}
          </motion.span>

          {/* User breakdown for assigned columns */}
          {jobBreakdown && (
            <div className="flex -space-x-1">
              {jobBreakdown.unassigned > 0 && (
                <div className="h-6 w-6 rounded-full bg-muted border border-border flex items-center justify-center">
                  <Briefcase className="h-3 w-3 text-muted-foreground" />
                </div>
              )}
              {Object.entries(jobBreakdown.users).slice(0, 3).map(([name, count], index) => (
                <div
                  key={name}
                  className="h-6 w-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-medium text-primary"
                  title={`${name}: ${count} jobs`}
                >
                  {name.charAt(0).toUpperCase()}
                </div>
              ))}
              {Object.keys(jobBreakdown.users).length > 3 && (
                <div className="h-6 w-6 rounded-full bg-muted/50 border border-muted flex items-center justify-center text-xs font-medium">
                  +{Object.keys(jobBreakdown.users).length - 3}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Drop Zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 min-h-[400px] rounded-b-xl border border-border p-3 space-y-3',
          'bg-card/30 backdrop-blur-sm transition-all duration-200',
          isOver && 'bg-primary/10 border-primary/50 ring-2 ring-primary/20'
        )}
      >
        <SortableContext items={jobs.map((j) => j.id)} strategy={verticalListSortingStrategy}>
          <AnimatePresence mode="popLayout">
            {jobs.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-border text-xs text-muted-foreground"
              >
                Drop jobs here
              </motion.div>
            ) : (
              jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onDelete={onDelete}
                  onClaimJob={onClaimJob}
                  userRole={userRole}
                  isDragging={job.id === activeId}
                />
              ))
            )}
          </AnimatePresence>
        </SortableContext>
      </div>
    </div>
  );
}

// Main Kanban Board Component
interface KanbanBoardProps {
  jobs: Job[];
  onStatusChange: (jobId: string, newStatus: Job['status']) => Promise<void>;
  onClaimJob?: (jobId: string) => Promise<void>;
  onDelete: (jobId: string) => void;
  userRole?: string;
}

export function JobKanbanBoard({ jobs, onStatusChange, onClaimJob, onDelete, userRole }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const activeJob = jobs.find((j) => j.id === activeId);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) {
      console.log('[KANBAN] No droppable target');
      return;
    }

    const jobId = active.id as string;
    const newStatus = over.id as string;

    console.log('[KANBAN] Drag end details:', {
      jobId,
      activeId: active.id,
      overId: over.id,
      newStatus,
      isStatusValid: ['AWAITING_QUOTE', 'QUOTATION_SENT', 'APPROVED', 'REPAIRING', 'COMPLETED'].includes(newStatus),
      overData: over.data,
      allColumns: columns.map(c => ({ id: c.id, status: c.status }))
    });

    // Only proceed if the target is a valid column
    if (!['AWAITING_QUOTE', 'QUOTATION_SENT', 'APPROVED', 'REPAIRING', 'COMPLETED'].includes(newStatus)) {
      console.error('[KANBAN] Invalid status detected:', newStatus);
      return;
    }

    const job = jobs.find((j) => j.id === jobId);
    if (!job) {
      console.error('[KANBAN] Job not found:', jobId);
      return;
    }

    if (job.status !== newStatus) {
      console.log('[KANBAN] Updating job status:', {
        jobId,
        oldStatus: job.status,
        newStatus
      });
      await onStatusChange(jobId, newStatus as Job['status']);
    } else {
      console.log('[KANBAN] Status unchanged, skipping update');
    }
  };

  const getJobsByStatus = (status: Job['status']) => {
    return jobs.filter((j) => j.status === status);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {columns.map((column) => {
          const columnJobs = getJobsByStatus(column.status);
          
          return (
            <DroppableColumn
              key={column.id}
              column={column}
              jobs={columnJobs}
              activeId={activeId}
              onDelete={onDelete}
              onClaimJob={onClaimJob}
              userRole={userRole}
            />
          );
        })}
      </div>

      {/* Drag Overlay */}
      <DragOverlay dropAnimation={{ duration: 200, easing: 'ease-out' }}>
        {activeId && activeJob ? (
          <motion.div
            initial={{ scale: 1 }}
            animate={{ scale: 1.05, rotate: 3 }}
            className="opacity-90 shadow-2xl"
          >
            <JobCard job={activeJob} userRole={userRole} />
          </motion.div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
