'use client';

import * as React from 'react';
import { motion, AnimatePresence, Variants, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

// ===================================
// FADE IN
// ===================================

interface FadeInProps extends HTMLMotionProps<'div'> {
  delay?: number;
  duration?: number;
  children: React.ReactNode;
}

export function FadeIn({
  children,
  delay = 0,
  duration = 0.3,
  className,
  ...props
}: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration, delay, ease: 'easeOut' }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ===================================
// SLIDE IN
// ===================================

type SlideDirection = 'up' | 'down' | 'left' | 'right';

interface SlideInProps extends HTMLMotionProps<'div'> {
  direction?: SlideDirection;
  delay?: number;
  duration?: number;
  distance?: number;
  children: React.ReactNode;
}

const slideDirections = {
  up: { y: 30, x: 0 },
  down: { y: -30, x: 0 },
  left: { x: 30, y: 0 },
  right: { x: -30, y: 0 },
};

export function SlideIn({
  children,
  direction = 'up',
  delay = 0,
  duration = 0.4,
  distance,
  className,
  ...props
}: SlideInProps) {
  const offset = slideDirections[direction];
  const initialOffset = distance
    ? { x: offset.x ? (offset.x > 0 ? distance : -distance) : 0, y: offset.y ? (offset.y > 0 ? distance : -distance) : 0 }
    : offset;

  return (
    <motion.div
      initial={{ opacity: 0, ...initialOffset }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, ...initialOffset }}
      transition={{
        duration,
        delay,
        type: 'spring',
        stiffness: 300,
        damping: 24,
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ===================================
// SCALE IN
// ===================================

interface ScaleInProps extends HTMLMotionProps<'div'> {
  delay?: number;
  duration?: number;
  initialScale?: number;
  children: React.ReactNode;
}

export function ScaleIn({
  children,
  delay = 0,
  duration = 0.3,
  initialScale = 0.9,
  className,
  ...props
}: ScaleInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: initialScale }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: initialScale }}
      transition={{
        duration,
        delay,
        type: 'spring',
        stiffness: 300,
        damping: 20,
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ===================================
// POP IN (Bouncy scale)
// ===================================

interface PopInProps extends HTMLMotionProps<'div'> {
  delay?: number;
  children: React.ReactNode;
}

export function PopIn({ children, delay = 0, className, ...props }: PopInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5 }}
      transition={{
        delay,
        type: 'spring',
        stiffness: 500,
        damping: 25,
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ===================================
// STAGGER CONTAINER
// ===================================

interface StaggerContainerProps extends HTMLMotionProps<'div'> {
  staggerDelay?: number;
  delayChildren?: number;
  children: React.ReactNode;
}

export function StaggerContainer({
  children,
  staggerDelay = 0.1,
  delayChildren = 0,
  className,
  ...props
}: StaggerContainerProps) {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren,
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ===================================
// STAGGER ITEM
// ===================================

interface StaggerItemProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
}

export function StaggerItem({ children, className, ...props }: StaggerItemProps) {
  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 24,
      },
    },
  };

  return (
    <motion.div variants={itemVariants} className={className} {...props}>
      {children}
    </motion.div>
  );
}

// ===================================
// PAGE TRANSITION
// ===================================

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{
        duration: 0.3,
        ease: [0, 0, 0.2, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ===================================
// HOVER SCALE
// ===================================

interface HoverScaleProps extends HTMLMotionProps<'div'> {
  scale?: number;
  children: React.ReactNode;
}

export function HoverScale({
  children,
  scale = 1.02,
  className,
  ...props
}: HoverScaleProps) {
  return (
    <motion.div
      whileHover={{ scale }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ===================================
// REVEAL ON SCROLL
// ===================================

interface RevealOnScrollProps extends HTMLMotionProps<'div'> {
  direction?: SlideDirection;
  delay?: number;
  children: React.ReactNode;
}

export function RevealOnScroll({
  children,
  direction = 'up',
  delay = 0,
  className,
  ...props
}: RevealOnScrollProps) {
  const offset = slideDirections[direction];

  return (
    <motion.div
      initial={{ opacity: 0, ...offset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{
        delay,
        duration: 0.5,
        type: 'spring',
        stiffness: 100,
        damping: 15,
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// ===================================
// ANIMATED LIST
// ===================================

interface AnimatedListProps {
  items: React.ReactNode[];
  className?: string;
  itemClassName?: string;
  staggerDelay?: number;
}

export function AnimatedList({
  items,
  className,
  itemClassName,
  staggerDelay = 0.1,
}: AnimatedListProps) {
  return (
    <StaggerContainer staggerDelay={staggerDelay} className={className}>
      {items.map((item, index) => (
        <StaggerItem key={index} className={itemClassName}>
          {item}
        </StaggerItem>
      ))}
    </StaggerContainer>
  );
}

// ===================================
// PRESENCE WRAPPER
// ===================================

interface PresenceProps {
  children: React.ReactNode;
  show: boolean;
  mode?: 'sync' | 'wait' | 'popLayout';
}

export function Presence({ children, show, mode = 'sync' }: PresenceProps) {
  return (
    <AnimatePresence mode={mode}>
      {show && children}
    </AnimatePresence>
  );
}

// ===================================
// LOADING DOTS
// ===================================

export function LoadingDots({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="h-2 w-2 rounded-full bg-current"
          animate={{ y: [-4, 0, -4] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// ===================================
// SUCCESS CHECKMARK
// ===================================

export function SuccessCheckmark({ className }: { className?: string }) {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      className={cn('h-6 w-6', className)}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <motion.circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      />
      <motion.path
        d="M8 12l2 2 4-4"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.3, delay: 0.6 }}
      />
    </motion.svg>
  );
}

