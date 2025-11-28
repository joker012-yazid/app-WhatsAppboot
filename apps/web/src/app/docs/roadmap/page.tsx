import Link from 'next/link';

export default function RoadmapDocPage() {
  return (
    <article className="relative overflow-hidden rounded-xl border bg-card/80 px-6 py-8 shadow-sm backdrop-blur">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-500/60 to-transparent" />
      <header className="mb-6 space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Docs</p>
        <h1 className="text-2xl font-bold text-slate-50">Development Roadmap</h1>
        <p className="text-sm text-muted-foreground">
          The canonical roadmap lives in <code>development_roadmap.md</code>. This placeholder simply points you back to
          the source of truth.
        </p>
      </header>
      <div className="relative pl-8">
        <span className="absolute left-3 top-0 h-full w-px bg-slate-800" aria-hidden />
        <div className="space-y-6">
          <div className="relative">
            <span className="absolute -left-[22px] mt-1 h-3 w-3 rounded-full bg-sky-500 shadow shadow-sky-500/40" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Foundation</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Align frontend with the master prompt and roadmap source. Iterate based on <code>development_roadmap.md</code>.
            </p>
          </div>
          <div className="relative">
            <span className="absolute -left-[22px] mt-1 h-3 w-3 rounded-full bg-emerald-500 shadow shadow-emerald-500/40" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Core</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Keep API contracts stable while enhancing the immersive dashboard shell across customers, devices, jobs, and reports.
            </p>
          </div>
          <div className="relative">
            <span className="absolute -left-[22px] mt-1 h-3 w-3 rounded-full bg-indigo-500 shadow shadow-indigo-500/40" />
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Next</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Future iterations can render the markdown dynamically and embed live status from delivery pipelines.
            </p>
          </div>
        </div>
      </div>
      <div className="mt-6">
        <Link href="https://github.com/" className="text-sm font-medium text-sky-400 underline" target="_blank">
          Open roadmap reference (placeholder)
        </Link>
      </div>
    </article>
  );
}
