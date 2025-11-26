# Repository Guidelines

## Project Structure & Module Organization
Active work lives in `apps/*`. `apps/api` hosts the TypeScript Express API (entrypoints `apps/api/src/server.ts` and `apps/api/src/app.ts`; routes in `apps/api/src/routes`). `apps/web` covers the Next.js App Router UI with pages in `apps/web/src/app` and components in `apps/web/src/components`. Shared database models live in `prisma/schema.prisma`, while `docker/` plus `docker-compose.yml` hold local infra definitions. The legacy `src/` Express + SQLite code is reference-only; touch it only for urgent fixes.

## Build, Test, and Development Commands
- `npm install` installs workspace dependencies.
- `docker compose up -d postgres redis` starts local Postgres and Redis containers.
- `npm run dev:monorepo`, `npm run dev:api`, or `npm run dev:web` run dev servers.
- `npm run build` compiles both applications for production use.
- Prisma tooling: `npm run prisma:generate` refreshes the client, and `npm run prisma:migrate` applies schema changes.

## Coding Style & Naming Conventions
Use TypeScript in `apps/*` and JavaScript only inside the legacy `src/`. Prettier + ESLint enforce formatting per workspace; run `npm run lint -w apps/api` or `npm run lint -w apps/web`. The API workspace standardizes on single quotes, semicolons, and trailing commas. Use camelCase for variables/functions, PascalCase for React components and types, and kebab-case filenames (for example `theme-toggle.tsx`). Keep imports alphabetized with blank lines between groups.

## Testing Guidelines
A default runner is not installed yet. Prefer Vitest or Jest with Supertest for the API and React Testing Library for the UI. Store specs next to source files or in `__tests__` directories using `*.test.ts` or `*.spec.tsx` names. Mock Prisma, Redis, and network calls to keep tests deterministic. Document any manual verification steps in pull requests when automated tests are missing.

## Commit & Pull Request Guidelines
Follow Conventional Commits such as `feat(api): add health route` or `fix(web): handle auth error`. Pull requests must include a concise summary, linked issues, local run/build steps, and UI screenshots or GIFs when applicable. Mention any documentation updates (`README.md`, `docs/`) and keep scope focused on a single concern.

## Security & Configuration Tips
Never commit secrets. Populate `.env` with the variables expected by `apps/api/src/config/env.ts` (for example `DATABASE_URL`, `REDIS_URL`, JWT secrets). Use the Docker Compose Postgres and Redis services for local parity, and regenerate the Prisma client whenever `prisma/schema.prisma` changes.
