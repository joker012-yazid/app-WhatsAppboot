# WhatsApp Bot POS SuperApp

This repository now includes the first working backend slice for the device repair automation
platform described in `development_roadmap.md`. The service is an Express.js API backed by a
SQLite database (via better-sqlite3) that covers the early roadmap milestones:

- Authentication with JWT for admins and staff.
- Customer and device management.
- Repair job lifecycle with QR-code powered public registration links.
- Photo upload endpoints for repair documentation.
- Message template storage and preview rendering ready for WhatsApp delivery logic.

## Getting started

```bash
npm install
npm run migrate
npm run seed
npm run dev
```

The server listens on port `4000` by default. Override the following environment variables by
creating a `.env` file:

```ini
PORT=4000
JWT_SECRET=super-secret-key
DATABASE_PATH=storage/data.db
```

## Core API endpoints

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/auth/login` | `POST` | Authenticate with email and password to receive a JWT. |
| `/api/customers` | CRUD | Manage customers and inspect their linked devices/jobs. |
| `/api/devices` | CRUD | Manage devices tied to customers. |
| `/api/jobs` | CRUD | Manage repair jobs, including QR token generation. |
| `/api/jobs/:id/photos` | `POST` | Upload up to 6 photos per request for a job. |
| `/api/jobs/register/:token` | `GET/POST` | Public registration flow triggered by QR codes. |
| `/api/templates` | CRUD | Manage WhatsApp message templates and preview rendered messages. |

The public registration placeholder lives in `public/register/index.html` and can be replaced with a
full client according to the roadmap.

## Database seeding

Running `npm run seed` after migrations adds a default admin user:

- **Email**: `admin@repairhub.local`
- **Password**: `admin123`

It also seeds a demo customer, device, and job so the UI can show real data during development.

## Next steps

The roadmap continues with WhatsApp connectivity, POS integration, marketing automation, and
reporting. The current codebase is structured to grow into those areas:

- Add WhatsApp services inside `src/services/`.
- Expand `job_messages` to persist inbound/outbound chat history.
- Layer in POS and inventory models using new migrations under `src/scripts`.

Refer to `development_roadmap.md` for the detailed staged rollout plan.
