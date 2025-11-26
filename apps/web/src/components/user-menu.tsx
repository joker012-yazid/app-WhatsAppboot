"use client";

import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';

export function UserMenu() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return <span className="text-sm text-muted-foreground">Loading…</span>;
  }

  if (!user) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link href="/login">Login</Link>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground hidden sm:inline">{user.email}</span>
      <Button variant="outline" size="sm" onClick={logout}>
        Logout
      </Button>
    </div>
  );
}

