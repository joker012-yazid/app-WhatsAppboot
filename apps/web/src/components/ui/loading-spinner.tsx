'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'primary' | 'gradient';
  className?: string;
}

const sizes = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
};

const strokeWidths = {
  sm: 3,
  md: 3,
  lg: 2.5,
  xl: 2,
};

export function LoadingSpinner({
  size = 'md',
  variant = 'default',
  className,
}: LoadingSpinnerProps) {
  const strokeWidth = strokeWidths[size];
  
  if (variant === 'gradient') {
    return (
      <div className={cn(sizes[size], 'relative', className)}>
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'conic-gradient(from 0deg, hsl(var(--primary)), hsl(258 90% 66%), hsl(var(--primary)))',
            mask: `radial-gradient(farthest-side, transparent calc(100% - ${strokeWidth}px), black calc(100% - ${strokeWidth}px))`,
            WebkitMask: `radial-gradient(farthest-side, transparent calc(100% - ${strokeWidth}px), black calc(100% - ${strokeWidth}px))`,
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  return (
    <svg
      className={cn(sizes[size], 'animate-spin', className)}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className={cn(
          'opacity-25',
          variant === 'primary' ? 'stroke-primary' : 'stroke-current'
        )}
        cx="12"
        cy="12"
        r="10"
        strokeWidth={strokeWidth}
      />
      <path
        className={cn(
          'opacity-75',
          variant === 'primary' ? 'stroke-primary' : 'stroke-current'
        )}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        fill="currentColor"
      />
    </svg>
  );
}

// Full page loading overlay
export function LoadingOverlay({
  message = 'Loading...',
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <motion.div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm',
        className
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="flex flex-col items-center gap-4"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <LoadingSpinner size="xl" variant="gradient" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </motion.div>
    </motion.div>
  );
}

// Inline loading indicator
export function LoadingInline({
  text = 'Loading',
  className,
}: {
  text?: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
      <LoadingSpinner size="sm" />
      <span>{text}</span>
    </div>
  );
}

// Skeleton pulse loader (alternative to spinner)
export function LoadingPulse({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="h-2 w-2 rounded-full bg-primary"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.2,
          }}
        />
      ))}
    </div>
  );
}

