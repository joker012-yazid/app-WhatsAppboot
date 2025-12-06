'use client';

import * as React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AnimatedCardProps extends HTMLMotionProps<'div'> {
  variant?: 'default' | 'glass' | 'gradient' | 'glow';
  hoverEffect?: 'lift' | 'scale' | 'glow' | 'none';
  children: React.ReactNode;
}

const cardVariants = {
  default: 'bg-card border border-border',
  glass: 'glass',
  gradient: 'gradient-border bg-card',
  glow: 'bg-card border border-border hover-glow',
};

const hoverVariants = {
  lift: {
    rest: { y: 0, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' },
    hover: { 
      y: -4, 
      boxShadow: '0 20px 40px -15px hsl(var(--primary) / 0.2)',
      transition: { duration: 0.2, ease: 'easeOut' }
    },
  },
  scale: {
    rest: { scale: 1 },
    hover: { 
      scale: 1.02,
      transition: { duration: 0.2, ease: 'easeOut' }
    },
  },
  glow: {
    rest: { boxShadow: '0 0 0 0 hsl(var(--primary) / 0)' },
    hover: { 
      boxShadow: '0 0 30px hsl(var(--primary) / 0.3)',
      transition: { duration: 0.3 }
    },
  },
  none: {
    rest: {},
    hover: {},
  },
};

export const AnimatedCard = React.forwardRef<HTMLDivElement, AnimatedCardProps>(
  ({ className, variant = 'default', hoverEffect = 'lift', children, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        className={cn(
          'rounded-xl p-6 transition-colors',
          cardVariants[variant],
          className
        )}
        initial="rest"
        whileHover="hover"
        variants={hoverVariants[hoverEffect]}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

AnimatedCard.displayName = 'AnimatedCard';

// Card Header
export const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 pb-4', className)}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

// Card Title
export const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

// Card Description
export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

// Card Content
export const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

// Card Footer
export const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center pt-4', className)}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

