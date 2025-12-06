'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import AuthGuard from '@/components/auth-guard';
import { AnimatedSidebar, MobileSidebar } from '@/components/animated-sidebar';
import { AnimatedNavbar } from '@/components/animated-navbar';
import { CommandPalette, useCommandPalette } from '@/components/command-palette';
import { useMediaQuery } from '@/hooks/use-animation';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const { open: commandOpen, setOpen: setCommandOpen } = useCommandPalette();
  const isMobile = useMediaQuery('(max-width: 768px)');

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        {/* Desktop Sidebar */}
        <AnimatedSidebar
          isCollapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Mobile Sidebar */}
        <MobileSidebar
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
        />

        {/* Main Content Area */}
        <motion.div
          className="flex flex-col min-h-screen"
          animate={{
            marginLeft: isMobile ? 0 : sidebarCollapsed ? 72 : 256,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          {/* Top Navigation */}
          <AnimatedNavbar
            onMenuClick={() => setMobileMenuOpen(true)}
            onSearchClick={() => setCommandOpen(true)}
          />

          {/* Page Content */}
          <main className="flex-1 p-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              {children}
            </motion.div>
          </main>
        </motion.div>

        {/* Command Palette */}
        <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      </div>
    </AuthGuard>
  );
}

