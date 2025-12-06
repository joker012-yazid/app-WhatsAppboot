'use client';

import { useEffect, useState, useRef, RefObject } from 'react';
import { useReducedMotion, useInView as useFramerInView } from 'framer-motion';

// Hook to detect if element is in viewport
export function useInView<T extends HTMLElement = HTMLDivElement>(
  options?: IntersectionObserverInit
): [RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          // Unobserve after first intersection (trigger once)
          observer.unobserve(element);
        }
      },
      { threshold: 0.1, ...options }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [options]);

  return [ref, isInView];
}

// Hook for hover state
export function useHover<T extends HTMLElement = HTMLDivElement>(): [
  RefObject<T>,
  boolean
] {
  const ref = useRef<T>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleMouseEnter = () => setIsHovered(true);
    const handleMouseLeave = () => setIsHovered(false);

    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return [ref, isHovered];
}

// Hook for delayed value (debounce effect)
export function useDelayedValue<T>(value: T, delay: number = 300): T {
  const [delayedValue, setDelayedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDelayedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return delayedValue;
}

// Hook for animated counter
export function useAnimatedCounter(
  targetValue: number,
  duration: number = 1500,
  startOnMount: boolean = true
): number {
  const [currentValue, setCurrentValue] = useState(0);
  const [shouldStart, setShouldStart] = useState(startOnMount);

  useEffect(() => {
    if (!shouldStart) return;

    const startTime = Date.now();
    const startValue = currentValue;

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const newValue = startValue + (targetValue - startValue) * easeOut;
      
      setCurrentValue(newValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [targetValue, duration, shouldStart]);

  return Math.round(currentValue);
}

// Hook for typing effect
export function useTypingEffect(
  text: string,
  speed: number = 50,
  startDelay: number = 0
): string {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    setDisplayedText('');
    setIsTyping(true);

    const startTimeout = setTimeout(() => {
      let currentIndex = 0;

      const interval = setInterval(() => {
        if (currentIndex < text.length) {
          setDisplayedText(text.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          setIsTyping(false);
          clearInterval(interval);
        }
      }, speed);

      return () => clearInterval(interval);
    }, startDelay);

    return () => clearTimeout(startTimeout);
  }, [text, speed, startDelay]);

  return displayedText;
}

// Hook to check if user prefers reduced motion
export function usePreferredMotion(): boolean {
  const prefersReducedMotion = useReducedMotion();
  return !prefersReducedMotion;
}

// Hook for scroll progress
export function useScrollProgress(): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrollProgress = docHeight > 0 ? scrollTop / docHeight : 0;
      setProgress(scrollProgress);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return progress;
}

// Hook for element visibility with threshold
export function useVisibility<T extends HTMLElement = HTMLDivElement>(
  threshold: number = 0.5
): [RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [visibility, setVisibility] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisibility(entry.intersectionRatio);
      },
      { threshold: Array.from({ length: 11 }, (_, i) => i / 10) }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, visibility];
}

// Hook for keyboard shortcuts
export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  modifiers: { ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean } = {}
): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const { ctrl = false, shift = false, alt = false, meta = false } = modifiers;

      const matchesKey = event.key.toLowerCase() === key.toLowerCase();
      const matchesCtrl = ctrl ? event.ctrlKey : !event.ctrlKey;
      const matchesShift = shift ? event.shiftKey : !event.shiftKey;
      const matchesAlt = alt ? event.altKey : !event.altKey;
      const matchesMeta = meta ? event.metaKey : !event.metaKey;

      if (matchesKey && matchesCtrl && matchesShift && matchesAlt && matchesMeta) {
        event.preventDefault();
        callback();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [key, callback, modifiers]);
}

// Hook for window size
export function useWindowSize(): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const handleResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return size;
}

// Hook for media query
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

