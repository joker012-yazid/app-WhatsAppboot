# 📖 Panduan Lengkap Penggunaan WhatsApp Bot POS SuperApp

> Panduan ringkas dan mudah untuk menjalankan sistem

---

## 🚀 Cara Termudah - Satu Klik Sahaja!

### Langkah 1: Pastikan Docker Desktop Running

Buka **Docker Desktop** dari Start Menu dan tunggu sehingga status menunjukkan "running".

### Langkah 2: Jalankan Script All-in-One

Buka PowerShell di folder project ini dan jalankan:

```powershell
.\start-all-in-one.ps1
```

**Script ini akan automatically:**
1. ✅ Check Docker dan services (PostgreSQL, Redis)
2. ✅ Install dependencies jika belum
3. ✅ Generate Prisma client
4. ✅ Run database migrations
5. ✅ Create .env files jika belum ada
6. ✅ Start API server (port 4000)
7. ✅ Start Web app (port 3000)

**Selesai!** Buka browser dan pergi ke:
- 🌐 **Web App**: http://localhost:3000
- 🔌 **API**: http://localhost:4000

---

## 📋 Script-Script Yang Ada

### 1. **start-all-in-one.ps1** ⭐ RECOMMENDED
Cara termudah - jalankan semuanya dengan satu command!

```powershell
.\start-all-in-one.ps1
```

**Options:**
```powershell
# Skip Docker checks (jika Docker sudah running)
.\start-all-in-one.ps1 -SkipDocker

# Skip npm install (jika dependencies sudah installed)
.\start-all-in-one.ps1 -SkipInstall

# Skip database migration
.\start-all-in-one.ps1 -SkipMigration

# Force clean install (hapus node_modules dan install semula)
.\start-all-in-one.ps1 -ForceClean
```

---

### 2. **health-check.ps1**
Check status semua services

```powershell
.\health-check.ps1
```

**Options:**
```powershell
# Detailed information
.\health-check.ps1 -Detailed

# Attempt to fix common issues
.\health-check.ps1 -Fix

# Output in JSON format
.\health-check.ps1 -Json
```

**Output Example:**
```
═══ Step 1: Checking Docker & Database Services ═══
   ✓ Docker is running
   ✓ PostgreSQL is running
   ✓ Redis is running

═══ Step 2: Checking API Server (port 4000) ═══
   ✓ API server is running
   ✓ Health endpoint responding

═══ Step 3: Checking Web App (port 3000) ═══
   ✓ Web app is running

Overall Status: HEALTHY
```

---

### 3. **check-services.ps1**
Check status services dengan ringkas

```powershell
.\check-services.ps1
```

---

### 4. **start-monorepo.ps1**
Start API dan Web manually (tanpa checks)

```powershell
.\start-monorepo.ps1
```

---

## 🛠️ Cara Manual (Jika Ada Masalah)

### Step 1: Start Docker Containers

```powershell
docker compose up -d postgres redis
```

Tunggu ~30 saat untuk containers ready.

### Step 2: Install Dependencies

```powershell
npm install
```

### Step 3: Setup Database

```powershell
cd apps/api
npm run prisma:generate
npm run prisma:migrate
cd ../..
```

### Step 4: Start API Server

```powershell
# Terminal 1
cd apps/api
npm run dev
```

### Step 5: Start Web App

```powershell
# Terminal 2 (buka terminal baru)
cd apps/web
npm run dev
```

---

## 🔐 Login Credentials (Default)

Selepas setup, anda boleh login dengan:

**Admin Account:**
- Email: `admin@example.com`
- Password: `admin123`

**Manager Account:**
- Email: `manager@example.com`
- Password: `manager123`

**Technician Account:**
- Email: `tech@example.com`
- Password: `tech123`

**Cashier Account:**
- Email: `cashier@example.com`
- Password: `cashier123`

---

## 📍 URLs Penting

