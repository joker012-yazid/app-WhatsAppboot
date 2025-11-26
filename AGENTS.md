# Repository Guidelines

This repository is a JavaScript/TypeScript monorepo. Active development happens in `apps/*`; the legacy Express + SQLite code in `src/` remains for reference only.

## Project Structure & Module Organization
- `apps/api` — TypeScript Express API (Prisma, Redis). Entrypoints: `apps/api/src/server.ts`, `apps/api/src/app.ts`; routes in `apps/api/src/routes`.
- `apps/web` — Next.js App Router UI (Tailwind). Pages in `apps/web/src/app`; components in `apps/web/src/components`.
- `prisma/` — Shared Prisma schema (`prisma/schema.prisma`).
- `docker/` & `docker-compose.yml` — Local Postgres/Redis and dev containers.
- `src/` — Legacy monolith. Avoid extending; only touch for urgent fixes.

## Build, Test, and Development Commands
- Install: `npm install`
- Infra (dev): `docker compose up -d postgres redis`
- Dev (both): `npm run dev:monorepo`
- Dev (single app): `npm run dev:api` or `npm run dev:web`
- Build (both): `npm run build`
- Prisma (API): `npm run prisma:generate`, `npm run prisma:migrate`
- Legacy server (manual only): `node src/server.js`

## Coding Style & Naming Conventions
- Languages: TypeScript in `apps/*`; JavaScript allowed only in `src/`.
- Formatting: Prettier + ESLint per workspace. In `apps/api`, Prettier uses single quotes, semicolons, trailing commas. Run `npm run lint -w apps/api` or `npm run lint -w apps/web`.
- Naming: camelCase for variables/functions; PascalCase for types and React components; prefer kebab-case filenames (e.g., `theme-toggle.tsx` exporting `ThemeToggle`).
- Imports: follow eslint import/order with alphabetized groups and blank lines between groups.

## Testing Guidelines
- No test runner is configured yet. Prefer Vitest/Jest + Supertest for API; React Testing Library for Web.
- Place tests alongside sources or under `__tests__`; name files `*.test.ts` / `*.spec.tsx`.
- Keep tests fast and deterministic; document any manual verification steps in the PR.

## Commit & Pull Request Guidelines
- Use Conventional Commits where possible: `feat:`, `fix:`, `chore:`, `docs:` (e.g., `feat(api): add health route`).
- PRs must include: clear description, linked issues, local run/build steps, screenshots for UI changes, and any doc updates (`README.md`, `docs/`).

## Security & Configuration Tips
- Do not commit secrets. Configure `.env` as required by `apps/api/src/config/env.ts` (e.g., `DATABASE_URL`, `REDIS_URL`, JWT secrets).
- Prefer `docker-compose.yml` services for local Postgres/Redis during development.

