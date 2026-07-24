# Neuraline EMR — AWS Deployment Guide

> **Status**: Phase 1 — Active implementation
> **Created**: 2026-07-12
> **Updated**: 2026-07-19
> **Target**: HIPAA-compliant production deployment on AWS (Phase 1: managed services, no Docker)

---

## Architecture Overview — Phase 1 (First 12 Months)

```
                        Internet
                           │
                    Route 53 (DNS)
                    yourdomain.com
                           │
                    ┌──────┴──────┐
                    │  Nginx:80   │  (free SSL via Let's Encrypt)
                    │  /var/www   │  (frontend static files)
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
         static files   /api/*      /api/*
         (React)        proxy       proxy
                       to 4000     to 4000
                           │
                    ┌──────┴──────┐
                    │  PM2 + Node │  (NestJS backend, no Docker)
                    │  port 4000  │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────────────┐
              │            │                    │
         RDS PostgreSQL  ElastiCache         External APIs:
         (free tier)     Redis (free)        ├─ Groq (LLM, free)
              │            │                 └─ AssemblyAI (transcription)
         PHI data      Sessions/queues           ($50 free credit)
```

### Components

| Component | Technology | Where | Cost (12 months) |
|-----------|-----------|-------|------------------|
| Frontend | React + Vite (static files) | EC2 Nginx `/var/www/neuraline` | $0 (free tier) |
| Backend API | NestJS + TypeORM | EC2 PM2 (Node.js, no Docker) | $0 (free tier) |
| Database | PostgreSQL 15 | RDS t3.micro | $0 (free tier 12mo) |
| Cache | Redis 7 | ElastiCache t3.micro | $0 (free tier 12mo) |
| LLM | Groq API (Llama 3.3 70B) | External (Groq cloud) | $0 (free tier) |
| Transcription | AssemblyAI (medical-v1) | External (AssemblyAI cloud) | $0 ($50 credit) |
| DNS | Route 53 | AWS | ~$0.50/mo |
| Encryption | KMS | AWS | ~$1.00/mo |
| **Total** | | | **~$1.50/mo** |

> **No Docker in production.** Docker is used for local development only (`docker-compose.yml`).
> Production runs Node.js natively on EC2 with PM2 process manager + Nginx reverse proxy.

### Why No Docker in Production?

| Factor | Docker (all-in-EC2) | Managed Services (Phase 1) |
|--------|---------------------|---------------------------|
| Containers to manage | 6 | 0 |
| RAM needed | ~6GB (t3.large $30/mo) | ~400MB (t3.micro $0 free tier) |
| DB backups | Manual (cron pg_dump) | Automatic (RDS) |
| DB patching | Manual | Automatic (RDS) |
| Redis HA | None | Built-in (ElastiCache) |
| AI cost | $200-400/mo (GPU for Ollama) | $0 (Groq free) |
| **Total cost** | **~$134-430/mo** | **~$1.50/mo** |

### When to Revisit

| Trigger | Action |
|---------|--------|
| Free tier expires (month 12) | RDS + Redis + EC2 = ~$41/mo |
| Real PHI in production | Switch Groq → Bedrock+Claude (BAA covered) |
| >500 AI requests/day | Compare Bedrock cost vs self-hosted Ollama on GPU |
| >100 providers | Move backend to ECS Fargate (auto-scaling) |

---

## Phase 1: AWS Account Setup & HIPAA

### 1.1 Sign BAA with AWS

HIPAA requires a Business Associate Agreement with AWS:
1. Go to **AWS Artifact** → **Business Associate Agreement** → sign it
2. This covers AWS services that handle PHI (EC2, RDS, S3, KMS, etc.)
3. Without a signed BAA, you're not HIPAA-compliant even with encryption

### 1.2 Create a VPC (network isolation)

```
AWS Console → VPC → Create VPC
  → VPC and more
  → Name: neuraline
  → IPv4 CIDR: 10.0.0.0/16
  → Availability Zones: 2 (us-east-1a, us-east-1b)
  → Public subnets: 10.0.1.0/24, 10.0.2.0/24
  → Private subnets: 10.0.3.0/24, 10.0.4.0/24
  → NAT gateway: None (save cost — EC2 will be in public subnet for now)
  → Create
```

### 1.3 Security Groups

Create three security groups:

| Group | Inbound | Outbound | Purpose |
|-------|---------|----------|---------|
| `ec2-sg` | 22 (SSH from your IP), 80, 443 (from 0.0.0.0/0) | All | EC2 instance |
| `rds-sg` | 5432 from `ec2-sg` only | None | RDS PostgreSQL |
| `redis-sg` | 6379 from `ec2-sg` only | None | ElastiCache Redis |

