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
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4">
      <div className="grid w-full max-w-4xl grid-cols-1 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80 shadow-2xl shadow-black/40 backdrop-blur md:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-6 px-8 py-10">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Access</p>
            <h1 className="text-2xl font-semibold text-slate-50 md:text-3xl">Login to Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Enter your credentials to continue managing WhatsApp operations.
            </p>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-input bg-background/80 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/80 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
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
                className="w-full rounded-md border border-input bg-background/80 px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/80 focus-visible:ring-offset-1 focus-visible:ring-offset-slate-950"
                placeholder="********"
                autoComplete="current-password"
                required
              />
            </div>
            {error ? (
              <div className="rounded-md border border-red-500/60 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            ) : null}
            <Button className="w-full" type="submit" disabled={submitting || loading}>
              {submitting ? 'Signing in...' : 'Login'}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            Need help?{' '}
            <Link href="/docs/roadmap" className="font-medium text-sky-400 underline">
              Read the roadmap
            </Link>
            .
          </p>
        </div>
        <div className="relative hidden bg-gradient-to-br from-sky-600/40 via-slate-900 to-emerald-600/40 p-8 md:block">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.25),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.25),transparent_32%)]" />
          <div className="relative flex h-full flex-col justify-between text-slate-50">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-200/80">
                WhatsApp Bot POS SuperApp
              </p>
              <h2 className="text-2xl font-semibold">Always-on command center</h2>
              <ul className="space-y-2 text-sm text-slate-100/80">
                <li>- Monitor WhatsApp tickets in real time.</li>
                <li>- Generate and track AI-assisted quotes.</li>
                <li>- Orchestrate device repairs and campaigns safely.</li>
              </ul>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 shadow-xl backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-200/80">Snapshot</p>
              <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-slate-300/80">Active Jobs</p>
                  <p className="text-lg font-semibold">42</p>
                </div>
                <div>
                  <p className="text-slate-300/80">Unread</p>
                  <p className="text-lg font-semibold">8</p>
                </div>
                <div>
                  <p className="text-slate-300/80">Devices</p>
                  <p className="text-lg font-semibold">129</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
