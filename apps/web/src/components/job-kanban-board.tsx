"use client";

import { useState } from 'react';
import Link from 'next/link';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCorners, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Clock, AlertCircle, CheckCircle2, XCircle, PlayCircle, Package } from 'lucide-react';
import { Button } from './ui/button';
import { useConfirm } from './confirm-provider';
import { hasAnyRole } from '@/lib/roles';

type Job = {
  id: string;
  title: string;
  status: 'PENDING' | 'QUOTED' | 'APPROVED' | 'REJECTED' | 'IN_PROGRESS' | 'COMPLETED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  customer: { id: string; name: string };
  device: { id: string; deviceType: string; brand?: string | null; model?: string | null };
  createdAt: string;
  thumbnailUrl?: string | null;
  photoCount?: number;
  quotedAmount?: number | null;
  description?: string | null;
};

type KanbanColumn = {
  id: string;
  title: string;
  status: Job['status'];
  icon: React.ReactNode;
  color: string;
  bgColor: string;
};

const columns: KanbanColumn[] = [
  { 
    id: 'PENDING', 
    title: 'Awaiting Quote', 
    status: 'PENDING',
    icon: <Clock className="h-4 w-4" />,
    color: 'text-amber-400',
    bgColor: 'bg-gradient-to-br from-amber-900/30 to-orange-900/20'
  },
  { 
    id: 'QUOTED', 
    title: 'Quotation Sent', 
    status: 'QUOTED',
    icon: <Package className="h-4 w-4" />,
    color: 'text-blue-400',
    bgColor: 'bg-gradient-to-br from-blue-900/30 to-cyan-900/20'
  },
  { 
    id: 'APPROVED', 
    title: 'Approved', 
    status: 'APPROVED',
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: 'text-green-400',
    bgColor: 'bg-gradient-to-br from-green-900/30 to-emerald-900/20'
  },
  { 
    id: 'IN_PROGRESS', 
    title: 'Repairing', 
    status: 'IN_PROGRESS',
    icon: <PlayCircle className="h-4 w-4" />,
    color: 'text-purple-400',
    bgColor: 'bg-gradient-to-br from-purple-900/30 to-pink-900/20'
  },
  { 
    id: 'COMPLETED', 
    title: 'Completed', 
    status: 'COMPLETED',
    icon: <CheckCircle2 className="h-4 w-4" />,
    color: 'text-emerald-400',
    bgColor: 'bg-gradient-to-br from-emerald-900/30 to-teal-900/20'
  },
];

const priorityColors = {
  LOW: 'bg-slate-600 shadow-slate-500/50',
  NORMAL: 'bg-blue-600 shadow-blue-500/50',
  HIGH: 'bg-orange-600 shadow-orange-500/50',
  URGENT: 'bg-red-600 shadow-red-500/50 animate-pulse'
};

interface JobCardProps {
  job: Job;
  onDelete?: (id: string) => void;
  userRole?: string;
  isDragging?: boolean;
}

