# Phase 1 Foundation Plan

## Scope
- Re-architect project into dual apps: Next.js frontend + Node.js API (TypeScript) backed by PostgreSQL via Prisma.
- Provide Docker Compose stack (api, web, postgres, redis) for local dev parity.
- Implement authentication baseline with JWT access+refresh tokens and Redis-backed session store.
- Deliver starter UI: layout shell with sidebar, login page, dashboard skeleton, theme toggle, and protected route utilities.

## Repository Layout
```
app-WhatsAppboot/
+- apps/
¦  +- api/        # Express/Fastify API in TypeScript + Prisma client
¦  +- web/        # Next.js 14 App Router frontend
+- prisma/
¦  +- schema.prisma
+- docker/
¦  +- api.Dockerfile
¦  +- web.Dockerfile
+- docker-compose.yml
+- docs/
¦  +- phase1-plan.md (this file)
+- package.json (workspaces root + shared scripts)
```

## Technology Decisions
- **API**: Express + Zod validation + Prisma Client. Node 20 runtime, TypeScript strict mode.
- **Auth**: Access+refresh JWT, long-lived refresh tokens stored in Redis (per user+device).
- **Prisma/Postgres**: Base schema covering users, sessions, roles; future tables to extend from roadmap.
- **Redis**: Session cache + token blacklist, wired through ioredis.
- **Next.js**: App Router, Server Components default, Tailwind + shadcn/ui for design system, next-themes for light/dark toggle.
- **UI State**: React Query (TanStack) for API data fetching + caching.

## Environment Variables
```
# apps/api
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/whatsappbot
REDIS_URL=redis://redis:6379
JWT_ACCESS_SECRET=change-me
JWT_REFRESH_SECRET=change-me
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=7d
PORT=4000

# apps/web
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```
Compose file will inject defaults via `.env.example` (to be created alongside).

## Docker Strategy
- Use multi-stage builds for api/web images (builder -> runner) inside `docker/`.
- `docker-compose.yml` orchestrates services + hot reload for dev (bind mounts) and can be adapted for prod later.

## Immediate Next Steps
1. Convert repository root into npm workspace host (`package.json` + `package-lock.json`).
2. Scaffold `apps/api` with TypeScript Express, ESLint, ts-node-dev, Prisma Client.
3. Add Prisma schema (users, roles, sessions, refresh_tokens) + migration scripts.
4. Scaffold `apps/web` Next.js app with Tailwind + shadcn + layout shell + login/dashboard pages.
5. Author Dockerfiles + compose stack wiring Postgres + Redis + the two apps.
6. Document dev workflow in README and provide base test/checklist for Phase 1.
```
