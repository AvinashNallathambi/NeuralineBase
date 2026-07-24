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

cd "$APP_DIR"

echo "═══════════════════════════════════════════════════════════"
echo "  Neuraline EMR — Deploying $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════════════════"
echo ""

# ─── 1. Pull latest code ───────────────────────────────────────────────────
echo "▶ Pulling latest code from git..."
git pull origin main
echo "  Current commit: $(git rev-parse --short HEAD)"
echo ""

# ─── 2. Install/update dependencies (full, incl. devDeps for build) ────────
echo "▶ Installing dependencies..."
npm ci 2>/dev/null || npm install
echo "  ✅ Dependencies updated"
echo ""

# ─── 3. Build backend ──────────────────────────────────────────────────────
echo "▶ Building backend..."
cd backend
npm run build
cd ..
echo "  ✅ Backend built"
echo ""

# ─── 4. Build frontend ─────────────────────────────────────────────────────
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

# ─── 4c. Run database migrations ───────────────────────────────────────────
echo "▶ Running database migrations..."
cd backend
npx typeorm migration:run -d src/config/database.config.ts
cd ..
echo "  ✅ Migrations applied"
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
if curl -sf http://localhost:4000/ > /dev/null 2>&1; then
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
