# Phase 6 Testing & Bug Fix Guide

## 1. Pre-flight Checklist
- Ensure Postgres + Redis are running (`docker compose up -d postgres redis`).
- Apply pending Prisma migrations and regenerate the client before testing (`npm run prisma:migrate -w apps/api && npm run prisma:generate -w apps/api`).
- Seed an admin (`npm run seed -w apps/api`) and start the stack (`npm run dev:monorepo`).
- In a separate shell run the backup scheduler prerequisites: confirm `pg_dump` is installed (`pg_dump --version`).

## 2. Recommended Automated Coverage
| Area | Tests to add | Notes |
| --- | --- | --- |
| API settings routes | Vitest + Supertest suite hitting `/api/settings` with mocked Prisma to verify schema validation + role gate | Configure `vitest` + `supertest` in `apps/api`; reuse `createApp()` inside tests. |
| Backup service | Unit tests for `createBackup`, `listBackups`, and `enforceRetention` using temporary directories via `vitest` hooks | Mock the `pg_dump` spawn result to keep tests deterministic. |
| Web settings UI | React Testing Library tests for backup trigger button + read-only role guard | Wrap with `AuthProvider` test harness and mock `apiGet` / `apiPost`. |
| Campaign queue | Integration test verifying `/api/campaigns/:id/start` enqueues recipients respecting anti-ban defaults | Requires disposable Postgres schema + Redis.

## 3. Manual Regression Matrix
| Feature | Steps | Expected |
| --- | --- | --- |
| Settings CRUD | Login as admin, visit `/settings`, edit each section, save, reload page | Values persist, non-admins see read-only banner. |
| Backup manual trigger | Click "Trigger manual backup", wait for toast, refresh backups table | New backup row appears with non-zero size; file download works. |
| Backup restore | Click "Extract" for the newest backup, inspect `backups/restores/*` folder | Metadata + database.sql extracted; warning banner shown in toast. |
| Scheduler update | Change backup schedule to a different time, refresh API logs | `[backup] scheduler active` log shows new cron expression. |
| Campaign send | Create campaign targeting 2-3 test numbers, start/pause/resume | Queue obeys anti-ban delays, status transitions RUNNING -> COMPLETED. |
| Dashboard widgets | Seed jobs/customers, open `/dashboard` | Revenue + customer charts render without console errors. |
| Reports | Select past 14-day range, confirm charts/table update | API returns 200, page shows retention + campaign metrics. |
| Device/job CRUD | Create device, link to job, update lifecycle statuses | Jobs table + status history reflect changes instantly. |

## 4. Bug Triage Flow
1. Capture reproduction steps, request logs (`apps/api/server.log`), and database snapshot when feasible.
2. Label bugs with `severity` + `phase` (e.g., `S1-phase6`) in your tracker.
3. Prioritise blockers that affect campaigns, billing, or backups; fix low-severity UI bugs after stabilising schedulers.
4. Log fixes in this guide with a short summary + verification evidence (timestamp, tester initials).

### Bug Log Template
```
- [ ] ID / Title – report link
  - Root cause:
  - Fix commit:
  - Verified by:
  - Notes:
```

## 5. Security & Performance Spot Checks
- **Secrets** – verify `.env` is not committed, `JWT_*` and `OPENAI_API_KEY` rotate every 90 days.
- **Access control** – ensure `/api/settings` and `/api/backups` reject non-admin roles (test with a TECHNICIAN token).
- **Rate limiting** – confirm WhatsApp anti-ban limits in settings stay within provider guidance (< 5000 daily, 0 <= delay <= 600s).
- **Backups** – download a zip, run `unzip -l backup-*.zip`, confirm `meta/metadata.json` + `meta/database.sql` exist; run `psql < meta/database.sql` on staging weekly.
- **Performance** – with 1k jobs + 10k customers, hit `/api/dashboard` + `/api/reports/summary?from=...&to=...` and ensure response < 3s; log slow Prisma queries.
- **Dependency audit** – run `npm audit` at repo root; patch high severity issues or document suppression rationale.

## 6. Release Sign-off Checklist
- [ ] Automated test suite green (`npm run test -w apps/api` etc.).
- [ ] Manual matrix executed; attach screenshots/logs to PR.
- [ ] Backups verified (manual + scheduled).
- [ ] Security checklist completed; no secrets leaked.
- [ ] Documentation updated (README, AGENTS.md, this file).
