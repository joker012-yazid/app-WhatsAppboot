'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Search,
  Menu,
  Command,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from './theme-toggle';
import { UserMenu } from './user-menu';
import { AnimatedButton, IconButton } from './ui/animated-button';

interface AnimatedNavbarProps {
  onMenuClick?: () => void;
  onSearchClick?: () => void;
}

export function AnimatedNavbar({ onMenuClick, onSearchClick }: AnimatedNavbarProps) {
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [notifications, setNotifications] = React.useState(3);

  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.header
      className={cn(
        'sticky top-0 z-40 flex h-16 items-center justify-between border-b px-4 transition-all duration-300',
        isScrolled
          ? 'border-border bg-card/80 backdrop-blur-xl shadow-sm'
          : 'border-transparent bg-transparent'
      )}
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Left Section */}
      <div className="flex items-center gap-4">
        {/* Mobile Menu Button */}
        <IconButton
          onClick={onMenuClick}
          className="md:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </IconButton>

        {/* Brand / Page Title */}
        <motion.div
          className="hidden md:flex items-center gap-2"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h1 className="text-lg font-semibold text-foreground">
            WhatsApp Bot POS
          </h1>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            Beta
          </span>
        </motion.div>
      </div>

      {/* Center - Search Bar */}
      <motion.div
        className="hidden flex-1 max-w-md mx-8 md:flex"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <button
          onClick={onSearchClick}
          className="flex w-full items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-2 text-sm text-muted-foreground transition-all hover:border-primary/50 hover:bg-muted"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search anything...</span>
          <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
            <Command className="h-3 w-3" />K
          </kbd>
        </button>
      </motion.div>

      {/* Right Section */}
      <motion.div
        className="flex items-center gap-2"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3 }}
      >
        {/* Mobile Search */}
        <IconButton
          onClick={onSearchClick}
          className="md:hidden"
          aria-label="Search"
        >
          <Search className="h-5 w-5" />
        </IconButton>

        {/* Notifications */}
        <div className="relative">
          <IconButton aria-label="Notifications">
            <Bell className="h-5 w-5" />
            <AnimatePresence>
              {notifications > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white"
                >
                  {notifications > 9 ? '9+' : notifications}
                </motion.span>
              )}
            </AnimatePresence>
          </IconButton>
        </div>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* User Menu */}
        <UserMenu />
      </motion.div>
    </motion.header>
  );
}

// Breadcrumbs Component
interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <motion.nav
      className="flex items-center gap-2 text-sm text-muted-foreground"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span>/</span>}
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: index * 0.1 }}
          >
            {item.href ? (
              <Link
                href={item.href}
                className="hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-foreground font-medium">{item.label}</span>
            )}
          </motion.span>
        </React.Fragment>
      ))}
    </motion.nav>
  );
}

