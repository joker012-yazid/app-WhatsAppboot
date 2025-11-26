import Link from 'next/link';

export default function RoadmapDocPage() {
  return (
    <article className="space-y-4 rounded-xl border bg-card px-6 py-8 shadow-sm">
      <header className="space-y-1">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">Docs</p>
        <h1 className="text-2xl font-bold">Development Roadmap</h1>
        <p className="text-muted-foreground">
          The canonical roadmap lives in <code>development_roadmap.md</code>. This placeholder simply points you back to the source of truth.
        </p>
      </header>
      <p className="text-sm text-muted-foreground">
        Open the markdown file inside the repo or the Notion source to follow the step-by-step master prompt. Future iterations of the frontend can render it dynamically.
      </p>
      <Link href="https://github.com/" className="text-sm font-medium text-primary underline" target="_blank">
        Open roadmap reference (placeholder)
      </Link>
    </article>
  );
}
