# Free Trial Architecture — 15-Day Separate Instance Strategy

> **Document Status**: Design Specification
> **Last Updated**: 2025
> **Applies To**: NeuralineBase EMR Platform
> **Compliance**: HIPAA, SOC 2

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Options](#2-architecture-options)
3. [Recommended Approach — Tiered Hybrid](#3-recommended-approach--tiered-hybrid)
4. [Trial Manager Service](#4-trial-manager-service)
5. [Trial Lifecycle](#5-trial-lifecycle)
6. [Docker Compose Template](#6-docker-compose-template)
7. [Provisioning Scripts](#7-provisioning-scripts)
8. [Auto-Expiry & Cleanup](#8-auto-expiry--cleanup)
9. [Upgrade / Conversion Path](#9-upgrade--conversion-path)
10. [Database Schema](#10-database-schema)
11. [API Endpoints](#11-api-endpoints)
12. [Frontend Trial Signup Flow](#12-frontend-trial-signup-flow)
13. [Security & Compliance](#13-security--compliance)
14. [Cost Estimates](#14-cost-estimates)
15. [Monitoring & Alerting](#15-monitoring--alerting)
16. [Implementation Checklist](#16-implementation-checklist)

---

## 1. Overview

NeuralineBase offers a 15-day free trial for prospective customers (clinics, hospitals, billing companies). This document describes the architecture for provisioning isolated trial instances, managing their lifecycle, and cleaning them up after expiration.

### Goals

- **Isolation**: Each trial instance must be isolated from production and from other trials (HIPAA requirement)
- **Automation**: Provisioning and teardown must be fully automated — no manual intervention
- **Cost efficiency**: Trials are free; infrastructure cost per trial should be minimal
- **Conversion path**: Seamless upgrade from trial to paid dedicated instance
- **Compliance**: All trial data must be securely deleted after expiration

### Constraints

- HIPAA compliance required (BAA must be in place before trial starts)
- Trial data is PHI if real patient data is entered — recommend demo data only
- Auto-expiry after 15 days with 7-day grace period before data deletion
- Resource limits per trial to prevent abuse

---

## 2. Architecture Options

### Option A: Shared Instance + Tenant Isolation (Cheapest)

```
┌─────────────────────────────────────────────────┐
│           Single NeuralineBase Instance           │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ Tenant A │  │ Tenant B │  │ Trial Tenant │  │
│  │ (Paid)   │  │ (Paid)   │  │ (15-day)     │  │
│  └──────────┘  └──────────┘  └──────────────┘  │
│              Shared PostgreSQL DB                 │
│         (Row-level isolation via tenant_id)       │
└─────────────────────────────────────────────────┘
```

| Attribute | Value |
|-----------|-------|
| Isolation | Logical only — all data in shared tables, filtered by `tenant_id` |
| Cost | ~$0 marginal (just a new row in tenants table) |
| HIPAA risk | Medium — noisy neighbor, shared resources |
| Teardown | Soft-delete tenant + cascade delete rows, or hard-delete after grace period |
| Best for | High-volume self-service trials (100s/day) |

### Option B: Shared Instance + Dedicated Schema per Trial (Mid-Tier)

```
┌─────────────────────────────────────────────────┐
│           Single NeuralineBase Instance           │
│  ┌─────────────┐  ┌──────────────────────────┐  │
│  │ Schema:     │  │ Schema: trial_abc123     │  │
│  │ public      │  │ (dedicated tables)       │  │
│  │ (paid users)│  │                          │  │
│  └─────────────┘  └──────────────────────────┘  │
│         PostgreSQL (multiple schemas)             │
└─────────────────────────────────────────────────┘
```

| Attribute | Value |
|-----------|-------|
| Isolation | Better — separate tables, easy to `DROP SCHEMA` for cleanup |
| Cost | Low — shared server, just extra schemas |
| HIPAA risk | Low-Medium — data physically separated |
| Teardown | `DROP SCHEMA trial_abc123 CASCADE` — instant, clean |
| Limit | PostgreSQL has a practical limit of ~1000-5000 schemas before performance degrades |
| Best for | Medium-volume trials (10s/day) with moderate compliance needs |

### Option C: Dedicated Docker Container per Trial (Recommended for HIPAA)

```
┌──────────────────────────────────────────────────┐
│              Trial Orchestration Layer             │
│         (Trial Manager Service + Docker API)       │
└──────────┬──────────────┬──────────────┬──────────┘
           │              │              │
    ┌──────▼──────┐ ┌─────▼───────┐ ┌────▼──────────┐
    │ Container:  │ │ Container:  │ │ Container:    │
    │ trial-abc   │ │ trial-xyz   │ │ trial-def     │
    │ DB: pg-abc  │ │ DB: pg-xyz  │ │ DB: pg-def    │
    │ Port: 5101  │ │ Port: 5102  │ │ Port: 5103    │
    │ Expires:    │ │ Expires:    │ │ Expires:      │
    │ Jan 15      │ │ Jan 16      │ │ Jan 17        │
    └─────────────┘ └─────────────┘ └───────────────┘
```

| Attribute | Value |
|-----------|-------|
| Isolation | Full — separate DB, separate app process, separate network |
| Cost | Medium — ~$5-15/trial in cloud resources (can use spot instances) |
| HIPAA risk | Very Low — complete isolation |
| Teardown | `docker compose down -v` — removes container + volumes |
| Scaling | Use Docker Swarm or Kubernetes for orchestration |
| Best for | Sales-assisted trials, enterprise prospects, HIPAA-sensitive deployments |

### Option D: Kubernetes Namespace per Trial (Enterprise-Grade)

```
┌──────────────────────────────────────────────────┐
│              Kubernetes Cluster                    │
│                                                    │
│  Namespace: prod          Namespace: trial-abc123  │
│  ┌────────────────┐       ┌──────────────────┐    │
│  │ NeuralineBase  │       │ NeuralineBase    │    │
│  │ + Postgres HA  │       │ + Postgres (1)   │    │
│  │ + Redis        │       │ + Redis (1)      │    │
│  │ + Ollama       │       │ + Ollama (shared)│    │
│  └────────────────┘       └──────────────────┘    │
│                           Expires: T+15 days      │
│                           Auto-deleted by CronJob │
└──────────────────────────────────────────────────┘
```

| Attribute | Value |
|-----------|-------|
| Isolation | Full — namespace-level RBAC, network policies, resource quotas |
| Cost | Medium-High — but K8s bin-packing makes it efficient |
| HIPAA risk | Very Low — network policies + RBAC + dedicated resources |
| Teardown | `kubectl delete namespace trial-abc123` — instant |
| Scaling | Best — K8s handles scheduling, auto-scaling, health checks |
| Best for | Large-scale production deployments with 100+ concurrent trials |

---

## 3. Recommended Approach — Tiered Hybrid

For NeuralineBase, we recommend a **tiered hybrid** approach that combines Option A and Option C based on the trial source:

```
┌─────────────────────────────────────────────────────────────┐
│                    Trial Request Flow                        │
│                                                              │
│  User signs up → Trial Manager decides:                      │
│                                                              │
│  ┌─────────────────┐     ┌──────────────────────────────┐   │
│  │ Self-Service    │     │ Sales-Assisted               │   │
│  │ (Web signup)    │     │ (Demo request)               │   │
│  │                 │     │                              │   │
│  │ → Option A      │     │ → Option C                   │   │
│  │   Shared inst.  │     │   Dedicated container        │   │
│  │   Tenant isol.  │     │   Full isolation             │   │
│  │   Auto-expiry   │     │   Auto-expiry                │   │
│  └─────────────────┘     └──────────────────────────────┘   │
│                                                              │
│  After 15 days:                                              │
│  → Convert to paid → Provision dedicated instance           │
│  → Don't convert → Auto-cleanup + data deletion              │
└─────────────────────────────────────────────────────────────┘
```

### Why this hybrid?

| Factor | Self-Service Trial | Sales-Assisted Trial |
|--------|-------------------|---------------------|
| Volume | High (100s/day) | Low (10s/week) |
| Isolation need | Medium | High (often enterprise) |
| Cost sensitivity | High | Low |
| Conversion rate | ~2-5% | ~20-40% |
| Best option | A (shared) | C (dedicated container) |

### Decision Matrix

```
Trial Request
    │
    ├── Source = "website_signup"?
    │   ├── YES → Volume check: >50 active trials?
    │   │         ├── YES → Option A (shared instance)
    │   │         └── NO  → Option C (dedicated container)
    │   └── NO
    │
    ├── Source = "sales_demo"?
    │   └── YES → Option C (dedicated container, always)
    │
    ├── Source = "partner_referral"?
    │   └── YES → Option C (dedicated container)
    │
    └── Default → Option A (shared instance)
```

---

## 4. Trial Manager Service

A new `TrialManagerModule` orchestrates the entire trial lifecycle.

### Module Structure

```
backend/src/modules/trial-manager/
├── trial-manager.module.ts
├── trial-manager.controller.ts
├── trial-manager.service.ts
├── docker-provisioner.service.ts
├── trial-expiry.service.ts
├── dto/
│   ├── create-trial.dto.ts
│   ├── trial-status.dto.ts
│   └── convert-trial.dto.ts
└── entities/
    └── trial-instance.entity.ts
```

### Trial Instance Entity

```typescript
@Entity('trial_instances')
export class TrialInstance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'organization_name', type: 'varchar', length: 255 })
  organizationName!: string;

  @Column({ name: 'contact_email', type: 'varchar', length: 255 })
  contactEmail!: string;

  @Column({ name: 'contact_name', type: 'varchar', length: 255 })
  contactName!: string;

  @Column({ name: 'contact_phone', type: 'varchar', length: 20, nullable: true })
  contactPhone!: string | null;

  @Column({ name: 'plan', type: 'varchar', length: 50, default: 'professional' })
  plan!: string; // 'professional', 'enterprise', 'billing_only'

  @Column({ name: 'isolation_type', type: 'varchar', length: 20 })
  isolationType!: string; // 'shared', 'dedicated'

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'pending' })
  status!: string; // 'pending', 'active', 'expiring', 'expired', 'converted', 'deleted'

  @Column({ name: 'trial_starts_at', type: 'timestamptz' })
  trialStartsAt!: Date;

  @Column({ name: 'trial_ends_at', type: 'timestamptz' })
  trialEndsAt!: Date;

  @Column({ name: 'grace_period_ends_at', type: 'timestamptz', nullable: true })
  gracePeriodEndsAt!: Date | null;

  @Column({ name: 'converted_at', type: 'timestamptz', nullable: true })
  convertedAt!: Date | null;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  // For dedicated instances
  @Column({ name: 'container_name', type: 'varchar', length: 100, nullable: true })
  containerName!: string | null;

  @Column({ name: 'subdomain', type: 'varchar', length: 100, nullable: true })
  subdomain!: string | null;

  @Column({ name: 'app_port', type: 'int', nullable: true })
  appPort!: number | null;

  @Column({ name: 'db_password', type: 'varchar', length: 255, nullable: true })
  dbPassword!: string | null; // Encrypted

  @Column({ name: 'jwt_secret', type: 'varchar', length: 255, nullable: true })
  jwtSecret!: string | null; // Encrypted

  @Column({ name: 'source', type: 'varchar', length: 50, default: 'website_signup' })
  source!: string; // 'website_signup', 'sales_demo', 'partner_referral'

  @Column({ name: 'admin_user_id', type: 'uuid', nullable: true })
  adminUserId!: string | null;

  @Column({ name: 'demo_data_seeded', type: 'boolean', default: false })
  demoDataSeeded!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
```

### Trial Manager Service (Core Logic)

```typescript
@Injectable()
export class TrialManagerService {
  constructor(
    @InjectRepository(TrialInstance)
    private trialRepository: Repository<TrialInstance>,
    private dockerProvisioner: DockerProvisionerService,
    private encryptionService: EncryptionService,
  ) {}

  /**
   * Create a new trial instance
   */
  async createTrial(dto: CreateTrialDto): Promise<TrialInstance> {
    // 1. Determine isolation type
    const isolationType = this.determineIsolationType(dto.source);

    // 2. Calculate trial dates
    const now = new Date();
    const trialEnds = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    const gracePeriodEnds = new Date(trialEnds.getTime() + 7 * 24 * 60 * 60 * 1000);

    // 3. Create trial record
    const trial = this.trialRepository.create({
      organizationName: dto.organizationName,
      contactEmail: dto.email,
      contactName: dto.contactName,
      contactPhone: dto.phone,
      plan: dto.plan || 'professional',
      isolationType,
      status: 'pending',
      trialStartsAt: now,
      trialEndsAt: trialEnds,
      gracePeriodEndsAt: gracePeriodEnds,
      source: dto.source || 'website_signup',
    });

    const saved = await this.trialRepository.save(trial);

    // 4. Provision resources
    if (isolationType === 'dedicated') {
      await this.provisionDedicatedInstance(saved);
    } else {
      await this.provisionSharedInstance(saved);
    }

    // 5. Update status to active
    await this.trialRepository.update(saved.id, { status: 'active' });

    // 6. Send activation email
    // await this.emailService.sendTrialWelcomeEmail(saved);

    return saved;
  }

  /**
   * Determine isolation type based on source and current load
   */
  private determineIsolationType(source: string): 'shared' | 'dedicated' {
    if (source === 'sales_demo' || source === 'partner_referral') {
      return 'dedicated';
    }
    // For website signups, check current trial count
    // If >50 active shared trials, use dedicated to avoid overload
    return 'shared';
  }

  /**
   * Provision a dedicated Docker container instance
   */
  private async provisionDedicatedInstance(trial: TrialInstance): Promise<void> {
    const trialId = `trial-${trial.id.slice(0, 8)}`;
    const subdomain = `${trialId}.neuraline.health`;
    const appPort = await this.dockerProvisioner.findAvailablePort();
    const dbPassword = this.generateSecurePassword();
    const jwtSecret = this.generateSecureSecret();

    await this.dockerProvisioner.provisionStack({
      trialId,
      appPort,
      dbPassword,
      jwtSecret,
      expiryDate: trial.trialEndsAt.toISOString(),
    });

    // Wait for health check
    await this.dockerProvisioner.waitForHealth(`http://localhost:${appPort}/api/v1/health`, 60000);

    // Update trial record
    await this.trialRepository.update(trial.id, {
      containerName: trialId,
      subdomain,
      appPort,
      dbPassword: this.encryptionService.encrypt(dbPassword),
      jwtSecret: this.encryptionService.encrypt(jwtSecret),
    });

    // Seed demo data
    await this.seedDemoData(`http://localhost:${appPort}`);
  }

  /**
   * Provision a shared instance (new tenant in existing DB)
   */
  private async provisionSharedInstance(trial: TrialInstance): Promise<void> {
    // Create tenant record
    // Create admin user
    // Seed demo data for this tenant
    // No Docker provisioning needed
  }

  /**
   * Generate a secure random password
   */
  private generateSecurePassword(): string {
    return require('crypto').randomBytes(24).toString('base64');
  }

  /**
   * Generate a secure random JWT secret
   */
  private generateSecureSecret(): string {
    return require('crypto').randomBytes(48).toString('base64');
  }

  /**
   * Seed demo data into the trial instance
   */
  private async seedDemoData(baseUrl: string): Promise<void> {
    // POST /api/v1/seed/demo-data
    // Creates: 10 patients, 5 providers, 20 appointments, 15 prescriptions,
    // 10 lab orders, 5 encounters, sample billing claims, sample EOBs
  }
}
```

---

## 5. Trial Lifecycle

### State Machine

```
┌────────┐     ┌─────────┐     ┌──────────┐     ┌──────────┐
│ PENDING│────▶│ ACTIVE  │────▶│ EXPIRING │────▶│ EXPIRED  │
└────────┘     └─────────┘     └──────────┘     └──────────┘
                   │                                   │
                   │ (user upgrades)                   │ (grace period ends)
                   ▼                                   ▼
              ┌─────────┐                        ┌──────────┐
              │ CONVERTED│                       │ DELETED  │
              └─────────┘                        └──────────┘
```

### State Descriptions

| State | Description | User Access | Actions |
|-------|-------------|-------------|---------|
| `pending` | Trial request received, provisioning in progress | None | Provisioning resources, seeding data |
| `active` | Trial is live and accessible | Full access | User can log in and use the system |
| `expiring` | Trial is within 3 days of expiry | Full access + warning banners | Send expiry warning emails (T-3, T-1) |
| `expired` | Trial period has ended | Read-only + upgrade prompt | Suspend write access, show upgrade page |
| `converted` | User upgraded to paid plan | Full access | Provision production instance, migrate data |
| `deleted` | Grace period ended, data deleted | None | Tear down containers, delete data, send confirmation email |

### Timeline

```
Day 0          Day 12        Day 14        Day 15        Day 22
  │              │              │              │              │
  ▼              ▼              ▼              ▼              ▼
Trial           Warning        Final         Trial         Grace Period
Created         Email (T-3)    Warning       Expires       Ends → Data
                Sent           Email (T-1)   (Access       Deleted
                               Sent          Suspended)
```

---

## 6. Docker Compose Template

### `docker-compose.trial.yml`

```yaml
version: '3.8'

services:
  trial-app:
    image: neuralinebase:${VERSION:-latest}
    container_name: ${TRIAL_ID}-app
    environment:
      - NODE_ENV=production
      - DB_HOST=trial-postgres
      - DB_PORT=5432
      - DB_DATABASE=neuraline
      - DB_USERNAME=trial_user
      - DB_PASSWORD=${DB_PASSWORD}
      - JWT_SECRET=${JWT_SECRET}
      - JWT_EXPIRATION=15m
      - JWT_REFRESH_EXPIRATION=7d
      - REDIS_HOST=trial-redis
      - REDIS_PORT=6379
      - TRIAL_MODE=true
      - TRIAL_EXPIRES_AT=${EXPIRY_DATE}
      - TRIAL_ID=${TRIAL_ID}
      - AI_PROVIDER=ollama
      - OLLAMA_HOST=http://ollama-shared:11434
      - CORS_ORIGIN=https://${SUBDOMAIN}
    ports:
      - "${APP_PORT}:4000"
    depends_on:
      trial-postgres:
        condition: service_healthy
      trial-redis:
        condition: service_started
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '2.0'
        reservations:
          memory: 512M
          cpus: '0.5'
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    labels:
      - "trial.id=${TRIAL_ID}"
      - "trial.expires=${EXPIRY_DATE}"
      - "trial.organization=${ORG_NAME}"
    networks:
      - trial-net

  trial-postgres:
    image: postgres:15-alpine
    container_name: ${TRIAL_ID}-postgres
    environment:
      - POSTGRES_DB=neuraline
      - POSTGRES_USER=trial_user
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - trial-pg-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U trial_user -d neuraline"]
      interval: 10s
      timeout: 5s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '1.0'
    labels:
      - "trial.id=${TRIAL_ID}"
    networks:
      - trial-net

  trial-redis:
    image: redis:7-alpine
    container_name: ${TRIAL_ID}-redis
    deploy:
      resources:
        limits:
          memory: 128M
    labels:
      - "trial.id=${TRIAL_ID}"
    networks:
      - trial-net

volumes:
  trial-pg-data:
    name: ${TRIAL_ID}-pg-data
    labels:
      - "trial.id=${TRIAL_ID}"

networks:
  trial-net:
    name: ${TRIAL_ID}-net
    driver: bridge
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Dedicated PostgreSQL per trial | Full data isolation, easy teardown via volume deletion |
| Dedicated Redis per trial | No queue cross-contamination |
| Shared Ollama container | AI model is large (~4GB); sharing saves resources |
| Resource limits (2GB RAM, 2 CPU) | Prevents any single trial from consuming host resources |
| Health checks | Trial Manager can detect failed provisioning |
| Docker labels | Enables `docker ps --filter label=trial.id=xxx` for management |
| Dedicated network per trial | No inter-trial communication possible |

---

## 7. Provisioning Scripts

### `provision-trial.sh` (Bash)

```bash
#!/bin/bash
set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────
TRIAL_MANAGER_URL="${TRIAL_MANAGER_URL:-http://localhost:4000/api/v1/trials}"
COMPOSE_FILE="${COMPOSE_FILE:-./docker-compose.trial.yml}"
VERSION="${VERSION:-latest}"

# ─── Generate unique identifiers ──────────────────────────────────
TRIAL_ID="trial-$(uuidgen | cut -d'-' -f1)"
TRIAL_UUID=$(uuidgen)
EXPIRY=$(date -d "+15 days" -u +"%Y-%m-%dT%H:%M:%SZ")
APP_PORT=$(shuf -i 5100-5999 -n 1)
DB_PASSWORD=$(openssl rand -base64 24)
JWT_SECRET=$(openssl rand -base64 48)
ORG_NAME="${1:-Trial Organization}"
SUBDOMAIN="${TRIAL_ID}.neuraline.health"

# ─── Export environment for docker-compose ────────────────────────
export TRIAL_ID
export EXPIRY
export APP_PORT
export DB_PASSWORD
export JWT_SECRET
export ORG_NAME
export SUBDOMAIN
export VERSION

echo "┌──────────────────────────────────────────────────┐"
echo "│  Provisioning Trial Instance                     │"
echo "│  Trial ID:    ${TRIAL_ID}                        │"
echo "│  App Port:    ${APP_PORT}                        │"
echo "│  Subdomain:   ${SUBDOMAIN}                       │"
echo "│  Expires:     ${EXPIRY}                          │"
echo "└──────────────────────────────────────────────────┘"

# ─── Start the Docker stack ───────────────────────────────────────
docker compose -p "${TRIAL_ID}" -f "${COMPOSE_FILE}" up -d

# ─── Wait for app to be healthy ───────────────────────────────────
echo "Waiting for app to start..."
MAX_RETRIES=30
RETRY=0
until curl -sf "http://localhost:${APP_PORT}/api/v1/health" > /dev/null 2>&1; do
  RETRY=$((RETRY + 1))
  if [ $RETRY -ge $MAX_RETRIES ]; then
    echo "ERROR: App failed to start within ${MAX_RETRIES} retries"
    docker compose -p "${TRIAL_ID}" -f "${COMPOSE_FILE}" logs --tail 50
    exit 1
  fi
  echo "  Waiting... (${RETRY}/${MAX_RETRIES})"
  sleep 5
done

echo "App is healthy!"

# ─── Seed demo data ───────────────────────────────────────────────
echo "Seeding demo data..."
curl -s -X POST "http://localhost:${APP_PORT}/api/v1/seed/demo-data" \
  -H "Content-Type: application/json" \
  -d "{\"trialId\": \"${TRIAL_UUID}\"}" || echo "WARNING: Demo data seeding failed"

# ─── Register with Trial Manager ──────────────────────────────────
echo "Registering with Trial Manager..."
curl -s -X POST "${TRIAL_MANAGER_URL}/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"trialId\": \"${TRIAL_UUID}\",
    \"containerName\": \"${TRIAL_ID}\",
    \"port\": ${APP_PORT},
    \"subdomain\": \"${SUBDOMAIN}\",
    \"expiresAt\": \"${EXPIRY}\",
    \"dbPasswordEncrypted\": \"$(echo -n ${DB_PASSWORD} | base64)\",
    \"jwtSecretEncrypted\": \"$(echo -n ${JWT_SECRET} | base64)\"
  }"

# ─── Setup DNS (if using Route53) ─────────────────────────────────
# aws route53 change-resource-record-sets \
#   --hosted-zone-id Z123ABC \
#   --change-batch '{"Changes":[{"Action":"CREATE","ResourceRecordSet":{"Name":"'${SUBDOMAIN}'","Type":"CNAME","TTL":300,"ResourceRecords":[{"Value":"trial-host.neuraline.health"}]}}]}'

# ─── Setup nginx reverse proxy entry ─────────────────────────────
# This would be automated via nginx config generation or Traefik labels

echo ""
echo "┌──────────────────────────────────────────────────┐"
echo "│  Trial Provisioned Successfully!                 │"
echo "│                                                  │"
echo "│  URL:         http://localhost:${APP_PORT}       │"
echo "│  Subdomain:   https://${SUBDOMAIN}               │"
echo "│  Expires:     ${EXPIRY}                          │"
echo "│                                                  │"
echo "│  To tear down:                                   │"
echo "│  docker compose -p ${TRIAL_ID} down -v           │"
echo "└──────────────────────────────────────────────────┘"
```

### `teardown-trial.sh` (Bash)

```bash
#!/bin/bash
set -euo pipefail

TRIAL_ID="${1:?Usage: teardown-trial.sh <trial-id>}"
COMPOSE_FILE="${COMPOSE_FILE:-./docker-compose.trial.yml}"

echo "Tearing down trial: ${TRIAL_ID}"

# Stop and remove containers + volumes
docker compose -p "${TRIAL_ID}" -f "${COMPOSE_FILE}" down -v --remove-orphans

# Remove any dangling volumes
docker volume ls --filter "label=trial.id=${TRIAL_ID}" -q | xargs -r docker volume rm

# Remove any dangling networks
docker network ls --filter "name=${TRIAL_ID}" -q | xargs -r docker network rm

# Remove DNS entry (if using Route53)
# aws route53 change-resource-record-sets ...

echo "Trial ${TRIAL_ID} has been fully removed."
```

---

## 8. Auto-Expiry & Cleanup

### Trial Expiry Service

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, LessThanOrEqual } from 'typeorm';
import { TrialInstance } from './entities/trial-instance.entity';
import { DockerProvisionerService } from './docker-provisioner.service';

@Injectable()
export class TrialExpiryService {
  private readonly logger = new Logger(TrialExpiryService.name);

  constructor(
    @InjectRepository(TrialInstance)
    private trialRepository: Repository<TrialInstance>,
    private dockerProvisioner: DockerProvisionerService,
  ) {}

  /**
   * Run every hour to check for trials needing action
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleTrialExpiry() {
    await this.sendExpiryWarnings();
    await this.expireTrials();
    await this.deleteExpiredTrials();
  }

  /**
   * Send warning emails at T-3 and T-1 days before expiry
   */
  private async sendExpiryWarnings() {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const oneDayFromNow = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

    // T-3 warnings
    const t3Trials = await this.trialRepository.find({
      where: {
        status: 'active',
        trialEndsAt: LessThanOrEqual(threeDaysFromNow),
      },
    });

    for (const trial of t3Trials) {
      if (!trial.warningSent3Days) {
        // await this.emailService.sendExpiryWarning(trial, 3);
        this.logger.log(`Sent T-3 warning for trial ${trial.id}`);
        // Mark warning sent
      }
    }

    // T-1 warnings (similar logic)
  }

  /**
   * Expire trials that have passed their end date
   */
  private async expireTrials() {
    const now = new Date();
    const expiredTrials = await this.trialRepository.find({
      where: {
        status: 'active',
        trialEndsAt: LessThan(now),
      },
    });

    for (const trial of expiredTrials) {
      this.logger.log(`Expiring trial ${trial.id} for ${trial.organizationName}`);

      // Update status to expired
      await this.trialRepository.update(trial.id, {
        status: 'expired',
      });

      // For dedicated instances, stop the app container but keep data
      if (trial.isolationType === 'dedicated' && trial.containerName) {
        await this.dockerProvisioner.stopApp(trial.containerName);
      }

      // For shared instances, set tenant to inactive
      if (trial.isolationType === 'shared') {
        // await this.tenantService.update(trial.tenantId, { isActive: false });
      }

      // Send expired email
      // await this.emailService.sendTrialExpiredEmail(trial);
    }
  }

  /**
   * Delete trials past their grace period (T+7 days)
   */
  private async deleteExpiredTrials() {
    const now = new Date();
    const trialsToDelete = await this.trialRepository.find({
      where: {
        status: 'expired',
        gracePeriodEndsAt: LessThan(now),
      },
    });

    for (const trial of trialsToDelete) {
      this.logger.log(`Deleting trial ${trial.id} (grace period ended)`);

      if (trial.isolationType === 'dedicated' && trial.containerName) {
        // Full teardown: stop containers, remove volumes
        await this.dockerProvisioner.teardownStack(trial.containerName);
      }

      if (trial.isolationType === 'shared') {
        // Delete tenant data from shared DB
        // await this.tenantService.deleteTenantData(trial.tenantId);
      }

      // Mark as deleted
      await this.trialRepository.update(trial.id, {
        status: 'deleted',
        deletedAt: new Date(),
      });

      // Send data deletion confirmation email
      // await this.emailService.sendDataDeletionConfirmation(trial);
    }
  }
}
```

---

## 9. Upgrade / Conversion Path

When a trial user converts to a paid plan:

```
Trial Instance (shared or dedicated)
    │
    │ User pays → Stripe webhook received
    │
    ▼
┌─────────────────────────────────────────────────┐
│  Conversion Process                              │
│                                                  │
│  1. Verify payment (Stripe)                      │
│  2. Provision production dedicated instance      │
│     - New Docker stack with production config    │
│     - Custom domain (e.g., client.neuraline.health) │
│     - Production-grade Postgres (managed/RDS)    │
│  3. Migrate trial data                           │
│     - pg_dump trial DB → pg_restore production DB │
│  4. Update DNS                                   │
│     - Point custom domain to new instance        │
│  5. Update trial record                          │
│     - status: 'converted'                        │
│     - converted_at: NOW()                        │
│  6. Schedule old trial teardown (T+1 day)        │
│  7. Send welcome email with new URL + credentials │
└─────────────────────────────────────────────────┘
```

### Conversion Service

```typescript
async convertTrialToPaid(trialId: string, paymentData: StripePaymentData): Promise<void> {
  const trial = await this.findTrialById(trialId);
  
  if (trial.status !== 'active' && trial.status !== 'expired') {
    throw new BadRequestException('Trial must be active or expired to convert');
  }

  // 1. Provision production instance
  const prodInstance = await this.provisionProductionInstance({
    organizationName: trial.organizationName,
    customDomain: paymentData.customDomain,
    plan: paymentData.plan,
  });

  // 2. Migrate data
  if (trial.isolationType === 'dedicated') {
    await this.migrateDataDedicated(trial, prodInstance);
  } else {
    await this.migrateDataShared(trial, prodInstance);
  }

  // 3. Update DNS
  await this.dnsService.createRecord(
    paymentData.customDomain,
    prodInstance.ipAddress
  );

  // 4. Update trial record
  await this.trialRepository.update(trialId, {
    status: 'converted',
    convertedAt: new Date(),
  });

  // 5. Schedule old trial teardown
  await this.scheduleTrialTeardown(trialId, new Date(Date.now() + 24 * 60 * 60 * 1000));

  // 6. Send welcome email
  // await this.emailService.sendConversionWelcomeEmail(trial, prodInstance);
}
```

---

## 10. Database Schema

### Trial Instances Table

```sql
CREATE TABLE trial_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    organization_name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(20),
    plan VARCHAR(50) DEFAULT 'professional',
    isolation_type VARCHAR(20) NOT NULL, -- 'shared' | 'dedicated'
    status VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'active' | 'expiring' | 'expired' | 'converted' | 'deleted'
    trial_starts_at TIMESTAMPTZ NOT NULL,
    trial_ends_at TIMESTAMPTZ NOT NULL,
    grace_period_ends_at TIMESTAMPTZ,
    converted_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    
    -- Dedicated instance metadata
    container_name VARCHAR(100),
    subdomain VARCHAR(100),
    app_port INTEGER,
    db_password TEXT, -- encrypted
    jwt_secret TEXT, -- encrypted
    
    -- Metadata
    source VARCHAR(50) DEFAULT 'website_signup',
    admin_user_id UUID,
    demo_data_seeded BOOLEAN DEFAULT false,
    warning_sent_3_days BOOLEAN DEFAULT false,
    warning_sent_1_day BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_trial_status ON trial_instances(status);
CREATE INDEX idx_trial_ends_at ON trial_instances(trial_ends_at);
CREATE INDEX idx_trial_grace_period ON trial_instances(grace_period_ends_at) WHERE status = 'expired';
CREATE INDEX idx_trial_email ON trial_instances(contact_email);
CREATE INDEX idx_trial_tenant ON trial_instances(tenant_id);
```

---

## 11. API Endpoints

### Trial Management API

All endpoints are under `/api/v1/trials` and require admin authentication (except signup).

```typescript
// Public endpoint — no auth required
POST   /api/v1/trials/signup
  Body: { organizationName, contactName, email, phone, plan, source }
  Response: { trialId, status: 'pending', message: 'Trial is being provisioned' }

// Admin endpoints — require staff JWT
GET    /api/v1/trials
  Query: ?status=active&page=1&limit=20
  Response: Paginated list of trial instances

GET    /api/v1/trials/:id
  Response: Trial instance details

GET    /api/v1/trials/:id/status
  Response: { status, trialEndsAt, daysRemaining, gracePeriodEndsAt }

POST   /api/v1/trials/:id/extend
  Body: { additionalDays: number, reason: string }
  Response: Updated trial instance

POST   /api/v1/trials/:id/convert
  Body: { plan, billingCycle, stripeCustomerId, customDomain? }
  Response: { productionInstanceId, url, message }

POST   /api/v1/trials/:id/suspend
  Body: { reason: string }
  Response: { status: 'suspended' }

POST   /api/v1/trials/:id/delete
  Body: { reason: string }
  Response: { status: 'deleted' }

GET    /api/v1/trials/stats
  Response: { active, expiring, expired, converted, deleted, conversionRate }

// Internal endpoints — called by provisioning scripts
POST   /api/v1/trials/register
  Body: { trialId, containerName, port, subdomain, expiresAt }
  Response: { registered: true }

POST   /api/v1/trials/:id/seed-complete
  Response: { demoDataSeeded: true }
```

### Health Check Endpoint (per trial instance)

```typescript
// Each trial instance exposes its own health endpoint
GET    /api/v1/health
  Response: {
    status: 'ok',
    trialMode: true,
    trialExpiresAt: '2025-01-15T00:00:00Z',
    daysRemaining: 12
  }
```

---

## 12. Frontend Trial Signup Flow

### Signup Page

```
┌──────────────────────────────────────────────────┐
│            Start Your Free Trial                  │
│                                                   │
│  15 days · No credit card required · Full access  │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │ Organization Name *                          │ │
│  │ [_________________________]                  │ │
│  │                                              │ │
│  │ Your Name *                                  │ │
│  │ [_________________________]                  │ │
│  │                                              │ │
│  │ Work Email *                                 │ │
│  │ [_________________________]                  │ │
│  │                                              │ │
│  │ Phone                                        │ │
│  │ [_________________________]                  │ │
│  │                                              │ │
│  │ Plan                                         │ │
│  │ [Professional ▼]                             │ │
│  │                                              │ │
│  │ ☐ I agree to the Terms of Service and        │ │
│  │   Privacy Policy (including BAA)             │ │
│  │                                              │ │
│  │         [ Start Free Trial ]                 │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  By signing up, you'll get:                       │
│  ✓ Full EMR access for 15 days                    │
│  ✓ Pre-loaded demo data to explore                │
│  ✓ AI-powered features (SOAP notes, code suggest) │
│  ✓ No credit card required                        │
└──────────────────────────────────────────────────┘
```

### Trial Expiry Banner (shown in app)

```
┌──────────────────────────────────────────────────┐
│ ⚠️  Your trial expires in 3 days                  │
│     [ Upgrade Now ]    [ Remind Me Later ]        │
└──────────────────────────────────────────────────┘
```

### Trial Expired Screen

```
┌──────────────────────────────────────────────────┐
│            Trial Expired                          │
│                                                   │
│  Your 15-day trial has ended.                     │
│  Your data will be retained for 7 more days.      │
│                                                   │
│  To keep your data and continue using NeuralineBase,│
│  upgrade to a paid plan today.                    │
│                                                   │
│  [ Upgrade to Professional - $499/mo ]            │
│  [ Upgrade to Enterprise - Contact Sales ]        │
│                                                   │
│  Questions? Call 1-800-NEURALINE                  │
└──────────────────────────────────────────────────┘
```

---

## 13. Security & Compliance

### HIPAA Considerations

| Concern | Mitigation |
|---------|-----------|
| **BAA requirement** | Trial users must agree to BAA before trial starts (checkbox on signup) |
| **PHI in trials** | Recommend demo data only. If real PHI is entered, it's covered under BAA |
| **Data encryption** | All trial DBs encrypted at rest (Postgres TDE or volume encryption) |
| **Data deletion** | Secure deletion after grace period (volume destruction, not just deletion) |
| **Audit logging** | All trial actions logged; logs retained per HIPAA policy (6 years) |
| **Access control** | Trial admin account with forced password change on first login |
| **Network isolation** | Docker networks per trial stack; no inter-trial communication |

### Abuse Prevention

| Concern | Mitigation |
|---------|-----------|
| **Multiple trials per email** | Limit to 1 active trial per email address |
| **Multiple trials per IP** | Rate limit: max 3 trial signups per IP per day |
| **Multiple trials per domain** | Check email domain against existing trials |
| **Resource exhaustion** | Docker resource limits per container (2GB RAM, 2 CPU) |
| **Crypto mining abuse** | Disable shell access in trial containers; use minimal images |
| **Data exfiltration** | Disable data export features in trial mode |

### Trial Mode Restrictions

The app should detect `TRIAL_MODE=true` environment variable and apply restrictions:

```typescript
// Trial mode restrictions
const TRIAL_RESTRICTIONS = {
  maxPatients: 50,           // Limit patient count
  maxProviders: 5,           // Limit provider count
  maxAppointments: 100,      // Limit appointments
  dataExport: false,         // Disable data export
  apiAccess: false,          // Disable external API access
  customBranding: false,     // Disable white-label
  maxStorageMB: 500,         // Storage limit
  features: {
    fhir: true,              // FHIR API enabled
    ai: true,                // AI features enabled (shared Ollama)
    telemedicine: false,     // Telemedicine disabled
    customIntegrations: false, // Custom integrations disabled
  },
};
```

---

## 14. Cost Estimates

### Per-Trial Cost Breakdown

| Resource | Option A (Shared) | Option C (Dedicated) |
|----------|-------------------|---------------------|
| App server | $0 (shared) | ~$3-5/mo (container) |
| Database | $0 (shared) | ~$2-5/mo (container PG) |
| Redis | $0 (shared) | ~$0.50/mo (container) |
| Storage | ~$0.10 (few MB) | ~$0.50 (volumes) |
| Network egress | ~$0.10 | ~$0.50 |
| DNS | $0 (wildcard) | $0 (wildcard) |
| **Total per 15-day trial** | **~$0.20** | **~$3-6** |

### Monthly Cost at Scale

| Trials/month | Option A (Shared) | Option C (Dedicated) | Hybrid (Recommended) |
|-------------|-------------------|---------------------|---------------------|
| 100 | ~$2 | ~$300-600 | ~$150-300 |
| 500 | ~$10 | ~$1500-3000 | ~$750-1500 |
| 1000 | ~$20 | ~$3000-6000 | ~$1500-3000 |

### Infrastructure Requirements

| Component | Specification | Cost (monthly) |
|-----------|--------------|----------------|
| Trial Host Server | 64GB RAM, 16 vCPU, 500GB SSD | ~$200-400 |
| (supports ~30 concurrent dedicated trials) | | |
| Shared Production Instance | Existing infrastructure | $0 additional |
| Ollama GPU Server | Shared (existing) | $0 additional |
| DNS Management | Route53 / Cloudflare | ~$5-10 |
| Email Service | SendGrid / SES | ~$20-50 |
| **Total fixed infrastructure** | | **~$225-460/mo** |

---

## 15. Monitoring & Alerting

### Metrics to Track

```typescript
const trialMetrics = {
  // Provisioning metrics
  trialsProvisioned: 'counter',          // Total trials created
  provisioningTimeMs: 'histogram',       // Time to provision a trial
  provisioningFailures: 'counter',       // Failed provisioning attempts

  // Active trial metrics
  activeTrials: 'gauge',                 // Currently active trials
  trialsByIsolationType: 'gauge',        // Shared vs dedicated
  trialsByPlan: 'gauge',                 // By plan type
  trialsBySource: 'gauge',               // By signup source

  // Expiry metrics
  trialsExpiringSoon: 'gauge',           // Trials expiring within 3 days
  trialsExpired: 'counter',              // Total expired trials
  trialsDeleted: 'counter',              // Total deleted trials

  // Conversion metrics
  trialsConverted: 'counter',            // Total conversions
  conversionRate: 'gauge',               // Conversion percentage
  timeToConversion: 'histogram',         // Days from signup to conversion
  revenueFromConversions: 'counter',     // MRR from converted trials

  // Health metrics
  trialContainerHealth: 'gauge',         // % of trial containers healthy
  trialAppResponseTime: 'histogram',     // Response time per trial
  trialDbConnections: 'gauge',           // DB connections per trial
};
```

### Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| Trial provisioning failure | `provisioningFailures > 0` in last hour | Critical |
| Trial container unhealthy | `trialContainerHealth < 95%` | Warning |
| Trial expiry job not running | No `expireTrials` execution in 2 hours | Critical |
| Too many active trials | `activeTrials > MAX_CONCURRENT_TRIALS` | Warning |
| Low conversion rate | `conversionRate < 2%` over 30 days | Info |
| Trial host disk space | `diskUsage > 80%` | Warning |
| Trial host memory | `memoryUsage > 85%` | Warning |

---

## 16. Implementation Checklist

### Phase 1: Core Trial Manager (Week 1-2)

- [ ] Create `TrialInstance` entity and migration
- [ ] Create `TrialManagerModule` with service and controller
- [ ] Implement `POST /trials/signup` endpoint
- [ ] Implement trial provisioning for shared instances (Option A)
- [ ] Create demo data seeder (10 patients, 5 providers, 20 appointments, etc.)
- [ ] Create trial signup frontend page
- [ ] Implement trial mode restrictions in app (max patients, no export, etc.)
- [ ] Add trial expiry banner component

### Phase 2: Docker Provisioning (Week 2-3)

- [ ] Create `docker-compose.trial.yml` template
- [ ] Implement `DockerProvisionerService` (provision, teardown, health check)
- [ ] Create `provision-trial.sh` and `teardown-trial.sh` scripts
- [ ] Implement dedicated instance provisioning (Option C)
- [ ] Set up port allocation system (5100-5999 range)
- [ ] Configure nginx/Traefik reverse proxy for trial subdomains
- [ ] Test end-to-end provisioning and teardown

### Phase 3: Expiry & Cleanup (Week 3-4)

- [ ] Implement `TrialExpiryService` with cron jobs
- [ ] Send T-3 and T-1 warning emails
- [ ] Implement trial expiration (suspend access)
- [ ] Implement grace period handling
- [ ] Implement data deletion (container teardown + volume removal)
- [ ] Send expiry and deletion confirmation emails
- [ ] Test full lifecycle: provision → expire → delete

### Phase 4: Conversion & Billing (Week 4-5)

- [ ] Integrate Stripe for payment processing
- [ ] Implement `POST /trials/:id/convert` endpoint
- [ ] Implement data migration (pg_dump → pg_restore)
- [ ] Set up DNS automation (Route53 / Cloudflare API)
- [ ] Create production instance provisioning
- [ ] Test conversion flow end-to-end

### Phase 5: Monitoring & Hardening (Week 5-6)

- [ ] Set up Prometheus/Grafana monitoring for trial metrics
- [ ] Configure alerts (provisioning failures, health issues, resource limits)
- [ ] Implement abuse prevention (rate limiting, email deduplication)
- [ ] Security audit of trial isolation
- [ ] Load test with 50+ concurrent trials
- [ ] Document runbooks for common trial issues

### Phase 6: Frontend Polish (Week 6)

- [ ] Trial signup page with form validation
- [ ] Trial status dashboard (admin view)
- [ ] Trial expiry banner in app
- [ ] Trial expired screen with upgrade CTA
- [ ] Conversion/upgrade flow
- [ ] Email templates (welcome, warning, expired, converted, deleted)

---

## Appendix A: Environment Variables for Trial Mode

```env
# Trial-specific environment variables
TRIAL_MODE=true
TRIAL_ID=trial-abc12345
TRIAL_EXPIRES_AT=2025-01-15T00:00:00Z
TRIAL_ORGANIZATION=Sunrise Clinic
TRIAL_MAX_PATIENTS=50
TRIAL_MAX_PROVIDERS=5
TRIAL_MAX_APPOINTMENTS=100
TRIAL_DATA_EXPORT=false
TRIAL_API_ACCESS=false
TRIAL_CUSTOM_BRANDING=false
TRIAL_MAX_STORAGE_MB=500
```

## Appendix B: Docker Commands Reference

```bash
# List all trial containers
docker ps --filter "label=trial.id" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# List all trial volumes
docker volume ls --filter "label=trial.id"

# Stop a specific trial
docker compose -p trial-abc123 down

# Stop and remove a trial (including data)
docker compose -p trial-abc123 down -v --remove-orphans

# View trial logs
docker compose -p trial-abc123 logs -f

# Check trial health
curl http://localhost:5101/api/v1/health

# Find trials expiring today
docker ps --filter "label=trial.expires=$(date -u +%Y-%m-%d)" --format "{{.Names}}"
```

## Appendix C: Nginx Reverse Proxy Configuration

```nginx
# /etc/nginx/conf.d/trial-proxy.conf

# Wildcard subdomain for trial instances
server {
    listen 80;
    server_name ~^trial-[a-z0-9]+\.neuraline\.health$;

    # Extract trial ID from subdomain
    location / {
        # Resolve trial ID to port via Trial Manager API
        # In production, use a map file or Lua script for performance
        proxy_pass http://127.0.0.1:$trial_port;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support for real-time features
    location /ws {
        proxy_pass http://127.0.0.1:$trial_port;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

*This document is a living specification. Update it as the implementation evolves.*