> **HIPAA**: Database and Redis must NEVER be accessible from the internet.
> Only the EC2 instance can reach them (via security group references).

---

## Phase 2: Provision AWS Managed Services

### 2.1 Create RDS PostgreSQL (Free Tier)

```
AWS Console → RDS → Create database
  → Engine: PostgreSQL 15
  → Free tier: ✅ Enabled
  → DB instance identifier: neuraline-db
  → Master username: neuraline
  → Master password: <strong-password>
  → Instance class: db.t3.micro (1 vCPU, 1GB RAM — free tier)
  → Storage: 20GB gp3 (free tier includes 20GB)
  → VPC: neuraline-vpc
  → Subnet group: private subnets
  → Security group: rds-sg
  → Public access: NO (HIPAA — private only)
  → Encryption: ENABLED (KMS — HIPAA requirement)
  → Backup retention: 7 days (free tier includes automated backups)
  → Create
```

Wait ~5-10 minutes for RDS to be available. Note the endpoint:
```
neuraline-db.xxxxx.us-east-1.rds.amazonaws.com:5432
```

### 2.2 Create ElastiCache Redis (Free Tier)

```
AWS Console → ElastiCache → Redis → Create
  → Cluster mode: Disabled
  → Engine: Redis 7
  → Free tier: ✅ (node type: cache.t3.micro)
  → Cluster name: neuraline-redis
  → Node type: cache.t3.micro (free tier)
  → VPC: neuraline-vpc
  → Subnet group: private subnets
  → Security group: redis-sg
  → Encryption at rest: ENABLED (HIPAA)
  → Encryption in transit: ENABLED (HIPAA)
  → Create
```

Note the endpoint:
```
neuraline-redis.xxxxx.0001.use1.cache.amazonaws.com:6379
```

### 2.3 Launch EC2 Instance (Free Tier)

```
AWS Console → EC2 → Launch instance
  → Name: neuraline-app
  → AMI: Ubuntu Server 24.04 LTS
  → Instance type: t3.micro (1 vCPU, 1GB RAM — free tier)
  → Key pair: Create new (save the .pem file!)
  → VPC: neuraline-vpc
  → Subnet: public subnet
  → Auto-assign public IP: Enable
  → Security group: ec2-sg
  → Storage: 30GB gp3, ENCRYPTED (HIPAA)
  → Advanced → IAM role: Create role with S3 + KMS access
  → Launch
```

After launch, allocate an Elastic IP and associate it:
```
AWS Console → EC2 → Elastic IPs → Allocate
  → Associate with neuraline-app instance
```

Note your Elastic IP — this is your server's static public IP.

---

## Phase 3: Connect GoDaddy Domain to AWS Route 53

### 3.1 Create Route 53 Hosted Zone

```
AWS Console → Route 53 → Hosted zones → Create hosted zone
  → Domain name: yourdomain.com  (the domain you bought from GoDaddy)
  → Type: Public hosted zone
  → Create
```

Route 53 will display a **NS (Nameserver) record** with 4 values:
```
ns-1234.awsdns-12.com.
ns-5678.awsdns-34.org.
ns-9012.awsdns-56.net.
ns-3456.awsdns-78.co.uk.
```

**Copy these 4 nameservers** — you'll paste them into GoDaddy.

### 3.2 Update GoDaddy Nameservers

1. Log into **GoDaddy** → https://dcc.godaddy.com/manage/
2. Click your domain → **DNS** → **Manage DNS**
3. Scroll down to **Nameservers** → **Change**
4. Select **Custom** (not GoDaddy default)
5. Paste the 4 Route 53 nameservers:
   ```
   ns-1234.awsdns-12.com
   ns-5678.awsdns-34.org
   ns-9012.awsdns-56.net
   ns-3456.awsdns-78.co.uk
   ```
6. Click **Save**

> **Propagation time**: DNS changes take 15 min to 48 hours to propagate globally.
> Usually it's done within 30-60 minutes. You can check with:
> ```bash
> dig NS yourdomain.com
> # or
> nslookup -type=NS yourdomain.com
> ```

### 3.3 Create DNS Records in Route 53

Once the nameservers have propagated, create an A record pointing to your EC2:

```
AWS Console → Route 53 → yourdomain.com → Create record

Record 1 (apex domain):
  → Record name: (leave blank = yourdomain.com)
  → Record type: A
  → Value: <your-EC2-Elastic-IP>
  → TTL: 300
  → Create

Record 2 (www subdomain):
  → Record name: www
  → Record type: A
  → Value: <your-EC2-Elastic-IP>
  → TTL: 300
  → Create
```

