# Neuraline EMR — AWS Deployment Guide

> **Status**: Planning document — implementation pending
> **Created**: 2026-07-12
> **Target**: HIPAA-compliant production deployment on AWS with custom domain

---

## Architecture Overview

```
Internet → Route 53 (domain) → ALB (HTTPS/443) → Nginx (frontend:3000)
                                              → API (backend:4000)
                                              ↘ PostgreSQL, Redis, Ollama, Whisper (internal only)
```

### Components

| Component | Technology | Port | Container | Purpose |
|-----------|-----------|------|-----------|---------|
| Frontend | React + Vite + Ant Design | 3000 | neuraline-frontend | Web UI (nginx-served) |
| Backend API | NestJS + TypeORM | 4000 | neuraline-api-gateway | REST API + WebSockets |
| Database | PostgreSQL 15 | 5432 | neuraline-postgres | Primary data store |
| Cache | Redis 7 | 6379 | neuraline-redis | Session + queue cache |
| Search | OpenSearch 2.11 | 9200 | neuraline-opensearch | Full-text search |
| Speech-to-Text | Whisper (FastAPI) | 8001 | neuraline-whisper | Audio transcription |
| LLM Inference | Ollama | 11434 | neuraline-ollama | Local AI models |
| Vector DB | ChromaDB | 8000 | neuraline-chromadb | Medical code embeddings |

---

## Recommended Approach: EC2 + Docker Compose

**Why this approach:**
- Existing `docker-compose.yml` works with minimal changes
- HIPAA-compliant with proper configuration (encryption, VPC, BAA)
- Most cost-effective for a single-practice EMR (~$134/month)
- Can migrate to ECS later when auto-scaling is needed

---

## Phase 1: AWS Account Setup & HIPAA

### 1.1 Sign BAA with AWS

HIPAA requires a Business Associate Agreement with AWS:
1. Go to **AWS Artifact** → **Business Associate Agreement** → sign it
2. This covers AWS services that handle PHI (EC2, RDS, S3, etc.)
3. Without a signed BAA, you're not HIPAA-compliant even with encryption

### 1.2 Create a dedicated VPC (network isolation)

```bash
# AWS Console → VPC → Create VPC
# OR via AWS CLI:
aws ec2 create-vpc --cidr-block 10.0.0.0/16 --tag-name "neuraline-vpc"

# Create public subnet (for ALB)
aws ec2 create-subnet --vpc-id <vpc-id> --cidr-block 10.0.1.0/24

# Create private subnet (for app + DB)
aws ec2 create-subnet --vpc-id <vpc-id> --cidr-block 10.0.2.0/24
```

### 1.3 Security Groups

| Group | Inbound | Outbound |
|-------|---------|----------|
| `alb-sg` | 80, 443 from 0.0.0.0/0 | All to `app-sg` |
| `app-sg` | 4000, 3000 from `alb-sg` | All to `db-sg`, internet (for pulls) |
| `db-sg` | 5432, 6379 from `app-sg` only | None |

---

## Phase 2: Provision EC2 Instance

### 2.1 Launch EC2

```
AMI:              Ubuntu Server 22.04 LTS (or Amazon Linux 2023)
Instance:         t3.xlarge (4 vCPU, 16GB RAM — needed for Ollama + Whisper)
                  t3.large (2 vCPU, 8GB) if skipping AI services initially
Storage:          100GB gp3 EBS (encrypted) — Docker images + Ollama models
                  + 50GB gp3 EBS (encrypted) — PostgreSQL data
VPC:              neuraline-vpc (private subnet)
EBS Encryption:   ENABLED (HIPAA requirement)
Elastic IP:       Allocate and attach (static public IP)
```

### 2.2 Connect & Install Docker

```bash
ssh -i your-key.pem ubuntu@<elastic-ip>

# Install Docker + Docker Compose
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
docker compose version
```

---

## Phase 3: Deploy Your App

### 3.1 Clone repo to EC2

```bash
git clone <your-repo-url> /opt/neuraline
cd /opt/neuraline
```

### 3.2 Create production `.env` file

