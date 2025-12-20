# Prisma schema migration plan (campaign + scheduler)

## Summary of proposed changes
- **Indexes (safe):**
  - `Campaign`: `@@index([status, createdAt])` for faster dashboard filtering.
  - `CampaignRecipient`: indexes on `(campaignId, status)`, `(campaignId, createdAt)`, `(campaignId, phone)` to speed queue lookups and duplicate checks.
  - `Reminder`: `@@index([jobId, kind])` for reminder sweep queries.
- **Status/field clean-up (risky, require audit):**
  - Consider adding a `PROCESSING/QUEUED` status to `CampaignRecipientStatus` for clearer in-flight tracking.
  - Fields `CampaignRecipient.readAt` and `CampaignRecipient.respondedAt` appear unused; confirm before removal.
  - Consider a unique constraint on `(campaignId, phone)` to enforce idempotent recipient creation.

## Suggested migration commands
Execute after validating in a dev/staging database:

```bash
npm run prisma:migrate -- --name campaign_indexes
# or
npx prisma migrate dev --name campaign_indexes
```

If proceeding with risky changes (after audit):

```bash
npx prisma migrate dev --name campaign_recipient_cleanup
```

## Post-migration validation
- `npm run prisma:generate` to refresh the client.
- Smoke test campaign creation/start/resume and reminder scheduler scans.
- Verify queue processing still respects business hours/daily limits.
- Check that campaign recipient listings filter by status efficiently (observe query plans if possible).
