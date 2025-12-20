'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  User,
  Settings,
  LogOut,
  ChevronDown,
  Shield,
} from 'lucide-react';

import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

export function UserMenu() {
  const { user, loading, logout } = useAuth();
  const [isOpen, setIsOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
      >
        Login
      </Link>
    );
  }

  const initials = user.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : user.email?.slice(0, 2).toUpperCase() || 'U';

  const handleLogout = async () => {
          try {
            await logout();
      toast.success('Logged out successfully');
          } catch (e: any) {
            toast.error(e?.message || 'Logout failed');
          }
  };

  return (
    <div className="relative" ref={menuRef}>
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 transition-all',
          'hover:bg-accent hover:border-primary/50',
          isOpen && 'border-primary bg-accent'
        )}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {/* Avatar */}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-purple-500 text-xs font-bold text-white">
          {initials}
        </div>

        {/* User Info */}
        <div className="hidden sm:block text-left">
          <p className="text-sm font-medium text-foreground leading-tight">
            {user.name || 'User'}
          </p>
          <p className="text-[10px] text-muted-foreground leading-tight">
            {user.role}
          </p>
        </div>

        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform hidden sm:block',
            isOpen && 'rotate-180'
          )}
        />
      </motion.button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-border bg-card shadow-lg"
          >
            {/* Header */}
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-medium text-foreground">{user.name || user.email}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>

            {/* Menu Items */}
            <div className="p-1.5">
              <MenuItem
                icon={<User className="h-4 w-4" />}
                label="Profile"
                href="/settings?tab=profile"
                onClick={() => setIsOpen(false)}
              />
              <MenuItem
                icon={<Settings className="h-4 w-4" />}
                label="Settings"
                href="/settings"
                onClick={() => setIsOpen(false)}
              />
              {user.role === 'ADMIN' && (
                <MenuItem
                  icon={<Shield className="h-4 w-4" />}
                  label="Admin Panel"
                  href="/settings?tab=users"
                  onClick={() => setIsOpen(false)}
                />
              )}
            </div>

            {/* Logout */}
            <div className="border-t border-border p-1.5">
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Menu Item Component
function MenuItem({
  icon,
  label,
  href,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
    >
      <span className="text-muted-foreground">{icon}</span>
      {label}
    </Link>
  );
}
