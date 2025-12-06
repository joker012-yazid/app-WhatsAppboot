// Animation variants for Framer Motion
import { Variants } from 'framer-motion';

// Timing presets
export const duration = {
  fast: 0.15,
  normal: 0.3,
  slow: 0.5,
  verySlow: 0.8,
};

// Easing presets
export const easing = {
  easeOut: [0, 0, 0.2, 1],
  easeIn: [0.4, 0, 1, 1],
  easeInOut: [0.4, 0, 0.2, 1],
  spring: [0.68, -0.55, 0.265, 1.55],
  bounce: [0.68, -0.6, 0.32, 1.6],
};

// Page transition variants
export const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  enter: {
    opacity: 1,
    y: 0,
    transition: {
      duration: duration.normal,
      ease: easing.easeOut,
    },
  },
  exit: {
    opacity: 0,
    y: -10,
    transition: {
      duration: duration.fast,
    },
  },
};

// Fade variants
export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: duration.normal },
  },
  exit: { opacity: 0 },
};

// Slide variants
export const slideUpVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  },
  exit: { opacity: 0, y: -20 },
};

export const slideDownVariants: Variants = {
  hidden: { opacity: 0, y: -30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  },
  exit: { opacity: 0, y: 30 },
};

export const slideLeftVariants: Variants = {
  hidden: { opacity: 0, x: 30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  },
  exit: { opacity: 0, x: -30 },
};

export const slideRightVariants: Variants = {
  hidden: { opacity: 0, x: -30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  },
  exit: { opacity: 0, x: 30 },
};

// Scale variants
export const scaleVariants: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 20,
    },
  },
  exit: { opacity: 0, scale: 0.9 },
};

export const popVariants: Variants = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 500,
      damping: 25,
    },
  },
  exit: { opacity: 0, scale: 0.5 },
};

// Stagger container variants
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

export const staggerItem: Variants = {
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

// Card hover effects
export const cardHoverVariants: Variants = {
  rest: {
    scale: 1,
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    transition: { duration: duration.fast },
  },
  hover: {
    scale: 1.02,
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 0 30px -5px rgba(59, 130, 246, 0.3)',
    transition: { duration: duration.fast },
  },
  tap: {
    scale: 0.98,
    transition: { duration: 0.1 },
  },
};

// Button hover effects
export const buttonVariants: Variants = {
  rest: { scale: 1 },
  hover: {
    scale: 1.05,
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 10,
    },
  },
  tap: { scale: 0.95 },
};

// Success animation
export const successVariants: Variants = {
  hidden: { opacity: 0, scale: 0, rotate: -180 },
  visible: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: {
      type: 'spring',
      stiffness: 200,
      damping: 15,
    },
  },
};

// Error shake animation
export const shakeVariants: Variants = {
  shake: {
    x: [0, -10, 10, -10, 10, 0],
    transition: { duration: 0.5 },
  },
};

// Notification slide in
export const notificationVariants: Variants = {
  hidden: { opacity: 0, x: 100, scale: 0.9 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 25,
    },
  },
  exit: {
    opacity: 0,
    x: 100,
    scale: 0.9,
    transition: { duration: duration.fast },
  },
};

// Modal variants
export const modalBackdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

export const modalContentVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 25,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 10,
    transition: { duration: duration.fast },
  },
};

// Loading dots animation
export const loadingDotsVariants: Variants = {
  animate: {
    y: [0, -8, 0],
    transition: {
      duration: 0.6,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// Pulse glow effect
export const pulseGlow: Variants = {
  animate: {
    boxShadow: [
      '0 0 0 0 rgba(59, 130, 246, 0.4)',
      '0 0 0 10px rgba(59, 130, 246, 0)',
      '0 0 0 0 rgba(59, 130, 246, 0)',
    ],
    transition: {
      duration: 2,
      repeat: Infinity,
    },
  },
};

// Sidebar menu item
export const menuItemVariants: Variants = {
  rest: { x: 0 },
  hover: {
    x: 4,
    transition: { type: 'spring', stiffness: 400, damping: 20 },
  },
};

// Number counter animation helper
export const countAnimationConfig = {
  duration: 1.5,
  delay: 0.2,
  separator: ',',
  decimals: 0,
};

