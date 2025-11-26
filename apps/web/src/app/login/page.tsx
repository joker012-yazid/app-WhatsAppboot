import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function LoginPage() {
  return (
    <div className="mx-auto w-full max-w-md space-y-8">
      <div className="space-y-2 text-center">
        <p className="text-sm uppercase tracking-[0.35em] text-muted-foreground">Access</p>
        <h1 className="text-[2.25rem] font-semibold">Login to dashboard</h1>
        <p className="text-muted-foreground">
          Authentication wiring will be completed in the next step. UI is ready for integration.
        </p>
      </div>
      <div className="space-y-4 rounded-xl border bg-card px-6 py-6 shadow-sm">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="admin@example.com"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="********"
          />
        </div>
        <Button className="w-full" disabled>
          Login (coming soon)
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Need help? <Link href="/docs/phase-1" className="underline">Read the onboarding notes</Link>.
      </p>
    </div>
  );
}
