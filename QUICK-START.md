# 🚀 Quick Start Guide

## ⚠️ PENTING: Install Docker Desktop Dulu!

Aplikasi ini memerlukan **PostgreSQL** dan **Redis** untuk berjalan. Cara termudah adalah menggunakan **Docker Desktop**.

## Langkah 1: Install Docker Desktop

### Cara Install:

1. **Download Docker Desktop:**
   - Buka: https://www.docker.com/products/docker-desktop
   - Atau jalankan script helper: `.\install-docker.ps1`

2. **Install:**
   - Double-click installer yang sudah didownload
   - Ikuti wizard installation
   - **PENTING:** Centang "Use WSL 2 instead of Hyper-V" jika diminta
   - Restart komputer setelah install selesai

3. **Start Docker Desktop:**
   - Buka Docker Desktop dari Start Menu
   - Tunggu sampai icon muncul di system tray (bawah kanan)
   - Status harus menunjukkan "Docker Desktop is running"

## Langkah 2: Jalankan Database

Setelah Docker Desktop running, buka PowerShell di folder project ini dan jalankan:

```powershell
docker compose up -d postgres redis
```

Tunggu sampai kedua container berjalan (sekitar 30 detik pertama kali).

## Langkah 3: Setup Database Schema

```powershell
cd apps/api
npm run prisma:migrate
npm run prisma:generate
```

## Langkah 4: Jalankan Server

### Terminal 1 - API Server:
```powershell
cd apps/api
npm run dev
```

### Terminal 2 - Web Server:
```powershell
cd apps/web
npm run dev
```

## ✅ Selesai!

- API Server: http://localhost:4000
- Web App: http://localhost:3000
- Health Check: http://localhost:4000/health

## 🆘 Troubleshooting

### "docker: command not found"
→ Docker Desktop belum terinstall atau belum di-restart setelah install

### "Can't reach database server"
→ Pastikan Docker Desktop running dan container sudah start:
```powershell
docker compose ps
```

### Port sudah digunakan
→ Stop aplikasi lain yang menggunakan port 5432 (PostgreSQL) atau 6379 (Redis)

## 📝 Catatan

- File `.env` sudah dibuat dengan konfigurasi default
- Database akan dibuat otomatis saat pertama kali run `docker compose up`
- Data akan tersimpan di Docker volume (tidak hilang saat restart)

