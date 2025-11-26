# WhatsApp Bot POS SuperApp

This repository is now organised as a JavaScript/TypeScript monorepo that hosts the Phase 1
implementation described in `development_roadmap.md`. The legacy Express + SQLite server is still
parked inside `src/` for reference, but the active work happens inside the new `apps/*` workspaces:

- **apps/api** – TypeScript Express server with Prisma, PostgreSQL, and Redis helpers.
- **apps/web** – Next.js App Router client with Tailwind CSS, shadcn/ui primitives, and theming.
- **prisma/** – shared schema + migrations for the Postgres database.
- **docker/** – Dockerfiles and compose stack for Postgres, Redis, API, and Web during local dev.

Refer to `docs/phase1-plan.md` for the current scope of Phase 1 (auth, protected UI shell, Redis
session cache, etc.).

## Getting started

```bash
# install workspace deps
npm install

# copy environment defaults
cp .env.example .env

# generate Prisma client (migrations/seed scripts will arrive later in Phase 1)
npm run prisma:generate

# boot both the API and Web dev servers
npm start   # alias for `npm run dev`
```

The default development ports are:

| Service | Port | Notes |
| ------- | ---- | ----- |
| API     | 4000 | `/health` route already available |
| Web     | 3000 | Next.js App Router skeleton with theme toggle |
| Redis   | 6379 | Provided via `docker-compose.yml` |
| Postgres| 5432 | Provided via `docker-compose.yml` |

You can run each workspace independently when you only need one side running:

```bash
npm run dev:api   # Express/Prisma server only
npm run dev:web   # Next.js app only
```

To spin up the Postgres + Redis services that the API expects, use:

```bash
docker compose up -d postgres redis
```

## Legacy implementation

Everything inside `src/` (and its SQLite migrations + seed scripts) belongs to the previous
monolithic server. Those scripts are no longer invoked by `npm start`. If you still need to inspect
that code while the new stack is being built, run `node src/server.js` manually after installing its
missing dependencies.

A thorough README + ops guide for the refreshed stack will land once the Phase 1 API and frontend
routes are complete.
## Marketing campaigns (Phase 5)

The API now exposes `/api/campaigns` for managing outbound WhatsApp broadcasts plus the
`/api/campaigns/preview` helper to evaluate target filters. The worker enforces anti-ban rules
(daily cap, random delay, business hours, and opt-out tags) while logging each delivery attempt in
Prisma. Use the new Next.js page at `/campaigns` to:

1. Compose templates that support placeholders (`{name}`, `{phone}`, etc.).
2. Build recipient segments by type, tags, recent activity, and manual phone lists.
3. Save drafts, schedule future launches, and start/pause/resume/cancel existing campaigns.
4. Monitor target/sent/failed counts plus the enforcement settings applied to each blast.

Make sure Redis is running before starting the API so that the BullMQ queues powering reminders and
campaign sends remain active.