| Service | URL | Kegunaan |
|---------|-----|----------|
| **Web App** | http://localhost:3000 | Main application UI |
| **API** | http://localhost:4000 | Backend API |
| **Health Check** | http://localhost:4000/health | Check API status |
| **Login Page** | http://localhost:3000/login | Login page |
| **Dashboard** | http://localhost:3000/dashboard | Main dashboard |

---

## 🐛 Troubleshooting

### Problem: Docker not found
**Solution:**
```powershell
# Check if Docker installed
docker --version

# If not installed, run:
.\install-docker.ps1
```

---

### Problem: Port already in use
**Solution:**
```powershell
# Kill process on port 4000 (API)
.\kill-port.ps1 4000

# Kill process on port 3000 (Web)
.\kill-port.ps1 3000

# Kill process on port 5432 (PostgreSQL)
.\kill-port.ps1 5432
```

---

### Problem: Database connection error
**Solution:**
```powershell
# 1. Check if PostgreSQL container running
docker ps | findstr postgres

# 2. If not running, start it:
docker compose up -d postgres

# 3. Wait 10 seconds, then test:
docker exec -it $(docker ps -qf "name=postgres") pg_isready

# 4. If still error, check logs:
docker logs $(docker ps -qf "name=postgres")
```

---

### Problem: Redis connection error
**Solution:**
```powershell
# 1. Check if Redis container running
docker ps | findstr redis

# 2. If not running, start it:
docker compose up -d redis

# 3. Test connection:
docker exec -it $(docker ps -qf "name=redis") redis-cli ping
# Should return: PONG
```

---

### Problem: npm install fails
**Solution:**
```powershell
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
Remove-Item -Recurse -Force node_modules, apps/api/node_modules, apps/web/node_modules
npm install
```

---

### Problem: Prisma migration error
**Solution:**
```powershell
cd apps/api

# Reset database (WARNING: Deletes all data!)
npx prisma migrate reset --force

# Or manually run migrations
npx prisma migrate deploy

# Regenerate Prisma client
npm run prisma:generate

cd ../..
```

---

### Problem: Web app not connecting to API
**Checklist:**
1. ✅ Check API is running: http://localhost:4000/health
2. ✅ Check `.env.local` file di `apps/web/`:
   ```
   NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
   ```
3. ✅ Restart web app selepas update .env

---

### Problem: "Module not found" error
**Solution:**
```powershell
# For API
cd apps/api
npm install
npm run build
cd ../..

# For Web
cd apps/web
npm install
cd ../..
```

---

## 🔄 Common Tasks

### Update Dependencies
```powershell
# Update all workspaces
npm update

# Or update specific workspace
npm update -w apps/api
npm update -w apps/web
```

---

### Create New Database Migration
```powershell
cd apps/api

# Edit prisma/schema.prisma first, then:
npm run prisma:migrate

# Give it a descriptive name when prompted
# Example: "add_user_profile_fields"

cd ../..
```

---

### Seed Database with Sample Data
```powershell
cd apps/api
npm run seed
cd ../..
```

---

### View Database with Prisma Studio
```powershell
cd apps/api
npx prisma studio
# Opens browser at http://localhost:5555
cd ../..
```

---

### Build for Production
```powershell
# Build both API and Web
npm run build

# Or build individually
npm run build -w apps/api
npm run build -w apps/web
```

---

### Run Production Build
```powershell
# Start API (production)
cd apps/api
npm start

# Start Web (production)
cd apps/web
npm start
```

---

## 📊 Development Workflow

### Daily Development
```powershell
# 1. Start hari dengan check health
.\health-check.ps1

# 2. If everything OK, start servers
.\start-all-in-one.ps1

# 3. Code away! 🚀

# 4. Run linters before commit
npm run lint

# 5. Format code
npm run format
```

---

### Before Committing
```powershell
# Check for linting errors
npm run lint

# Format code
npm run format

# Check health
.\health-check.ps1

# Run tests (if implemented)
npm test
```

---

## 🔒 Environment Variables