### 3.4 Verify DNS

```bash
# Wait a few minutes, then test:
dig A yourdomain.com
# Should return your EC2 Elastic IP

curl http://yourdomain.com/health
# Should return "OK" (after EC2 setup is complete)
```

### 3.5 Why Route 53 Instead of GoDaddy DNS Directly?

| Factor | GoDaddy DNS | Route 53 |
|--------|-------------|----------|
| Cost | Free with domain | $0.50/mo |
| Integration with AWS | Manual record management | Native AWS integration |
| Health checks | Not included | Built-in health checks + failover |
| Latency-based routing | Not available | Available |
| TTL minimum | 600 seconds | 0 seconds (Alias records) |
| Wildcard SSL | Harder | Easy with ACM + ALB |

**Recommendation**: Use Route 53 for DNS management. The $0.50/month is worth the AWS integration.

---

## Phase 4: EC2 Server Setup

### 4.1 Connect to EC2

```bash
# From your local machine
ssh -i your-key.pem ubuntu@<your-elastic-ip>
```

### 4.2 Run the Setup Script

The setup script installs Node.js, PM2, Nginx, clones your repo, and starts everything:

```bash
# Download and run the setup script
cd /opt
sudo mkdir -p neuraline
sudo chown ubuntu:ubuntu neuraline
cd /opt/neuraline

# Clone your repo
git clone https://github.com/your-org/neuraline.git .

# Run setup
chmod +x deploy/setup-ec2.sh
./deploy/setup-ec2.sh
```

The script automatically:
- ✅ Adds 2GB swap (t3.micro needs this for npm install)
- ✅ Installs Node.js 20 + PM2 + Nginx + Certbot
- ✅ Clones your repo to `/opt/neuraline`
- ✅ Installs npm dependencies
- ✅ Builds frontend + backend
- ✅ Copies frontend to `/var/www/neuraline`
- ✅ Configures Nginx (reverse proxy + static files)
- ✅ Starts backend with PM2
- ✅ Runs health checks

### 4.3 Configure Production `.env`

After setup, edit the `.env` file with your production values:

```bash
nano /opt/neuraline/.env
```

```env
# ── Database (RDS) ────────────────────────────────────────────
DB_HOST=neuraline-db.xxxxx.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_DATABASE=neuraline
DB_USERNAME=neuraline
DB_PASSWORD=<your-rds-password>
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=true

# ── Redis (ElastiCache) ───────────────────────────────────────
REDIS_HOST=neuraline-redis.xxxxx.0001.use1.cache.amazonaws.com
REDIS_PORT=6379
REDIS_PASSWORD=<your-redis-auth-token>

# ── HIPAA: PHI Encryption Key ─────────────────────────────────
# Generate with: openssl rand -hex 32
ENCRYPTION_KEY=<64-char-hex-string>

# ── JWT ───────────────────────────────────────────────────────
JWT_SECRET=<generate: openssl rand -base64 48>
JWT_REFRESH_SECRET=<generate: openssl rand -base64 48>

# ── AI Services ───────────────────────────────────────────────
AI_PROVIDER=groq
GROQ_API_KEY=<your-groq-api-key>
GROQ_MODEL=llama-3.3-70b-versatile

# AssemblyAI (transcription)
ASSEMBLYAI_API_KEY=<your-assemblyai-api-key>

# ── CORS ──────────────────────────────────────────────────────
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# ── Node Environment ──────────────────────────────────────────
NODE_ENV=production
PORT=4000
```

After editing `.env`, run database migrations (creates all tables), then start the backend:
```bash
# 1. Run migrations (creates all 22 tables from backend/src/migrations/)
cd /opt/neuraline/backend
npx typeorm migration:run -d src/config/database.config.ts

# 2. Start the backend with PM2
cd /opt/neuraline
pm2 start deploy/ecosystem.config.js
pm2 save
```

> **Important**: `DB_SYNCHRONIZE=false` in production (per `AGENTS.md`). The app will NOT create tables automatically — you MUST run migrations. There are 22 migration files in `backend/src/migrations/` that must be applied. If you skip this step, the backend will start but every database query will fail.

### 4.4 Set Up SSL (Free Let's Encrypt)

Once DNS is pointing to your EC2 (Phase 3 complete):

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot will:
- Automatically verify domain ownership
- Generate SSL certificate (free)
- Update Nginx config to use HTTPS
- Set up auto-renewal (cron job)

### 4.5 Verify Deployment

```bash
# Backend health
curl http://localhost:4000/
pm2 status

# Nginx
sudo systemctl status nginx

# From your local machine (external)
curl https://yourdomain.com/health
curl https://yourdomain.com/api/v1/ai/health
```

