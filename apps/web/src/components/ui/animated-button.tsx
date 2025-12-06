'use client';

import * as React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'relative inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 overflow-hidden',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-primary/40',
        destructive: 'bg-destructive text-destructive-foreground shadow-lg shadow-destructive/25 hover:shadow-destructive/40',
        outline: 'border border-input bg-transparent hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        gradient: 'bg-gradient-to-r from-primary to-purple-500 text-white shadow-lg hover:shadow-xl hover:shadow-primary/30',
        glow: 'bg-primary text-primary-foreground shadow-glow hover:shadow-glow-lg',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3 text-xs',
        lg: 'h-12 rounded-lg px-8 text-base',
        xl: 'h-14 rounded-xl px-10 text-lg',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface AnimatedButtonProps
  extends Omit<HTMLMotionProps<'button'>, 'children'>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children?: React.ReactNode;
}

const MotionSlot = motion(Slot);

export const AnimatedButton = React.forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      loadingText,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;
    
    const content = (
      <>
        {/* Ripple effect layer */}
        <span className="absolute inset-0 overflow-hidden rounded-[inherit]">
          <span className="absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 bg-white/20 group-active:opacity-100" />
        </span>
        
        {/* Content */}
        <span className="relative flex items-center gap-2">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {loadingText || children}
            </>
          ) : (
            <>
              {leftIcon}
              {children}
              {rightIcon}
            </>
          )}
        </span>
      </>
    );

    if (asChild) {
      return (
        <MotionSlot
          className={cn(buttonVariants({ variant, size, className }), 'group')}
          ref={ref}
          whileHover={{ scale: isDisabled ? 1 : 1.02 }}
          whileTap={{ scale: isDisabled ? 1 : 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          {...props}
        >
          {content}
        </MotionSlot>
      );
    }

    return (
      <motion.button
        className={cn(buttonVariants({ variant, size, className }), 'group')}
        ref={ref}
        disabled={isDisabled}
        whileHover={{ scale: isDisabled ? 1 : 1.02 }}
        whileTap={{ scale: isDisabled ? 1 : 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
        {...props}
      >
        {content}
      </motion.button>
    );
  }
);

AnimatedButton.displayName = 'AnimatedButton';

// Icon Button variant
export const IconButton = React.forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  ({ className, children, ...props }, ref) => (
    <AnimatedButton
      ref={ref}
      size="icon"
      variant="ghost"
      className={cn('rounded-full', className)}
      {...props}
    >
      {children}
    </AnimatedButton>
  )
);

IconButton.displayName = 'IconButton';