### Root `.env`
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/whatsappbot
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=your-secret-here
JWT_REFRESH_SECRET=your-secret-here
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=7d
NODE_ENV=development
PORT=4000
WHATSAPP_SESSION_DIR=./whatsapp-sessions
WHATSAPP_LOG_LEVEL=info
```

### `apps/api/.env`
Same as root `.env`

### `apps/web/.env.local`
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

**IMPORTANT**: 
- Jangan commit `.env` files!
- Untuk production, ganti semua secrets!
- Pastikan `.gitignore` includes `.env` files

---

## 📦 Project Structure

```
app-WhatsAppboot/
├── apps/
│   ├── api/                    # Express + Prisma API
│   │   ├── src/
│   │   │   ├── routes/         # API routes
│   │   │   ├── services/       # Business logic
│   │   │   ├── middleware/     # Express middleware
│   │   │   ├── lib/            # Shared libraries
│   │   │   └── config/         # Configuration
│   │   └── prisma/
│   │       └── schema.prisma   # Database schema
│   │
│   └── web/                    # Next.js Web App
│       └── src/
│           ├── app/            # App Router pages
│           ├── components/     # React components
│           └── lib/            # Client utilities
│
├── docker/                     # Docker configurations
├── docs/                       # Documentation
├── scripts/                    # Utility scripts
│
├── start-all-in-one.ps1       # ⭐ Main startup script
├── health-check.ps1           # Health check script
├── docker-compose.yml         # Docker services
└── package.json               # Root workspace config
```

---

## 🎯 Quick Commands Cheatsheet

| Task | Command |
|------|---------|
| **Start Everything** | `.\start-all-in-one.ps1` |
| **Check Health** | `.\health-check.ps1` |
| **Stop Servers** | `Ctrl + C` in terminal |
| **Restart Docker** | `docker compose restart` |
| **View Logs** | `docker compose logs -f` |
| **Clean Everything** | `.\start-all-in-one.ps1 -ForceClean` |
| **Database Studio** | `cd apps/api && npx prisma studio` |
| **Kill Port** | `.\kill-port.ps1 <port>` |

---

## 💡 Tips & Best Practices

1. **Selalu check health sebelum start coding**
   ```powershell
   .\health-check.ps1
   ```

2. **Guna start-all-in-one.ps1 untuk development**
   - Automatic checks
   - Automatic setup
   - Less hassle!

3. **Keep Docker Desktop running**
   - API perlu PostgreSQL dan Redis
   - Both running via Docker

4. **Check logs jika ada error**
   ```powershell
   # API logs
   cd apps/api
   cat server.log
   
   # Docker logs
   docker compose logs -f
   ```

5. **Update dependencies regularly**
   ```powershell
   npm update
   ```

6. **Backup database sebelum major changes**
   - Guna feature backup dalam app
   - Atau manual: `.\setup-database.ps1`

---

## 📞 Getting Help

### Check Documentation
- `README.md` - Overview
- `QUICK-START.md` - Quick start guide
- `SYSTEM_IMPROVEMENTS.md` - Improvements & upgrades
- `CARA_GUNA.md` - Panduan ini

### Check Health Status
```powershell
.\health-check.ps1 -Detailed
```

### Check Logs
```powershell
# API logs
cat apps/api/server.log

# Docker logs
docker compose logs -f

# Specific service logs
docker logs $(docker ps -qf "name=postgres")
docker logs $(docker ps -qf "name=redis")
```

---

## ✅ Pre-flight Checklist

Sebelum start development, pastikan:

- [ ] Docker Desktop installed dan running
- [ ] Node.js v18+ installed
- [ ] Git installed (optional)
- [ ] PowerShell v5.1+ available
- [ ] Port 3000, 4000, 5432, 6379 available
- [ ] Minimum 4GB RAM available
- [ ] Minimum 2GB disk space available

Run comprehensive check:
```powershell
.\health-check.ps1 -Detailed
```

---

## 🎉 You're Ready!

Sekarang anda dah boleh start development dengan mudah:

```powershell
.\start-all-in-one.ps1
```

Happy coding! 🚀

---

**Last Updated**: December 3, 2025
**Version**: 1.0.0