---

## Phase 5: CI/CD — GitHub Actions (No Jenkins)

### 5.1 How It Works

```
Developer pushes to main
  → GitHub Actions ci-pipeline.yml runs automatically:
    ├─ Lint + Typecheck
    ├─ Vitest (frontend unit tests)
    ├─ Jest (backend unit tests)
    ├─ Jest E2E (with Postgres + Redis)
    └─ Build verification
  → All checks pass ✅

Developer clicks "Run workflow" in GitHub UI
  → GitHub Actions deploy.yml runs:
    ├─ Verifies CI passed on this commit
    ├─ SSH into EC2
    └─ Runs deploy.sh (git pull + build + pm2 restart)
  → Deploy complete ✅
```

### 5.2 GitHub Secrets to Configure

In your GitHub repo → Settings → Secrets and variables → Actions:

| Secret Name | Value |
|---|---|
| `AWS_EC2_HOST` | Your EC2 Elastic IP (e.g., `12.34.56.78`) |
| `AWS_EC2_USER` | `ubuntu` |
| `AWS_SSH_PRIVATE_KEY` | Full contents of your EC2 `.pem` file |

### 5.3 How to Deploy

1. Push code to `main` branch
2. Wait for CI pipeline to pass (green checkmark ✅)
3. Go to GitHub → **Actions** tab → **"Deploy to AWS"** workflow
4. Click **"Run workflow"** → select `production` → click green button
5. Watch the deployment logs in real-time
6. Done — your site is updated

### 5.4 Manual Deploy (without GitHub Actions)

If you need to deploy manually (e.g., debugging):

```bash
ssh -i your-key.pem ubuntu@<your-elastic-ip>
cd /opt/neuraline
./deploy/deploy.sh
```

### 5.5 Why GitHub Actions Instead of Jenkins?

| Factor | GitHub Actions | Jenkins |
|--------|---------------|---------|
| Cost | $0 (2,000 min/mo free) | ~$20-23/mo (EC2 for Jenkins server) |
| Maintenance | Zero (GitHub manages) | You patch, update, secure Jenkins |
| Setup time | 30 min (1 YAML file) | 4-8 hours (install, plugins, config) |
| Existing integration | Already have ci-pipeline.yml | Would need webhook + Jenkinsfile |
| HIPAA scope | Ephemeral runners (not in your VPC) | Jenkins server = part of audit surface |
| Manual trigger | "Run workflow" button | "Build Now" button |

**Jenkins is open source (free software), but the EC2 instance to run it costs ~$20-23/month.
GitHub Actions gives you the same functionality for $0 with zero maintenance.**

---

## Phase 6: HIPAA Hardening Checklist

### 6.1 Encryption
- [ ] Sign BAA with AWS (AWS Artifact)
- [ ] EBS volume encrypted (done at EC2 launch)
- [ ] RDS encryption enabled (done at RDS creation)
- [ ] ElastiCache encryption at rest + in transit (done at creation)
- [ ] KMS key created for PHI encryption
- [ ] ENCRYPTION_KEY set in `.env` (64-char hex)
- [ ] HTTPS/TLS via Let's Encrypt (Phase 4.4)

### 6.2 Access Control
- [ ] Security groups: RDS + Redis NOT accessible from internet
- [ ] SSH access restricted to your IP only (ec2-sg inbound rule)
- [ ] IAM role on EC2 (not access keys in .env for AWS services)
- [ ] AWS CloudTrail enabled (audit all API calls)
- [ ] Strong passwords for RDS + Redis

### 6.3 Backup & Disaster Recovery
- [ ] RDS automated backups (7-day retention — free tier)
- [ ] RDS manual snapshot before major deploys
- [ ] S3 bucket for file uploads (encrypted, versioned)
- [ ] Test restore from backup quarterly

### 6.4 Monitoring
- [ ] CloudWatch alarms: CPU > 80%, disk < 10%, health check failures
- [ ] PM2 logs: `/var/log/neuraline/backend-*.log`
- [ ] Nginx logs: `/var/log/nginx/access.log`, `error.log`
- [ ] AWS CloudTrail: audit all API calls

---

## Phase 7: Cost Breakdown

### First 12 Months (Free Tier)

