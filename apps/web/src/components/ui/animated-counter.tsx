'use client';

import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { motion, useSpring, useTransform, useInView } from 'framer-motion';
import { cn } from '@/lib/utils';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  delay?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  separator?: string;
  className?: string;
  triggerOnView?: boolean;
  formatFn?: (value: number) => string;
}

export function AnimatedCounter({
  value,
  duration = 1.5,
  delay = 0,
  prefix = '',
  suffix = '',
  decimals = 0,
  separator = ',',
  className,
  triggerOnView = true,
  formatFn,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '0px 0px -100px 0px' });
  const [hasAnimated, setHasAnimated] = useState(!triggerOnView);

  const springValue = useSpring(0, {
    duration: duration * 1000,
    bounce: 0,
  });

  const displayValue = useTransform(springValue, (latest) => {
    if (formatFn) {
      return formatFn(latest);
    }
    
    const fixedValue = latest.toFixed(decimals);
    const [intPart, decimalPart] = fixedValue.split('.');
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
    
    return decimals > 0 ? `${formattedInt}.${decimalPart}` : formattedInt;
  });

  useEffect(() => {
    if (triggerOnView && isInView && !hasAnimated) {
      const timer = setTimeout(() => {
        springValue.set(value);
        setHasAnimated(true);
      }, delay * 1000);
      return () => clearTimeout(timer);
    } else if (!triggerOnView) {
      const timer = setTimeout(() => {
        springValue.set(value);
      }, delay * 1000);
      return () => clearTimeout(timer);
    }
  }, [isInView, value, springValue, delay, triggerOnView, hasAnimated]);

  // Update value when it changes (after initial animation)
  useEffect(() => {
    if (hasAnimated) {
      springValue.set(value);
    }
  }, [value, hasAnimated, springValue]);

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {prefix}
      <motion.span>{displayValue}</motion.span>
      {suffix}
    </span>
  );
}

// Currency Counter
export function CurrencyCounter({
  value,
  currency = 'MYR',
  locale = 'en-MY',
  ...props
}: Omit<AnimatedCounterProps, 'formatFn'> & {
  currency?: string;
  locale?: string;
}) {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);
  };

  return <AnimatedCounter value={value} formatFn={formatCurrency} {...props} />;
}

// Percentage Counter
export function PercentageCounter({
  value,
  ...props
}: Omit<AnimatedCounterProps, 'suffix' | 'decimals'> & {
  decimals?: number;
}) {
  return <AnimatedCounter value={value} suffix="%" decimals={props.decimals ?? 1} {...props} />;
}

// Compact Counter (K, M, B)
export function CompactCounter({
  value,
  ...props
}: Omit<AnimatedCounterProps, 'formatFn'>) {
  const formatCompact = (val: number) => {
    if (val >= 1_000_000_000) {
      return `${(val / 1_000_000_000).toFixed(1)}B`;
    }
    if (val >= 1_000_000) {
      return `${(val / 1_000_000).toFixed(1)}M`;
    }
    if (val >= 1_000) {
      return `${(val / 1_000).toFixed(1)}K`;
    }
    return val.toFixed(0);
  };

  return <AnimatedCounter value={value} formatFn={formatCompact} {...props} />;
}

