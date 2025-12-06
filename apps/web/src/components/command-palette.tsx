'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Command } from 'cmdk';
import {
  LayoutDashboard,
  Users,
  MonitorSmartphone,
  Wrench,
  MessageSquare,
  Megaphone,
  BarChart3,
  Settings,
  FileText,
  Search,
  Plus,
  Moon,
  Sun,
  LogOut,
  User,
  Bell,
  Zap,
  ArrowRight,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CommandItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
  group: string;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const { setTheme, theme } = useTheme();
  const { logout, user } = useAuth();
  const [search, setSearch] = React.useState('');

  // Close on escape
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onOpenChange]);

  const navigate = (path: string) => {
    router.push(path);
    onOpenChange(false);
  };

  const commands: CommandItem[] = [
    // Navigation
    {
      id: 'dashboard',
      label: 'Go to Dashboard',
      icon: <LayoutDashboard className="h-4 w-4" />,
      shortcut: 'G D',
      action: () => navigate('/dashboard'),
      group: 'Navigation',
    },
    {
      id: 'chat',
      label: 'WhatsApp Chat',
      icon: <MessageSquare className="h-4 w-4" />,
      shortcut: 'G W',
      action: () => navigate('/chat'),
      group: 'Navigation',
    },
    {
      id: 'customers',
      label: 'View Customers',
      icon: <Users className="h-4 w-4" />,
      shortcut: 'G C',
      action: () => navigate('/customers'),
      group: 'Navigation',
    },
    {
      id: 'devices',
      label: 'View Devices',
      icon: <MonitorSmartphone className="h-4 w-4" />,
      shortcut: 'G V',
      action: () => navigate('/devices'),
      group: 'Navigation',
    },
    {
      id: 'jobs',
      label: 'View Jobs',
      icon: <Wrench className="h-4 w-4" />,
      shortcut: 'G J',
      action: () => navigate('/jobs'),
      group: 'Navigation',
    },
    {
      id: 'tickets',
      label: 'View Tickets',
      icon: <MessageSquare className="h-4 w-4" />,
      shortcut: 'G T',
      action: () => navigate('/tickets'),
      group: 'Navigation',
    },
    {
      id: 'campaigns',
      label: 'View Campaigns',
      icon: <Megaphone className="h-4 w-4" />,
      action: () => navigate('/campaigns'),
      group: 'Navigation',
    },
    {
      id: 'reports',
      label: 'View Reports',
      icon: <BarChart3 className="h-4 w-4" />,
      action: () => navigate('/reports'),
      group: 'Navigation',
    },
    {
      id: 'settings',
      label: 'Open Settings',
      icon: <Settings className="h-4 w-4" />,
      shortcut: ',',
      action: () => navigate('/settings'),
      group: 'Navigation',
    },

    // Quick Actions
    {
      id: 'new-customer',
      label: 'Add New Customer',
      icon: <Plus className="h-4 w-4" />,
      action: () => navigate('/customers?action=new'),
      group: 'Quick Actions',
    },
    {
      id: 'new-job',
      label: 'Create New Job',
      icon: <Plus className="h-4 w-4" />,
      action: () => navigate('/jobs?action=new'),
      group: 'Quick Actions',
    },
    {
      id: 'new-device',
      label: 'Add New Device',
      icon: <Plus className="h-4 w-4" />,
      action: () => navigate('/devices?action=new'),
      group: 'Quick Actions',
    },

    // Theme
    {
      id: 'theme-light',
      label: 'Switch to Light Mode',
      icon: <Sun className="h-4 w-4" />,
      action: () => {
        setTheme('light');
        onOpenChange(false);
      },
      group: 'Theme',
    },
    {
      id: 'theme-dark',
      label: 'Switch to Dark Mode',
      icon: <Moon className="h-4 w-4" />,
      action: () => {
        setTheme('dark');
        onOpenChange(false);
      },
      group: 'Theme',
    },

    // Account
    {
      id: 'profile',
      label: 'View Profile',
      icon: <User className="h-4 w-4" />,
      action: () => navigate('/settings?tab=profile'),
      group: 'Account',
    },
    {
      id: 'notifications',
      label: 'Notification Settings',
      icon: <Bell className="h-4 w-4" />,
      action: () => navigate('/settings?tab=notifications'),
      group: 'Account',
    },
    {
      id: 'logout',
      label: 'Sign Out',
      icon: <LogOut className="h-4 w-4" />,
      action: () => {
        logout();
        onOpenChange(false);
      },
      group: 'Account',
    },

    // Help
    {
      id: 'docs',
      label: 'Documentation',
      icon: <FileText className="h-4 w-4" />,
      action: () => navigate('/docs/roadmap'),
      group: 'Help',
    },
  ];

  const groups = [...new Set(commands.map((c) => c.group))];

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Command Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2"
          >
            <Command
              className={cn(
                'rounded-xl border border-border bg-card shadow-2xl overflow-hidden',
                '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider'
              )}
            >
              {/* Search Input */}
              <div className="flex items-center border-b border-border px-4 py-3">
                <Search className="h-5 w-5 text-muted-foreground mr-3" />
                <Command.Input
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Type a command or search..."
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                />
                <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                  ESC
                </kbd>
              </div>

              {/* Commands List */}
              <Command.List className="max-h-80 overflow-y-auto p-2">
                <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                  No results found.
                </Command.Empty>

                {groups.map((group) => (
                  <Command.Group key={group} heading={group}>
                    {commands
                      .filter((c) => c.group === group)
                      .map((command) => (
                        <Command.Item
                          key={command.id}
                          value={command.label}
                          onSelect={command.action}
                          className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm cursor-pointer',
                            'text-foreground transition-colors',
                            'aria-selected:bg-accent aria-selected:text-accent-foreground',
                            'hover:bg-accent/50'
                          )}
                        >
                          <span className="text-muted-foreground">{command.icon}</span>
                          <span className="flex-1">{command.label}</span>
                          {command.shortcut && (
                            <kbd className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                              {command.shortcut.split(' ').map((key, i) => (
                                <span
                                  key={i}
                                  className="rounded border border-border bg-muted px-1.5 py-0.5"
                                >
                                  {key}
                                </span>
                              ))}
                            </kbd>
                          )}
                          <ArrowRight className="h-3 w-3 text-muted-foreground opacity-0 group-aria-selected:opacity-100 transition-opacity" />
                        </Command.Item>
                      ))}
                  </Command.Group>
                ))}
              </Command.List>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Zap className="h-3 w-3 text-primary" />
                  <span>Quick actions at your fingertips</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>Navigate</span>
                  <kbd className="rounded border border-border bg-muted px-1">↑↓</kbd>
                  <span>Select</span>
                  <kbd className="rounded border border-border bg-muted px-1">↵</kbd>
                </div>
              </div>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Hook to use command palette
export function useCommandPalette() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { open, setOpen };
}

