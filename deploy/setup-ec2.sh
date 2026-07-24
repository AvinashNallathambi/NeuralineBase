#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# Neuraline EMR — EC2 One-Time Setup Script
# Run this ONCE on a fresh Ubuntu 22.04/24.04 EC2 instance.
#
# Architecture: Phase 1 (No Docker in production)
#   - Node.js + PM2 for NestJS backend
#   - Nginx for reverse proxy + serving frontend static files
#   - RDS for PostgreSQL, ElastiCache for Redis (external)
#   - Groq for LLM, AssemblyAI for transcription (external APIs)
#
# Usage:
#   ssh ubuntu@YOUR_EC2_IP
#   wget -O setup-ec2.sh https://raw.githubusercontent.com/your-org/neuraline/main/deploy/setup-ec2.sh
#   chmod +x setup-ec2.sh
#   ./setup-ec2.sh
# ═══════════════════════════════════════════════════════════════════════════

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  Neuraline EMR — EC2 Setup (Phase 1: No Docker)"
echo "═══════════════════════════════════════════════════════════"
echo ""

# ─── 1. System Update ──────────────────────────────────────────────────────
echo "▶ Updating system packages..."
sudo apt-get update -y
sudo apt-get upgrade -y

# ─── 2. Add Swap (t3.micro has only 1GB RAM — needed for npm install) ─────
echo ""
echo "▶ Adding 2GB swap (t3.micro needs this for npm install/build)..."
if [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  echo "  ✅ Swap enabled (2GB)"
else
  echo "  ⏭️  Swap already exists"
fi

# ─── 3. Install Node.js 20 ────────────────────────────────────────────────
echo ""
echo "▶ Installing Node.js 20..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
  echo "  ✅ Node.js $(node --version) installed"
else
  echo "  ⏭️  Node.js already installed: $(node --version)"
fi

# ─── 4. Install PM2 (process manager for NestJS) ──────────────────────────
echo ""
echo "▶ Installing PM2..."
if ! command -v pm2 &> /dev/null; then
  sudo npm install -g pm2
  echo "  ✅ PM2 installed"
else
  echo "  ⏭️  PM2 already installed"
fi

# ─── 5. Install Nginx (reverse proxy + static file serving) ───────────────
echo ""
echo "▶ Installing Nginx..."
if ! command -v nginx &> /dev/null; then
  sudo apt-get install -y nginx
  echo "  ✅ Nginx installed"
else
  echo "  ⏭️  Nginx already installed"
fi

# ─── 6. Install Certbot (free SSL via Let's Encrypt) ──────────────────────
echo ""
echo "▶ Installing Certbot for SSL..."
sudo apt-get install -y certbot python3-certbot-nginx
echo "  ✅ Certbot installed"

# ─── 7. Create application directory ──────────────────────────────────────
echo ""
echo "▶ Creating application directory..."
APP_DIR="/opt/neuraline"
sudo mkdir -p "$APP_DIR"
sudo chown -R ubuntu:ubuntu "$APP_DIR"
echo "  ✅ App directory: $APP_DIR"

# ─── 8. Clone repository ──────────────────────────────────────────────────
echo ""
echo "▶ Cloning repository..."
cd "$APP_DIR"
if [ -d ".git" ]; then
  echo "  ⏭️  Repository already exists at $APP_DIR"
else
  read -p "  Enter your GitHub repo URL (https://github.com/your-org/neuraline.git): " REPO_URL
  git clone "$REPO_URL" .
  echo "  ✅ Repository cloned"
fi

# ─── 9. Install dependencies ──────────────────────────────────────────────
echo ""
echo "▶ Installing npm dependencies (this may take a few minutes)..."
npm ci || npm install
echo "  ✅ Dependencies installed"

# ─── 9b. Create log directory for PM2 ─────────────────────────────────────
echo ""
echo "▶ Creating PM2 log directory..."
sudo mkdir -p /var/log/neuraline
sudo chown -R ubuntu:ubuntu /var/log/neuraline
echo "  ✅ Log directory ready"

# ─── 10. Create .env from template ────────────────────────────────────────
echo ""
echo "▶ Setting up environment variables..."
if [ ! -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
  echo "  ⚠️  .env created from template — YOU MUST EDIT IT with production values:"
  echo "     nano $APP_DIR/.env"
  echo ""
  echo "  Required production values:"
  echo "    DB_HOST=your-rds-endpoint.rds.amazonaws.com"
  echo "    DB_PASSWORD=<your-strong-rds-password>"
  echo "    REDIS_HOST=your-elasticache-endpoint.cache.amazonaws.com"
  echo "    REDIS_PASSWORD=<your-redis-auth-token>"
  echo "    AI_PROVIDER=groq"
  echo "    GROQ_API_KEY=<your-groq-key>"
  echo "    ASSEMBLYAI_API_KEY=<your-assemblyai-key>"
  echo "    JWT_SECRET=<generate-with: openssl rand -base64 48>"
  echo "    ENCRYPTION_KEY=<generate-with: openssl rand -hex 32>"
else
  echo "  ⏭️  .env already exists"
fi

# ─── 11. Build the application ────────────────────────────────────────────
echo ""
echo "▶ Building backend and frontend..."
npm run build:backend
npm run build:frontend
echo "  ✅ Build complete"

# ─── 11b. Prune devDependencies (not needed at runtime) ───────────────────
echo ""
echo "▶ Pruning devDependencies (smaller footprint for t3.micro)..."
npm prune --omit=dev 2>/dev/null || true
echo "  ✅ Pruned"

# ─── 12. Copy frontend to Nginx serve directory ───────────────────────────
echo ""
echo "▶ Copying frontend build to Nginx directory..."
FRONTEND_DIR="/var/www/neuraline"
sudo mkdir -p "$FRONTEND_DIR"
sudo cp -r "$APP_DIR/frontend/dist/"* "$FRONTEND_DIR/"
sudo chown -R www-data:www-data "$FRONTEND_DIR"
echo "  ✅ Frontend deployed to $FRONTEND_DIR"

# ─── 13. Configure Nginx ──────────────────────────────────────────────────
echo ""
echo "▶ Configuring Nginx..."
NGINX_CONF="/etc/nginx/sites-available/neuraline"
sudo cp "$APP_DIR/deploy/nginx.conf" "$NGINX_CONF"
sudo ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/neuraline
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
echo "  ✅ Nginx configured"

# ─── 14. Start backend with PM2 ───────────────────────────────────────────
# NOTE: We do NOT auto-start PM2 here because .env is still the template
# (no real RDS/Redis creds). The user must:
#   1. Edit .env with production values
#   2. Run database migrations
#   3. THEN start PM2
# See the NEXT STEPS section at the end of this script.
echo ""
echo "▶ Configuring PM2 startup (backend will be started after .env is configured)..."
pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -1 | sudo bash || true
echo "  ✅ PM2 startup configured (start backend manually after .env + migrations)"

# ─── 15. Verify ───────────────────────────────────────────────────────────
echo ""
echo "▶ Verifying setup..."

echo "  Nginx status:"
if systemctl is-active --quiet nginx; then
  echo "  ✅ Nginx is running"
else
  echo "  ❌ Nginx is not running — check: sudo systemctl status nginx"
fi

echo "  Frontend served:"
if curl -s http://localhost/ | grep -q "html"; then
  echo "  ✅ Frontend is being served by Nginx"
else
  echo "  ⚠️  Frontend may not be ready — check: sudo systemctl status nginx"
fi

# ─── Done ──────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ Setup Complete!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "NEXT STEPS:"
echo ""
echo "1. Edit .env with production values:"
echo "   nano /opt/neuraline/.env"
echo "   (DB_HOST, DB_PASSWORD, REDIS_HOST, REDIS_PASSWORD, JWT_SECRET,"
echo "    ENCRYPTION_KEY, GROQ_API_KEY, ASSEMBLYAI_API_KEY, CORS_ORIGINS)"
echo ""
echo "2. Run database migrations (creates all tables):"
echo "   cd /opt/neuraline/backend"
echo "   npx typeorm migration:run -d src/config/database.config.ts"
echo ""
echo "3. Start the backend with PM2:"
echo "   cd /opt/neuraline"
echo "   pm2 start deploy/ecosystem.config.js"
echo "   pm2 save"
echo ""
echo "4. Verify backend is running:"
echo "   curl http://localhost:4000/"
echo "   pm2 status"
echo ""
echo "5. Set up SSL with your domain:"
echo "   sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com"
echo ""
echo "6. Verify your site is accessible:"
echo "   https://yourdomain.com/health"
echo ""
echo "7. Configure GitHub Actions secrets for automated deploys:"
echo "   AWS_EC2_HOST, AWS_EC2_USER, AWS_SSH_PRIVATE_KEY"
echo ""
echo "Useful commands:"
echo "   pm2 status          # check backend process"
echo "   pm2 logs            # view backend logs"
echo "   sudo nginx -t       # test nginx config"
echo "   sudo systemctl restart nginx  # restart nginx"
echo ""
