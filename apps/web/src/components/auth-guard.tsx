"use client";

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';

type AuthGuardProps = {
  children: React.ReactNode;
  redirectOnFail?: boolean;
};

export default function AuthGuard({ children, redirectOnFail = true }: AuthGuardProps) {
  const { user, loading, error, status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (redirectOnFail && !loading && (!user || error || status === 'unauthenticated')) {
      const reason = error ? `?reason=${encodeURIComponent(error)}` : '';
      router.replace(`/login${reason}`);
    }
  }, [user, loading, error, router, redirectOnFail, status]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading session...</p>;
  if (!user && redirectOnFail) return null;
  return <>{children}</>;
}