| Service | AWS Free Tier | Monthly Cost |
|---------|---------------|--------------|
| EC2 t3.micro | 750 hrs/mo (24/7) | $0 |
| RDS PostgreSQL t3.micro | 750 hrs/mo + 20GB | $0 |
| ElastiCache Redis t3.micro | 750 hrs/mo | $0 |
| S3 (5GB) | 5GB + 20K GET + 2K PUT | $0 |
| CloudFront (1TB transfer) | 1TB + 10M requests | $0 |
| Data transfer | 100GB/mo out | $0 |
| Route 53 (hosted zone) | Not free | $0.50 |
| KMS (encryption key) | 1 free key, then $1/key | $1.00 |
| **AWS subtotal** | | **$1.50/mo** |
| Groq LLM (free tier) | 14,400 req/day | $0 |
| AssemblyAI ($50 credit) | ~135 hours audio | $0 (until credit exhausted) |
| **Total (first 12 months)** | | **~$1.50/mo** |

### After 12 Months (Free Tier Expires)

| Service | Monthly Cost |
|---------|--------------|
| EC2 t3.micro | ~$8 |
| RDS PostgreSQL t3.micro | ~$18 |
| ElastiCache Redis t3.micro | ~$15 |
| Route 53 | $0.50 |
| KMS | $1.00 |
| S3 + CloudFront | ~$3 |
| **AWS subtotal** | **~$45.50/mo** |
| Groq (free) → Bedrock (pay-per-use) | ~$5-20 |
| AssemblyAI (pay-per-use) | ~$5-20 |
| **Total (after 12 months)** | **~$55-85/mo** |

---

## Implementation Checklist

### AWS Setup
- [ ] Sign BAA with AWS (AWS Artifact)
- [ ] Create VPC with public + private subnets
- [ ] Create security groups (ec2-sg, rds-sg, redis-sg)
- [ ] Create RDS PostgreSQL (free tier, encrypted, private subnet)
- [ ] Create ElastiCache Redis (free tier, encrypted, private subnet)
- [ ] Launch EC2 t3.micro (Ubuntu 24.04, encrypted EBS, Elastic IP)

### DNS (GoDaddy → Route 53)
- [ ] Create Route 53 hosted zone for your domain
- [ ] Copy 4 NS records from Route 53
- [ ] Update GoDaddy nameservers to Route 53 NS records
- [ ] Wait for DNS propagation (15 min - 48 hrs)
- [ ] Create A record in Route 53 → EC2 Elastic IP
- [ ] Verify: `dig A yourdomain.com` returns EC2 IP

### EC2 Setup
- [ ] SSH into EC2
- [ ] Run `deploy/setup-ec2.sh`
- [ ] Edit `/opt/neuraline/.env` with RDS + Redis + AI credentials
- [ ] Run migrations: `cd /opt/neuraline/backend && npx typeorm migration:run -d src/config/database.config.ts`
- [ ] Start PM2: `cd /opt/neuraline && pm2 start deploy/ecosystem.config.js && pm2 save`
- [ ] Set up SSL: `sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com`
- [ ] Verify: `curl https://yourdomain.com/health`

### CI/CD
- [ ] Add GitHub secrets: AWS_EC2_HOST, AWS_EC2_USER, AWS_SSH_PRIVATE_KEY
- [ ] Push to main → verify CI pipeline passes
- [ ] Click "Run workflow" in GitHub Actions → verify deploy succeeds
- [ ] Test: `curl https://yourdomain.com/api/v1/ai/health`

### HIPAA
- [ ] Enable CloudTrail (audit logging)
- [ ] Set up CloudWatch alarms (CPU, disk, health)
- [ ] Test RDS backup restore
- [ ] Document incident response procedure

---

## Files Created for Deployment

| File | Purpose |
|------|---------|
| `deploy/setup-ec2.sh` | One-time EC2 setup script (Node.js, PM2, Nginx, build) |
| `deploy/deploy.sh` | Deploy script (git pull, build, restart — run on each release) |
| `deploy/ecosystem.config.js` | PM2 config for NestJS backend process |
| `deploy/nginx.conf` | Nginx config (reverse proxy + static files + security headers) |
| `.github/workflows/deploy.yml` | GitHub Actions manual deploy workflow |

---

## Future: Phase 2 (Month 12+)

When free tier expires or scale demands:

| Change | When | Why |
|--------|------|-----|
| Switch Groq → Bedrock+Claude | Real PHI in production | HIPAA BAA coverage |
| Add `bedrock` provider to `ai.service.ts` | Before switching | Code already structured for it |
| EC2 t3.micro → t3.small or ECS Fargate | >100 providers | More RAM / auto-scaling |
| RDS t3.micro → t3.small | DB performance issues | More DB RAM |
| Add CloudFront in front of EC2 | Global users | CDN + DDoS protection |
| Add RDS read replica | High read load | Scale reads |
| Self-host Ollama on GPU EC2 | >500 AI req/day | Cheaper than Bedrock at scale |