```bash
cat > .env << 'EOF'
# ── PRODUCTION SECRETS (generate fresh) ──────────────────────────
# Generate: openssl rand -hex 32
ENCRYPTION_KEY=<paste 64-char hex here>
JWT_SECRET=<paste 32+ char string here>
JWT_REFRESH_SECRET=<paste different 32+ char string here>

# ── Database (use strong passwords) ──────────────────────────────
DB_USERNAME=neuraline_prod
DB_PASSWORD=<strong-password-here>
DB_DATABASE=neuraline
DB_SSL=true

# ── Redis ────────────────────────────────────────────────────────
REDIS_PASSWORD=<strong-password-here>

# ── CORS (your domain) ───────────────────────────────────────────
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# ── AI Services ──────────────────────────────────────────────────
OLLAMA_MODEL=mistral
WHISPER_SERVICE_URL=http://whisper-service:8001
CHROMA_URL=http://chromadb:8000

# ── OpenSearch ───────────────────────────────────────────────────
OPENSEARCH_NODE=http://opensearch:9200

# ── Email (production SMTP) ──────────────────────────────────────
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASSWORD=<smtp-password>
SMTP_FROM=Neuraline EMR <noreply@yourdomain.com>

# ── Storage (S3 for file uploads) ────────────────────────────────
STORAGE_TYPE=s3
AWS_S3_BUCKET=neuraline-uploads-yourdomain
AWS_S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
EOF
```

### 3.3 Update `docker-compose.yml` for production

Key changes needed:

```yaml
services:
  frontend:
    build:
      args:
        VITE_API_URL: /api/v1    # Relative path (nginx proxies)
    ports:
      - "3000:80"                # Only accessible internally
    restart: always

  api-gateway:
    environment:
      NODE_ENV: production
      DB_SSL: "true"
      DB_SSL_REJECT_UNAUTHORIZED: "false"
    restart: always

  postgres:
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    # Remove port mapping (internal only)
    # ports: - DO NOT expose 5432
    restart: always

  ollama:
    # For production, use a GPU instance (g4dn.xlarge) if budget allows
    # Or use AWS Bedrock for managed LLM (no Ollama needed)
    restart: always
```

### 3.4 Start everything

```bash
cd /opt/neuraline
docker compose up -d --build

# Check all services are healthy
docker compose ps
docker compose logs -f --tail=50
```

---

## Phase 4: HTTPS & Domain Setup

### 4.1 Request SSL Certificate (AWS Certificate Manager)

```
AWS Console → Certificate Manager → Request certificate
  → Request a public certificate
  → Domain name: yourdomain.com
  → Add another: *.yourdomain.com (wildcard for www)
  → Validation method: DNS
  → Click "Create"
```

ACM gives you CNAME records to add to GoDaddy for validation. Do this BEFORE creating the load balancer.

### 4.2 Configure DNS at GoDaddy

Log into GoDaddy → DNS Management for your domain:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `@` | `<ALB-DNS-name>` (from Step 4.4) | 600 |
| A | `www` | `<ALB-DNS-name>` | 600 |
| CNAME | `_acme-challenge` | `<ACM-validation-value>` | 3600 |

**OR (recommended):** Transfer DNS to Route 53 for better integration:

```
GoDaddy → Domain Settings → Manage DNS → Nameservers → Change
  → Custom nameservers:
    → ns-xxx.awsdns-xx.com (from Route 53 hosted zone)
    → ns-yyy.awsdns-yy.org
    → ns-zzz.awsdns-zz.net
```

### 4.3 Create Application Load Balancer (ALB)

```
AWS Console → EC2 → Load Balancers → Create → Application Load Balancer

Name: neuraline-alb
Scheme: internet-facing
IP type: IPv4
VPC: neuraline-vpc
Subnets: both public subnets

Security Group: alb-sg (ports 80, 443)

Listeners:
  → HTTPS:443 → Forward to target group
  → HTTP:80  → Redirect to HTTPS:443

SSL Certificate: Select the ACM certificate you created

Target Group:
  Name: neuraline-frontend
  Target type: Instance
  Protocol: HTTP
  Port: 3000
  Health check: GET /health
  Register your EC2 instance
```

### 4.4 Add ALB DNS to GoDaddy

After creating the ALB, you get a DNS name like:
```
neuraline-alb-1234567.us-east-1.elb.amazonaws.com
```

**Option A (simple — use GoDaddy DNS):**
```
GoDaddy → DNS → Add record:
  Type: CNAME
  Name: @ (or blank)
  Value: neuraline-alb-1234567.us-east-1.elb.amazonaws.com
```

**Option B (recommended — Route 53):**
```bash
# Create hosted zone
aws route53 create-hosted-zone --name yourdomain.com

# Create alias record (points to ALB)
aws route53 change-resource-record-sets --hosted-zone-id <zone-id> \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "yourdomain.com",
        "Type": "A",
        "AliasTarget": {
          "DNSName": "dualstack.neuraline-alb-xxx.us-east-1.elb.amazonaws.com",
          "EvaluateTargetHealth": true,
          "HostedZoneId": "Z35SXDOTRCQ5K4"
        }
      }
    }]
  }'

# Then update GoDaddy nameservers to Route 53
```

