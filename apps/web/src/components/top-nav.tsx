"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Home' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/customers', label: 'Customers' },
  { href: '/devices', label: 'Devices' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/campaigns', label: 'Campaigns' },
  { href: '/reports', label: 'Reports' },
  { href: '/settings', label: 'Settings' },
  { href: '/docs/roadmap', label: 'Roadmap' },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-3 text-sm sm:flex">
      {links.map((link) => {
        const isActive = pathname === link.href || pathname?.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`relative px-2 py-1 transition ${
              isActive
                ? 'text-sky-400 after:absolute after:inset-x-2 after:-bottom-[2px] after:h-[2px] after:rounded-full after:bg-sky-500'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
