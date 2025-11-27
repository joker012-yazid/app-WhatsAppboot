"use client";

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/toast-provider';

export default function LoginPage() {
  const { login, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('admin123');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    const reason = searchParams.get('reason');
    if (reason) {
      setError(reason);
    }
  }, [searchParams]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      toast.success('Welcome back');
      router.replace('/');
    } catch (err: any) {
      const msg = err?.message || 'Login failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-8">
      <div className="space-y-2 text-center">
        <p className="text-sm uppercase tracking-[0.35em] text-muted-foreground">Access</p>
        <h1 className="text-[2.25rem] font-semibold">Login to dashboard</h1>
        <p className="text-muted-foreground">Enter your credentials to continue.</p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border bg-card px-6 py-6 shadow-sm">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="admin@example.com"
            autoComplete="username"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="********"
            autoComplete="current-password"
            required
          />
        </div>
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
        <Button className="w-full" type="submit" disabled={submitting || loading}>
          {submitting ? 'Signing in…' : 'Login'}
        </Button>
      </form>
      <p className="text-center text-xs text-muted-foreground">
        Need help? <Link href="/docs/roadmap" className="underline">Read the roadmap</Link>.
      </p>
    </div>
  );
}