### 4.5 Configure ALB for API routing

Add listener rules on the ALB:

```
ALB → Listeners → HTTPS:443 → Rules:
  Rule 1: IF path /api/* THEN forward to neuraline-api target group (port 4000)
  Rule 2: IF path /ws* THEN forward to neuraline-api target group (port 4000)
  Default: forward to neuraline-frontend target group (port 3000)
```

This means:
- `https://yourdomain.com` → frontend (nginx)
- `https://yourdomain.com/api/v1/...` → backend (NestJS)
- `https://yourdomain.com/ws` → WebSocket

---

## Phase 5: HIPAA Hardening Checklist

### 5.1 Encryption
- [ ] EBS volumes encrypted (done at EC2 launch)
- [ ] HTTPS/TLS in transit (ALB + ACM certificate)
- [ ] RDS encryption — if you move PostgreSQL to RDS later
- [ ] S3 bucket encryption — for file uploads
- [ ] ENCRYPTION_KEY set in `.env` (64-char hex)

### 5.2 Access Control
- [ ] IAM roles — EC2 instance should use IAM role, not access keys
- [ ] Security groups — DB not exposed to internet
- [ ] SSH key — restrict to your IP only
- [ ] AWS CloudTrail — enable audit logging for all API calls

### 5.3 Backup & Disaster Recovery
```bash
# Automated PostgreSQL backup (add to cron)
0 2 * * * docker exec neuraline-postgres pg_dump -U neuraline_prod neuraline | gzip > /backups/db-$(date +\%Y\%m\%d).sql.gz

# Upload backups to S3 (encrypted)
aws s3 cp /backups/ s3://neuraline-backups/ --recursive --sse aws:kms
```

### 5.4 Monitoring
```bash
# Enable CloudWatch monitoring on EC2
# Set up alerts for:
#   - CPU > 80% for 5 min
#   - Disk space < 10%
#   - Health check failures
```

---

## Phase 6: Verify Deployment

```bash
# Test from your local machine
curl https://yourdomain.com/health
curl https://yourdomain.com/api/v1/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"dr.sarah.chen@neuraline.health","password":"Neuraline@2025"}'
```

---

## Cost Estimate

| Service | Monthly Cost |
|---------|-------------|
| EC2 t3.xlarge | ~$90 |
| EBS 150GB | ~$15 |
| ALB | ~$18 |
| Route 53 | ~$1 |
| S3 (backups + uploads) | ~$5 |
| CloudWatch | ~$5 |
| **Total (with AI)** | **~$134/month** |

Cheaper option (skip AI services initially):
- t3.large (~$45) + no Ollama/Whisper = **~$89/month**

---

## Implementation Checklist

- [ ] Sign BAA with AWS (AWS Artifact)
- [ ] Create VPC with public + private subnets
- [ ] Configure security groups (alb-sg, app-sg, db-sg)
- [ ] Launch EC2 (t3.xlarge, encrypted EBS, Elastic IP)
- [ ] Install Docker on EC2
- [ ] Clone repo and create production `.env`
- [ ] Update docker-compose for production
- [ ] `docker compose up -d --build`
- [ ] Request SSL certificate in ACM
- [ ] Add DNS validation CNAME to GoDaddy
- [ ] Create ALB with HTTPS listener
- [ ] Create target groups (frontend:3000, api:4000)
- [ ] Configure ALB listener rules (/api/* → backend, default → frontend)
- [ ] Point domain DNS to ALB
- [ ] Enable CloudTrail
- [ ] Set up automated DB backups to S3
- [ ] Configure CloudWatch alerts
- [ ] Test deployment: `curl https://yourdomain.com/health`

---

## Future: Migrate to ECS/Fargate

When you need auto-scaling or multi-instance:
1. Push Docker images to ECR (Elastic Container Registry)
2. Create ECS task definitions for each service
3. Use Fargate for serverless container execution
4. RDS for managed PostgreSQL (with automated backups)
5. ElastiCache for managed Redis
6. This removes the need to manage EC2 directly

## Future: Use AWS Bedrock for AI

Instead of running Ollama on EC2 (CPU-intensive):
- Use AWS Bedrock for managed LLM inference
- No GPU instance needed
- Pay-per-request pricing
- HIPAA-eligible service (covered under BAA)
- Update `OLLAMA_URL` or refactor AiService to call Bedrock API
