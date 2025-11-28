"use client";

import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface SectionHeaderProps {
  icon?: ReactNode;
  overline?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function SectionHeader({
  icon,
  overline,
  title,
  description,
  actions,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-4', className)}>
      <div className="flex items-center gap-3">
        {icon ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-400 shadow-sm">
            {icon}
          </div>
        ) : null}
        <div>
          {overline ? (
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{overline}</p>
          ) : null}
          <h1 className="text-xl font-semibold text-slate-50 md:text-2xl">{title}</h1>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}
