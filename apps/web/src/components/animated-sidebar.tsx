'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  MonitorSmartphone,
  Wrench,
  MessageCircle,
  Megaphone,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  FileText,
  QrCode,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/use-animation';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number | string;
  badgeColor?: string;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
  { label: 'WhatsApp Chat', href: '/chat', icon: <MessageCircle className="h-5 w-5" />, badge: 'Live', badgeColor: 'bg-green-500' },
  { label: 'Registration', href: '/registration', icon: <QrCode className="h-5 w-5" />, badge: 'QR', badgeColor: 'bg-purple-500' },
  { label: 'Customers', href: '/customers', icon: <Users className="h-5 w-5" /> },
  { label: 'Devices', href: '/devices', icon: <MonitorSmartphone className="h-5 w-5" /> },
  { label: 'Jobs', href: '/jobs', icon: <Wrench className="h-5 w-5" />, badge: 'New', badgeColor: 'bg-primary' },
  { label: 'Campaigns', href: '/campaigns', icon: <Megaphone className="h-5 w-5" /> },
  { label: 'Reports', href: '/reports', icon: <BarChart3 className="h-5 w-5" /> },
];

const bottomNavItems: NavItem[] = [
  { label: 'Settings', href: '/settings', icon: <Settings className="h-5 w-5" /> },
  { label: 'Documentation', href: '/docs/roadmap', icon: <FileText className="h-5 w-5" /> },
];

interface AnimatedSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export function AnimatedSidebar({ isCollapsed, onToggle }: AnimatedSidebarProps) {
  const pathname = usePathname();
  const isMobile = useMediaQuery('(max-width: 768px)');

  const sidebarVariants = {
    expanded: { width: 256 },
    collapsed: { width: 72 },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
  };

  return (
    <motion.aside
      className={cn(
        'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-card/50 backdrop-blur-xl',
        isMobile && 'hidden'
      )}
      variants={sidebarVariants}
      animate={isCollapsed ? 'collapsed' : 'expanded'}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Logo Section */}
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-purple-500">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-foreground">SuperApp</span>
            </motion.div>
          )}
        </AnimatePresence>
        
        {isCollapsed && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-purple-500 mx-auto">
            <Zap className="h-5 w-5 text-white" />
          </div>
        )}
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item, index) => (
          <NavLink
            key={item.href}
            item={item}
            isCollapsed={isCollapsed}
            isActive={pathname === item.href}
            index={index}
          />
        ))}
      </nav>

      {/* Bottom Navigation */}
      <div className="border-t border-border px-3 py-4 space-y-1">
        {bottomNavItems.map((item, index) => (
          <NavLink
            key={item.href}
            item={item}
            isCollapsed={isCollapsed}
            isActive={pathname === item.href}
            index={index}
          />
        ))}
      </div>

      {/* Toggle Button */}
      <motion.button
        onClick={onToggle}
        className={cn(
          'absolute -right-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card shadow-md',
          'hover:bg-accent transition-colors'
        )}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        {isCollapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </motion.button>
    </motion.aside>
  );
}

// NavLink Component
interface NavLinkProps {
  item: NavItem;
  isCollapsed: boolean;
  isActive: boolean;
  index: number;
}

function NavLink({ item, isCollapsed, isActive, index }: NavLinkProps) {
  return (
    <Link href={item.href}>
      <motion.div
        className={cn(
          'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        )}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.05 }}
        whileHover={{ x: isCollapsed ? 0 : 4 }}
      >
        {/* Active Indicator */}
        {isActive && (
          <motion.div
            layoutId="activeIndicator"
            className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          />
        )}

        {/* Icon */}
        <span className={cn(isActive && 'text-primary')}>{item.icon}</span>

        {/* Label */}
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="whitespace-nowrap"
            >
              {item.label}
            </motion.span>
          )}
        </AnimatePresence>

        {/* Badge */}
        {item.badge && !isCollapsed && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={cn(
              'ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold text-white',
              item.badgeColor || 'bg-primary'
            )}
          >
            {item.badge}
          </motion.span>
        )}

        {/* Tooltip for collapsed state */}
        {isCollapsed && (
          <div className="absolute left-full ml-2 hidden rounded-md bg-popover px-2 py-1 text-sm text-popover-foreground shadow-lg group-hover:block">
            {item.label}
          </div>
        )}
      </motion.div>
    </Link>
  );
}

// Mobile Sidebar
export function MobileSidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          />

          {/* Sidebar */}
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed left-0 top-0 z-50 h-screen w-72 border-r border-border bg-card md:hidden"
          >
            {/* Logo Section */}
            <div className="flex h-16 items-center justify-between border-b border-border px-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-purple-500">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <span className="font-bold text-foreground">SuperApp</span>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg">
                <ChevronLeft className="h-5 w-5" />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
              {navItems.map((item, index) => (
                <Link key={item.href} href={item.href} onClick={onClose}>
                  <motion.div
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      pathname === item.href
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className={cn('ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold text-white', item.badgeColor || 'bg-primary')}>
                        {item.badge}
                      </span>
                    )}
                  </motion.div>
                </Link>
              ))}
            </nav>

            {/* Bottom Navigation */}
            <div className="border-t border-border px-3 py-4 space-y-1">
              {bottomNavItems.map((item) => (
                <Link key={item.href} href={item.href} onClick={onClose}>
                  <div
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      pathname === item.href
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </div>
                </Link>
              ))}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

