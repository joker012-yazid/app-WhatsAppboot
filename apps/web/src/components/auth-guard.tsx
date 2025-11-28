"use client";

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, error } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || error)) {
      const reason = error ? `?reason=${encodeURIComponent(error)}` : '';
      router.replace(`/login${reason}`);
    }
  }, [user, loading, error, router]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading session...</p>;
  if (!user) return null;
  return <>{children}</>;
}

