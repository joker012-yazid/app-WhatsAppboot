# WhatsApp Bot POS SuperApp

**Status:** ✅ Aktif & Berfungsi | **Progress:** 75-80% Siap | **Dikemaskini:** 13 Dis 2025

Sistem WhatsApp automation lengkap untuk pengurusan kedai pembaikan dengan POS, job tracking, dan marketing campaigns. Dibangunkan menggunakan monorepo architecture dengan TypeScript backend dan Next.js frontend.

## 🚀 Quick Start

### Prasyarat
- Node.js 20+
- npm atau yarn
- Docker & Docker Compose (untuk database)

### Langkah Pantas

```bash
# 1. Clone dan install dependencies
git clone <repo-url>
cd app-WhatsAppboot
npm install

# 2. Setup environment variables
cp .env.example .env
# Edit .env dengan konfigurasi anda

# 3. Start database services
docker compose up -d postgres redis

# 4. Generate Prisma Client dan migrate database
npm run prisma:generate
npm run prisma:migrate

# 5. Jalankan development server
npm run dev
# API: http://localhost:4000
# Web: http://localhost:3000
```

## 📊 Struktur Projek

```
app-WhatsAppboot/
├── apps/
│   ├── api/          # Backend TypeScript (Express + Prisma)
│   │   ├── src/      # 34 TypeScript files
│   │   ├── dist/     # Compiled JavaScript
│   │   └── prisma/   # Database schema
│   └── web/          # Frontend Next.js
│       ├── src/      # 58 React/TypeScript files
│       └── .next/    # Next.js build output
├── prisma/           # Database schema (root level)
├── docker/           # Docker configurations
└── docs/             # Documentation
```

## 🛠 Tech Stack

### Backend (apps/api)
- **Runtime:** Node.js 20+ dengan TypeScript
- **Framework:** Express.js 4.x
- **Database:** PostgreSQL 16 (Prisma ORM)
- **Queue:** BullMQ + Redis 7
- **WhatsApp:** @whiskeysockets/baileys
- **Auth:** JWT (jsonwebtoken + bcryptjs)
- **Build:** TypeScript compiler

### Frontend (apps/web)
- **Framework:** Next.js 14 (App Router)
- **UI:** TailwindCSS + Shadcn UI
- **State:** React Query (TanStack Query)
- **Drag & Drop:** DnD Kit
- **Icons:** Lucide React
- **Animations:** Framer Motion

### Infrastructure
- **Container:** Docker + Docker Compose
- **Database:** PostgreSQL 16
- **Cache/Queue:** Redis 7
- **Monorepo:** npm workspaces

## 📋 Perintah Yang Tersedia

```bash
# Development
npm run dev              # Jalankan API + Web serentak
npm run dev:api          # API sahaja (port 4000)
npm run dev:web          # Web sahaja (port 3000)

# Build
npm run build            # Build API + Web
npm run build -w apps/api   # Build API sahaja
npm run build -w apps/web   # Build Web sahaja

# Database
npm run prisma:generate  # Generate Prisma Client
npm run prisma:migrate   # Run database migrations

# Production
npm start                # Start production build
```

## 🌐 Services & Ports

| Service | URL | Status | Nota |
|---------|-----|--------|------|
| API | http://localhost:4000 | ✅ Ready | REST API + `/health` endpoint |
| Web | http://localhost:3000 | ✅ Ready | Next.js App Router UI |
| PostgreSQL | localhost:5432 | ✅ Ready | Database (docker) |
| Redis | localhost:6379 | ✅ Ready | Queue & Cache (docker) |

## Legacy Server (Deprecated)

Server lama dalam `src/` berasaskan Express + SQLite dan hanya disimpan untuk rujukan. Gunakan skrip berikut jika perlu meninjau atau menguji kod lama secara manual:

```bash
npm run legacy:start  # node src/server.js
npm run legacy:dev    # nodemon src/server.js
```

## Future Cleanup Plan (Dependencies / Legacy)

Pakej berikut berada di akar kerana menyokong server legasi dan boleh dinyahaktifkan selepas migrasi penuh ke monorepo baharu:

- `express@5`
- `better-sqlite3`
- `@hapi/boom`
- `bcryptjs`
- `jsonwebtoken`
- `multer`
- `pino`
- `@whiskeysockets/baileys`
- `dotenv`
- `qrcode`
- `uuid`
- `dayjs`
- `cors`

Selepas memastikan tiada lagi kebergantungan pada kod `src/`, kita boleh memindahkan legasi ke folder `legacy/` atau
pakej berasingan sebelum membuang dependensi tersebut.

## Dokumentasi Tambahan

Latar belakang fasa pembangunan terkini tersedia dalam `development_roadmap.md` dan `docs/phase1-plan.md`. Gunakan `apps/api` dan `apps/web` sebagai rujukan utama untuk kod aktif.
