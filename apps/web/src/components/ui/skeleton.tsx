'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'circular' | 'rectangular';
  animation?: 'shimmer' | 'pulse' | 'none';
}

export function Skeleton({
  className,
  variant = 'default',
  animation = 'shimmer',
  ...props
}: SkeletonProps) {
  const variantClasses = {
    default: 'rounded-md',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
  };

  const animationClasses = {
    shimmer: 'animate-shimmer bg-gradient-to-r from-muted via-muted-foreground/5 to-muted bg-[length:200%_100%]',
    pulse: 'animate-pulse bg-muted',
    none: 'bg-muted',
  };

  return (
    <div
      className={cn(
        variantClasses[variant],
        animationClasses[animation],
        className
      )}
      {...props}
    />
  );
}

// Pre-built skeleton components for common use cases
export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center space-x-4">
        <Skeleton className="h-12 w-12" variant="circular" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-20 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  );
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4 p-4 rounded-lg border border-border">
          <Skeleton className="h-10 w-10" variant="circular" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-full max-w-[250px]" />
            <Skeleton className="h-3 w-full max-w-[200px]" />
          </div>
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex gap-4 p-4 border-b border-border">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-4 p-4 border-b border-border">
          {Array.from({ length: cols }).map((_, colIdx) => (
            <Skeleton key={colIdx} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonStats() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-6 space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      
      {/* Stats Grid */}
      <SkeletonStats />
      
      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SkeletonCard />
        </div>
        <div>
          <SkeletonList count={4} />
        </div>
      </div>
    </div>
  );
}

