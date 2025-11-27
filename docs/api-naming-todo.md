# API Naming TODO

The current API paths remain unchanged to avoid breaking the web frontend. The notes below capture suggested REST-friendly names to apply in a later iteration once the client can be updated.

- Campaign lifecycle actions (`/api/campaigns/:id/start`, `/pause`, `/resume`, `/cancel`): consider consolidating into `PATCH /api/campaigns/:id` with a `{ status }` body or `/api/campaigns/:id/status` to remove verb-like routes.
- Backup download/restore (`/api/backups/:filename/download`, `/api/backups/:filename/restore`): consider a resource-oriented pattern such as `GET /api/backups/:id` for metadata, `GET /api/backups/:id/file` for the archive, and `POST /api/backups/:id/restore`.
- Preview endpoints (`POST /api/campaigns/preview`): keep for now, but long term could be `/api/campaigns/previews` to reflect collection semantics.

Add migrations or frontend changes only after confirming the client is ready for the new paths.
