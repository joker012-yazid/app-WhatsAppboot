# Setup Instructions

## Prerequisites

Anda perlu menjalankan PostgreSQL dan Redis untuk development. Ada 2 cara:

### Option 1: Menggunakan Docker (Recommended)

1. **Install Docker Desktop**
   - Download dari: https://www.docker.com/products/docker-desktop
   - Install dan restart komputer jika diperlukan
   - Pastikan Docker Desktop berjalan (icon di system tray)

2. **Jalankan database services:**
   ```powershell
   # Di root project
   docker compose up -d postgres redis
   ```

3. **Atau gunakan script helper:**
   ```powershell
   .\setup-database.ps1
   ```

4. **Setup database:**
   ```powershell
   cd apps/api
   npm run prisma:migrate
   npm run prisma:generate
   ```

### Option 2: Install Manual (Tanpa Docker)

1. **Install PostgreSQL:**
   - Download dari: https://www.postgresql.org/download/windows/
   - Install dengan default settings
   - Buat database: `whatsappbot`
   - User: `postgres`, Password: `postgres`
   - Port: `5432`

2. **Install Redis:**
   - Download dari: https://github.com/microsoftarchive/redis/releases
   - Atau gunakan WSL2 dengan Redis
   - Port: `6379`

3. **Update `.env` file jika perlu:**
   - Sesuaikan `DATABASE_URL` dan `REDIS_URL` jika berbeda

## Setup Database Schema

Setelah PostgreSQL dan Redis berjalan:

```powershell
cd apps/api

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# (Optional) Seed database dengan data sample
npm run seed
```

## Menjalankan Server

```powershell
# API Server (port 4000)
cd apps/api
npm run dev

# Web Server (port 3000) - di terminal lain
cd apps/web
npm run dev
```

## Troubleshooting

### Error: "Can't reach database server"
- Pastikan PostgreSQL berjalan
- Cek dengan: `docker compose ps` (jika pakai Docker)
- Atau cek service PostgreSQL di Windows Services

### Error: "Redis connection failed"
- Pastikan Redis berjalan
- Cek dengan: `docker compose ps` (jika pakai Docker)
- Atau test dengan: `redis-cli ping` (harus return "PONG")

### Port sudah digunakan
- Cek apakah ada service lain yang menggunakan port 5432 (PostgreSQL) atau 6379 (Redis)
- Stop service tersebut atau ubah port di `docker-compose.yml` dan `.env`

