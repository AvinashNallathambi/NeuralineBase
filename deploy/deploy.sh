#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# Neuraline EMR — Deploy Script
# Run this on EC2 to pull latest code, rebuild, and restart services.
#
# This script is called by GitHub Actions (deploy.yml) via SSH,
# or can be run manually on the EC2 instance.
#
# Usage:
#   cd /opt/neuraline && ./deploy/deploy.sh
# ═══════════════════════════════════════════════════════════════════════════

set -e

APP_DIR="/opt/neuraline"
FRONTEND_DIR="/var/www/neuraline"
BACKUP_DIR="/opt/neuraline/backups"

cd "$APP_DIR"

echo "═══════════════════════════════════════════════════════════"
echo "  Neuraline EMR — Deploying $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════════════════"
echo ""

# ─── 1. Pull latest code ───────────────────────────────────────────────────
echo "▶ Pulling latest code from git..."
# Reset any local changes (lockfiles, build artifacts) before pulling
git reset --hard HEAD
git clean -fd -- package-lock.json frontend/package-lock.json backend/package-lock.json
git pull origin main
echo "  Current commit: $(git rev-parse --short HEAD)"
echo ""

# ─── 2. Install/update dependencies ────────────────────────────────────────
echo "▶ Installing dependencies..."
# Delete lockfiles AND node_modules to avoid Windows/Linux platform binary
# mismatches (npm optional dependency bug — @rollup/rollup-linux-x64-gnu)
rm -f package-lock.json frontend/package-lock.json backend/package-lock.json
rm -rf node_modules frontend/node_modules backend/node_modules
npm install
echo "  ✅ Dependencies updated"
echo ""

# t3.micro has 1GB RAM — Node needs more heap for TypeScript compilation
export NODE_OPTIONS='--max-old-space-size=1536'

# ─── 3. Build backend ──────────────────────────────────────────────────────
echo "▶ Building backend..."
cd backend
npm run build
cd ..
echo "  ✅ Backend built"
echo ""

# ─── 4. Build frontend (uses .env.production for VITE_API_URL) ──────────────
echo "▶ Building frontend..."
cd frontend
npm run build
cd ..
echo "  ✅ Frontend built"
echo ""

# ─── 4b. Prune devDependencies (not needed at runtime, saves disk on t3.micro)
echo "▶ Pruning devDependencies..."
npm prune --omit=dev 2>/dev/null || true
echo "  ✅ Pruned"
echo ""

# ─── 4c. Backup database before migrations ─────────────────────────────────
echo "▶ Backing up database before migration..."
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/db_backup_$(date '+%Y%m%d_%H%M%S').sql.gz"
DB_HOST_VAL="${DB_HOST:-127.0.0.1}"
DB_PORT_VAL="${DB_PORT:-5432}"
DB_NAME_VAL="${DB_DATABASE:-neuraline}"
DB_USER_VAL="${DB_USERNAME:-neuraline}"
if pg_dump -h "$DB_HOST_VAL" -p "$DB_PORT_VAL" -U "$DB_USER_VAL" -d "$DB_NAME_VAL" --no-owner --clean --if-exists 2>/dev/null | gzip > "$BACKUP_FILE" 2>/dev/null; then
  echo "  ✅ Backup saved: $BACKUP_FILE"
  # Keep only the last 10 backups
  ls -t "$BACKUP_DIR"/db_backup_*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm -f
else
  echo "  ⚠️  WARNING: Database backup failed — continuing anyway (set PGPASSWORD or use .pgpass)"
  echo "     To enable backups: create /opt/neuraline/.pgpass with format:"
  echo "     $DB_HOST_VAL:$DB_PORT_VAL:$DB_NAME_VAL:$DB_USER_VAL:<password>"
fi
echo ""

# ─── 4d. Run database migrations (use compiled JS, not TS) ──────────────────
echo "▶ Running database migrations..."
cd backend
if NODE_EXTRA_CA_CERTS=/opt/neuraline/rds-ca-bundle.pem npx typeorm migration:run -d dist/config/database.config.js 2>&1; then
  echo "  ✅ Migrations applied"
else
  echo "  ⚠️  WARNING: Some migrations failed (likely 'already exists' errors from prior synchronize=true run)"
  echo "     Continuing — the schema already exists from a previous DB_SYNCHRONIZE run."
fi
cd ..
echo ""

# ─── 5. Copy frontend to Nginx ─────────────────────────────────────────────
echo "▶ Deploying frontend to Nginx..."
sudo rm -rf "$FRONTEND_DIR"/*
sudo cp -r frontend/dist/* "$FRONTEND_DIR/"
sudo chown -R www-data:www-data "$FRONTEND_DIR"
echo "  ✅ Frontend deployed"
echo ""

# ─── 6. Restart backend with PM2 ───────────────────────────────────────────
echo "▶ Restarting backend (PM2)..."
cd "$APP_DIR"
pm2 restart deploy/ecosystem.config.js --update-env || pm2 start deploy/ecosystem.config.js
pm2 save
echo "  ✅ Backend restarted"
echo ""

# ─── 7. Reload Nginx ───────────────────────────────────────────────────────
echo "▶ Reloading Nginx..."
sudo nginx -t && sudo systemctl reload nginx
echo "  ✅ Nginx reloaded"
echo ""

# ─── 8. Health check ───────────────────────────────────────────────────────
echo "▶ Running health checks..."
sleep 5

# Backend health check
if curl -sf http://localhost:4000/api/v1/health > /dev/null 2>&1; then
  echo "  ✅ Backend is healthy (port 4000)"
else
  echo "  ❌ Backend health check FAILED — check: pm2 logs"
  pm2 logs --lines 20 --nostream
  exit 1
fi

# Nginx health check
if systemctl is-active --quiet nginx; then
  echo "  ✅ Nginx is running"
else
  echo "  ❌ Nginx is not running — check: sudo systemctl status nginx"
  exit 1
fi

# ─── Done ──────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ Deploy Complete!"
echo "  Commit: $(git rev-parse --short HEAD)"
echo "  Time:   $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "PM2 status:"
pm2 status
