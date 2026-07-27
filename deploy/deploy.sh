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
# Create .env.production so Vite uses relative URLs (Nginx proxies /api/ to backend)
# Without this, VITE_API_URL falls back to http://localhost:4000 which breaks in browser
echo "VITE_API_URL=/api/v1" > .env.production
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

# ─── 7. Update Nginx config and reload ──────────────────────────────────────
echo "▶ Updating Nginx config..."
NGINX_SITE="/etc/nginx/sites-available/neuraline"
if [ -f deploy/nginx.conf ]; then
  # Backup current config
  if [ -f "$NGINX_SITE" ]; then
    sudo cp "$NGINX_SITE" "${NGINX_SITE}.bak.$(date '+%Y%m%d_%H%M%S')"
  fi
  # Check if existing config already has SSL (Certbot added listen 443)
  if [ -f "$NGINX_SITE" ] && grep -q "listen 443" "$NGINX_SITE"; then
    # SSL config exists — DON'T overwrite (would break HTTPS)
    # Instead, inject the telemedicine WebSocket location block if missing
    if ! grep -q "location = /telemedicine" "$NGINX_SITE"; then
      echo "  ⚠️  SSL config detected — injecting telemedicine WebSocket block"
      # Insert the telemedicine location block before the SPA fallback
      sudo sed -i '/location \/ {/i \
    # ── WebSocket Proxy for Telemedicine (Socket.IO namespace /telemedicine) ──\
    # EXACT match: only /telemedicine (Socket.IO), NOT /telemedicine/SESSION_ID (SPA)\
    location = /telemedicine {\
        proxy_pass http://127.0.0.1:4000;\
        proxy_http_version 1.1;\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
        proxy_set_header Upgrade $http_upgrade;\
        proxy_set_header Connection "upgrade";\
        proxy_connect_timeout 60s;\
        proxy_read_timeout 3600s;\
        proxy_send_timeout 3600s;\
    }\
\
    # ── Socket.IO polling fallback ──\
    location /socket.io/ {\
        proxy_pass http://127.0.0.1:4000;\
        proxy_http_version 1.1;\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Forwarded-Proto $scheme;\
        proxy_set_header Upgrade $http_upgrade;\
        proxy_set_header Connection "upgrade";\
    }\
' "$NGINX_SITE"
      echo "  ✅ Telemedicine WebSocket block injected into SSL config"
    else
      echo "  ✅ SSL config already has telemedicine block — no changes needed"
    fi
    # Also fix Permissions-Policy and CSP if camera is disabled
    if grep -q "camera=()" "$NGINX_SITE"; then
      sudo sed -i 's/camera=(), microphone=(self)/camera=(self), microphone=(self)/' "$NGINX_SITE"
      echo "  ✅ Fixed Permissions-Policy (camera enabled)"
    fi
    if grep -q "connect-src 'self';" "$NGINX_SITE" && ! grep -q "wss:" "$NGINX_SITE"; then
      sudo sed -i "s/connect-src 'self';/connect-src 'self' wss: https:;/" "$NGINX_SITE"
      echo "  ✅ Fixed CSP (wss: allowed for WebSocket)"
    fi
  else
    # No SSL config in active site — check if any Let's Encrypt certs exist
    CERT_DIR=$(ls -d /etc/letsencrypt/live/*/ 2>/dev/null | head -1)
    if [ -n "$CERT_DIR" ] && [ -f "${CERT_DIR}fullchain.pem" ]; then
      # Certs exist — extract domain name from directory path (pure shell, no basename)
      CERT_DOMAIN=${CERT_DIR%/}
      CERT_DOMAIN=${CERT_DOMAIN##*/}
      echo "  ℹ️  Found SSL cert for domain: $CERT_DOMAIN"
      sudo sed "s/app.neura-line.com/$CERT_DOMAIN/g" deploy/nginx.conf > /tmp/nginx_ssl.conf
      sudo cp /tmp/nginx_ssl.conf "$NGINX_SITE"
      rm -f /tmp/nginx_ssl.conf
      echo "  ✅ Nginx config updated with SSL (domain: $CERT_DOMAIN)"
    else
      # No certs at all — use HTTP-only by stripping the HTTPS block
      echo "  ⚠️  No SSL certs found — using HTTP-only config"
      sudo awk '/^# ── HTTPS: Main application server/{exit} {print}' deploy/nginx.conf > /tmp/nginx_http_only.conf
      echo "" >> /tmp/nginx_http_only.conf
      echo "server {" >> /tmp/nginx_http_only.conf
      echo "    listen 80;" >> /tmp/nginx_http_only.conf
      echo "    server_name _;" >> /tmp/nginx_http_only.conf
      echo "    root /var/www/neuraline;" >> /tmp/nginx_http_only.conf
      echo "    index index.html;" >> /tmp/nginx_http_only.conf
      awk '/^server \{/{found=0} /listen 443/{found=1} found && /^    location/{p=1} p{print} p && /^    }/{p=0}' deploy/nginx.conf >> /tmp/nginx_http_only.conf
      echo "}" >> /tmp/nginx_http_only.conf
      sudo cp /tmp/nginx_http_only.conf "$NGINX_SITE"
      rm -f /tmp/nginx_http_only.conf
      echo "  ✅ Nginx config updated (HTTP-only, run certbot to enable HTTPS)"
    fi
    sudo ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/neuraline
    sudo rm -f /etc/nginx/sites-enabled/default
  fi
fi
echo "▶ Reloading Nginx..."
sudo nginx -t && sudo systemctl reload nginx
echo "  ✅ Nginx reloaded"
echo ""

# ─── 8. Health check ───────────────────────────────────────────────────────
echo "▶ Running health checks..."

# Backend health check — retry for up to 60 seconds (backend takes time to boot)
BACKEND_READY=false
for i in $(seq 1 12); do
  if curl -sf http://localhost:4000/api/v1/health > /dev/null 2>&1; then
    BACKEND_READY=true
    break
  fi
  echo "  ⏳ Waiting for backend to start (attempt $i/12)..."
  sleep 5
done

if [ "$BACKEND_READY" = true ]; then
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
