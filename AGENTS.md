# Repository Guidelines

## Project Structure & Module Organization
Primary work lives in `apps/*`. `apps/api` contains the TypeScript Express API with entrypoints at `apps/api/src/server.ts` and `apps/api/src/app.ts`, modularized routes in `apps/api/src/routes`, and env handling in `apps/api/src/config`. `apps/web` is the Next.js App Router UI with pages under `apps/web/src/app` and shared components in `apps/web/src/components`. Shared database models stay in `prisma/schema.prisma`. Local infra definitions reside in `docker/` with `docker-compose.yml`, while design docs land in `docs/`. Public assets (`public/`, `storage/`, `uploads/`, `whatsapp-sessions/`) back file uploads; only patch the legacy `src/` Express + SQLite code for urgent fixes. Co-locate tests with their modules or use `__tests__` directories.

## Build, Test, and Development Commands
- `npm install` - install workspace dependencies declared in the root package.
- `docker compose up -d postgres redis` - boot Postgres and Redis the API expects.
- `npm run dev:monorepo` - start API and web together for integrated development.
- `npm run dev:api` / `npm run dev:web` - run a single workspace while iterating.
- `npm run build` - create production builds for both apps.
- `npm run prisma:generate` - sync the Prisma client after schema updates.
- `npm run prisma:migrate` - apply schema changes to the local database.

## Coding Style & Naming Conventions
Use TypeScript throughout `apps/*`; JavaScript belongs only in `src/`. Prettier and ESLint run per workspace, so lint via `npm run lint -w apps/api` or `npm run lint -w apps/web`. Follow camelCase for functions and variables, PascalCase for React components and types, and kebab-case filenames such as `theme-toggle.tsx`. The API favors single quotes, semicolons, and trailing commas. Keep imports alphabetized with blank lines between dependency groups.

## Testing Guidelines
No default runner ships yet; prefer Vitest or Jest with Supertest for API contracts and React Testing Library for the UI. Name specs `*.test.ts` or `*.spec.tsx` and place them next to the code under test or within `__tests__`. Mock Prisma, Redis, and remote calls to keep suites deterministic. Document any manual exercises (e.g., cURL against `/api/health`) inside the PR if automated coverage is missing.

## Commit & Pull Request Guidelines
Use Conventional Commits such as `feat(api): add health route` or `fix(web): handle auth error`. Each PR needs a focused summary, linked issue or ticket, run/build steps, and UI screenshots or GIFs when relevant. Mention doc updates (`README.md`, `docs/`) and keep scope limited to a single concern to simplify review.

## Security & Configuration Tips
Never commit secrets. Fill `.env` with the variables consumed by `apps/api/src/config/env.ts` (e.g., `DATABASE_URL`, `REDIS_URL`, JWT keys). Use the Docker Compose Postgres/Redis services for parity, and rerun `npm run prisma:generate` whenever `prisma/schema.prisma` changes. Rotate WhatsApp session artifacts in `whatsapp-sessions/` cautiously and avoid storing production data locally.
