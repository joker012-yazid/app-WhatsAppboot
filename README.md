# WhatsApp Bot POS SuperApp

Monorepo ini ialah sistem aktif yang terdiri daripada API (Express + Prisma di `apps/api`) dan Web (Next.js di `apps/web`). Infrastruktur tempatan menggunakan Postgres dan Redis melalui `docker-compose.yml`. Kod legasi Express + SQLite dalam folder `src/` masih dikekalkan untuk rujukan sahaja dan tidak berjalan melalui skrip utama.

## Local development (ringkas)

1) Salin konfigurasi asas: `cp .env.example .env` lalu lengkapkan nilai yang diperlukan.
2) Pasang dependensi: `npm install`
3) Jalankan kedua-dua API (port 4000) dan Web (port 3000): `npm run dev`

API mesti boleh dicapai di `http://localhost:4000` supaya UI berfungsi dengan betul. Untuk Postgres + Redis tempatan, gunakan `docker compose up -d postgres redis`.

## Cara Jalankan Projek (Monorepo)

```bash
npm install

# Salin konfigurasi asas jika perlu
cp .env.example .env

# Jana Prisma client
npm run prisma:generate

# Jalankan kedua-dua API dan Web serentak
npm start   # alias kepada "npm run dev" -> "npm run dev:monorepo"
```

Perkhidmatan tersedia di:

| Service | URL | Nota |
| ------- | --- | ---- |
| API | http://localhost:4000 | `/health` tersedia untuk semakan cepat |
| Web | http://localhost:3000 | Next.js App Router UI |
| Postgres | localhost:5432 | Disediakan oleh `docker compose` |
| Redis | localhost:6379 | Disediakan oleh `docker compose` |

Jalankan komponen secara berasingan jika perlu:

```bash
npm run dev:api   # API sahaja
npm run dev:web   # Web sahaja
```

Untuk melancarkan Postgres + Redis yang diperlukan oleh API:

```bash
docker compose up -d postgres redis
```

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
