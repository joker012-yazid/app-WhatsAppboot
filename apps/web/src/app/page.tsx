import Link from 'next/link';

import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <section className="space-y-6 rounded-xl border bg-card px-6 py-8 shadow-sm">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.35em] text-muted-foreground">Foundation</p>
        <h1 className="text-3xl font-bold">Developer Control Room</h1>
        <p className="text-muted-foreground">
          Next.js + Node.js stack is ready. Continue with authentication flow and the rest of Phase 1 tasks.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/login">Go to Login</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/docs/roadmap">View Roadmap</Link>
        </Button>
      </div>
    </section>
  );
}
