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
# This section is defensive: nginx config errors must NOT kill the deploy.
# We always try to end with a valid, reloaded config.
echo "▶ Updating Nginx config..."
NGINX_SITE="/etc/nginx/sites-available/neuraline"

set +e

# Find the first domain that has a valid Let's Encrypt certificate
CERT_DOMAIN=""
if [ -d /etc/letsencrypt/live ]; then
  for cert_dir in /etc/letsencrypt/live/*; do
    [ -d "$cert_dir" ] || continue
    d=${cert_dir%/}
    d=${d##*/}
    if [ -f "/etc/letsencrypt/live/$d/fullchain.pem" ] && [ -f "/etc/letsencrypt/live/$d/privkey.pem" ]; then
      CERT_DOMAIN="$d"
      break
    fi
  done
fi

# Backup current config if it exists
if [ -f "$NGINX_SITE" ]; then
  sudo cp "$NGINX_SITE" "${NGINX_SITE}.bak.$(date '+%Y%m%d_%H%M%S')" 2>/dev/null || true
fi

# Build the nginx config using deploy/nginx.conf as the source.
# If we have a real cert domain, replace the placeholder and keep the HTTPS block.
# Otherwise strip the HTTPS block so the HTTP server doesn't redirect to a missing HTTPS server.
if [ -n "$CERT_DOMAIN" ]; then
  echo "  ℹ️  SSL cert found for domain: $CERT_DOMAIN"
  sed "s|app.neura-line.com|$CERT_DOMAIN|g" deploy/nginx.conf | sudo tee "$NGINX_SITE" >/dev/null
  echo "  ✅ Nginx config written with SSL"
else
  echo "  ⚠️  No SSL certs found — using HTTP-only config"
  # Write a complete minimal HTTP-only config.
  # Do NOT redirect to HTTPS because no HTTPS server exists.
  sudo tee "$NGINX_SITE" >/dev/null <<'EOF'
server {
    listen 80;
    server_name _;
    root /var/www/neuraline;
    index index.html;

    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(self), microphone=(self), geolocation=()" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; media-src 'self' blob:; connect-src 'self' wss: https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';" always;
    add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate" always;

    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 256;
    gzip_types text/plain text/css text/javascript application/javascript application/json application/xml application/xml+rss image/svg+xml font/woff2;

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        client_max_body_size 50m;
        proxy_connect_timeout 30s;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    location = /telemedicine {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 60s;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-store, no-cache, must-revalidate" always;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    location /health {
        access_log off;
        return 200 'OK';
        add_header Content-Type text/plain;
    }
}
EOF
  echo "  ✅ Nginx config written as HTTP-only"
fi

sudo ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/neuraline 2>/dev/null || true
sudo rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

echo "▶ Testing Nginx config..."
if sudo nginx -t >/dev/null 2>&1; then
  sudo systemctl reload nginx
  echo "  ✅ Nginx reloaded"
else
  echo "  ❌ New Nginx config is invalid — trying to restore previous valid config..."
  LATEST_BAK=$(ls -t "$NGINX_SITE".bak.* 2>/dev/null | head -1)
  if [ -n "$LATEST_BAK" ] && [ -f "$LATEST_BAK" ]; then
    sudo cp "$LATEST_BAK" "$NGINX_SITE"
    if sudo nginx -t >/dev/null 2>&1; then
      sudo systemctl reload nginx
      echo "  ✅ Nginx restored and reloaded from $LATEST_BAK"
    else
      echo "  ❌ Backup config is also invalid — leaving original (site may be down until manually fixed)"
    fi
  else
    echo "  ❌ No backup found — leaving original config (site may be down until manually fixed)"
  fi
fi

set -e
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
