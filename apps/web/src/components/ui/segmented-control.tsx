"use client";

import { cn } from '@/lib/utils';

type SegmentedControlProps = {
  items: { id: string; label: string }[];
  value: string;
  onValueChange: (id: string) => void;
};

export function SegmentedControl({ items, value, onValueChange }: SegmentedControlProps) {
  return (
    <div className="inline-flex rounded-full border border-slate-800 bg-slate-950/70 p-1 shadow-sm backdrop-blur">
      {items.map((item) => {
        const active = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onValueChange(item.id)}
            className={cn(
              'rounded-full px-3 py-1 text-xs transition',
              active
                ? 'bg-sky-500 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-slate-100',
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