function JobCard({ job, onDelete, userRole, isDragging }: JobCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: sortableIsDragging } = useSortable({ 
    id: job.id,
    data: { job }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: sortableIsDragging ? 0.5 : 1,
  };

  const confirm = useConfirm();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group relative cursor-grab active:cursor-grabbing rounded-lg border border-slate-800/70 bg-gradient-to-br from-slate-900/80 to-slate-950/80 p-3 shadow-lg backdrop-blur transition-all duration-200 hover:border-slate-700 hover:shadow-xl hover:scale-[1.02] ${isDragging ? 'rotate-3 scale-105 shadow-2xl' : ''}`}
    >
      {/* Priority indicator */}
      <div className={`absolute left-0 top-0 h-full w-1 rounded-l-lg ${priorityColors[job.priority]} shadow-lg`} />
      
      {/* Thumbnail */}
      {job.thumbnailUrl && (
        <div className="relative mb-2">
          <img 
            src={job.thumbnailUrl} 
            alt="thumb" 
            className="h-24 w-full rounded object-cover"
          />
          {job.photoCount && job.photoCount > 1 && (
            <span className="absolute right-1 top-1 rounded-full bg-black/80 px-2 py-0.5 text-xs text-white">
              {job.photoCount} photos
            </span>
          )}
        </div>
      )}

      {/* Title */}
      <Link href={`/jobs/${job.id}`}>
        <h4 className="mb-1 font-semibold text-sm text-slate-50 hover:text-sky-400 transition line-clamp-2">
          {job.title}
        </h4>
      </Link>

      {/* Customer & Device */}
      <div className="space-y-1 text-xs text-slate-400">
        <p className="truncate">
          <span className="text-slate-500">Customer:</span> {job.customer?.name}
        </p>
        <p className="truncate">
          <span className="text-slate-500">Device:</span> {[job.device?.deviceType, job.device?.brand, job.device?.model].filter(Boolean).join(' ')}
        </p>
        {job.quotedAmount && (
          <p>
            <span className="text-slate-500">Quote:</span> <span className="font-semibold text-green-400">RM {Number(job.quotedAmount).toFixed(2)}</span>
          </p>
        )}
      </div>

      {/* Priority badge */}
      <div className="mt-2 flex items-center justify-between">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${priorityColors[job.priority]} text-white`}>
          {job.priority}
        </span>
        <span className="text-[10px] text-slate-500">
          {new Date(job.createdAt).toLocaleDateString()}
        </span>
      </div>

      {/* Actions (visible on hover) */}
      <div className="mt-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button asChild size="sm" variant="outline" className="h-7 text-xs flex-1">
          <Link href={`/jobs/${job.id}`}>View</Link>
        </Button>
        {hasAnyRole(userRole, ['ADMIN', 'MANAGER']) && onDelete && (
          <Button
            size="sm"
            variant="destructive"
            className="h-7 text-xs"
            onClick={async (e) => {
              e.stopPropagation();
              const ok = await confirm({
                title: 'Delete job',
                description: 'Are you sure? This cannot be undone.',
                variant: 'destructive',
                confirmText: 'Delete',
              });
              if (ok) onDelete(job.id);
            }}
          >
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}

interface KanbanBoardProps {
  jobs: Job[];
  onStatusChange: (jobId: string, newStatus: Job['status']) => Promise<void>;
  onDelete: (jobId: string) => void;
  userRole?: string;
}

export function JobKanbanBoard({ jobs, onStatusChange, onDelete, userRole }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const activeJob = jobs.find(j => j.id === activeId);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setIsDragging(true);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setIsDragging(false);

    if (!over) return;

    const jobId = active.id as string;
    const newStatus = over.id as Job['status']; // over.id is the status now
    
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    // Only update if status changed
    if (job.status !== newStatus) {
      console.log('Updating job:', jobId, 'from', job.status, 'to', newStatus);
      await onStatusChange(jobId, newStatus);
    }
  };

  const getJobsByStatus = (status: Job['status']) => {
    return jobs.filter(j => j.status === status);
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
              userRole={userRole}
            />
          );
        })}
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeId && activeJob ? (
          <div className="rotate-3 scale-105 opacity-80">
            <JobCard job={activeJob} userRole={userRole} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

interface DroppableColumnProps {
  column: KanbanColumn;
  jobs: Job[];
  activeId: string | null;
  onDelete: (id: string) => void;
  userRole?: string;
}

function DroppableColumn({ column, jobs, activeId, onDelete, userRole }: DroppableColumnProps) {
  const { setNodeRef } = useDroppable({
    id: column.status, // Use status as droppable ID
  });

  return (
    <div className="flex flex-col">
      {/* Column Header */}
      <div className={`flex items-center justify-between rounded-t-xl border border-b-0 border-slate-800/70 ${column.bgColor} px-4 py-3 shadow-lg backdrop-blur`}>
        <div className="flex items-center gap-2">
          <div className={`rounded-full bg-slate-900/60 p-1.5 ${column.color}`}>
            {column.icon}
          </div>
          <h3 className="font-bold text-sm text-slate-50">{column.title}</h3>
        </div>
        <span className={`rounded-full bg-slate-900/80 border border-slate-700 px-2.5 py-1 text-xs font-bold shadow-inner ${column.color}`}>
          {jobs.length}
        </span>
      </div>

      {/* Drop Zone */}
      <div
        ref={setNodeRef}
        className="min-h-[500px] rounded-b-xl border border-slate-800/70 bg-slate-950/60 p-3 space-y-3 backdrop-blur transition-all duration-200 hover:bg-slate-950/80"
      >
        <SortableContext
          items={jobs.map(j => j.id)}
          strategy={verticalListSortingStrategy}
        >
          {jobs.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-xs text-slate-600">
              No jobs
            </div>
          ) : (
            jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onDelete={onDelete}
                userRole={userRole}
                isDragging={job.id === activeId}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}
