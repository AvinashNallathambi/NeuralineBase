# Neuraline EMR - Development Guide

## Architecture
- **Frontend**: React + Vite + Ant Design (port 5173 default)
- **Backend**: NestJS + TypeORM + PostgreSQL (port 4001 via Docker, 4000 direct)
- **AI Services**: Ollama (port 11434) + Whisper (port 8001)

## Quick Start

### Backend
```bash
cd backend
# Create .env from .env.example with correct DB creds (see Docker Compose)
npx nest start        # or: npx nest start --watch
```

### Frontend
```bash
cd frontend
npx vite --host
```

### Docker Services
```bash
docker compose up -d postgres whisper-service ollama
# Pull the Ollama model:
curl -X POST http://localhost:11434/api/pull -d '{"name":"mistral"}'
```

## Database
- Docker PostgreSQL: user=`neuraline`, password=`neuraline_dev`, database=`neuraline`
- `DB_SYNCHRONIZE=false` by default. Use migrations to manage schema changes.
- Boolean env vars must be compared as strings (ConfigService returns strings)

### Schema Migrations
When you modify an entity, generate and run a migration:

```bash
cd backend
# Generate migration from entity changes
npx typeorm migration:generate -d src/config/database.config.ts src/migrations/MigrationName
# Run pending migrations
npx typeorm migration:run -d src/config/database.config.ts
# Revert last migration
npx typeorm migration:revert -d src/config/database.config.ts
```

To enable auto-sync temporarily (dev only), set `DB_SYNCHRONIZE=true` in `.env` or Docker env, then disable it and create a migration before committing.

## Backend Modules
- **Implemented**: Auth, Patients, FHIR, Superbill, ProviderAvailability, AI, Workflow, Prescriptions, Laboratory, Billing, Eligibility, Providers, ICD, Integrations, Medications, Pharmacies, Remittance, Denials, Appeals, Underpayments, Automation
- **Stubs (empty)**: Appointments, Clinical, Notifications, Reports, Telemedicine, Users
- AuthService uses in-memory dev user (no UsersService/DB persistence yet)

### Billing Module
The billing module (`backend/src/modules/billing/`) provides claim lifecycle management, invoicing, and insurance master data:

### Entities
- **EncounterClaim**: Insurance claims with status workflow (draft → ready_to_bill → submitted → paid/denied/partially_paid/appealed → cancelled)
- **ClaimLineItem**: Individual service lines (CPT/ICD-10 coded with modifiers, diagnosis pointers, adjudication amounts)
- **Invoice**: Patient invoices (cash_pay, self_pay, balance_due) with payment tracking
- **InsurancePayer**: Insurance company master data with EDI submission URLs
- **PatientInsurance**: Patient insurance policies (primary/secondary/tertiary) with subscriber details

### API Endpoints (all under `/api/v1/billing`)
- `POST/GET /claims` / `GET /claims/:id` / `PATCH /claims/:id` / `DELETE /claims/:id` — Claim CRUD
- `PATCH /claims/:id/status` — Update claim status (state-machine validated)
- `POST /claims/:id/calculate` — Calculate claim totals from line items
- `POST/GET /invoices` / `GET /invoices/:id` / `PATCH /invoices/:id` / `DELETE /invoices/:id` — Invoice CRUD
- `PATCH /invoices/:id/status` — Update invoice status
- `POST /invoices/:id/payment` — Record patient payment
- `GET /payers` / `GET /payers/:id` — Insurance payer master
- `GET /patients/:patientId/insurance` — Patient's active insurance policies

## Laboratory Module
The laboratory module (`backend/src/modules/laboratory/`) provides full lab order lifecycle, results, specimens, imaging, and a test panel catalog:

### Entities
- **LabOrder**: Order with status workflow (draft → ordered → collected → in_progress → resulted → completed/cancelled)
- **LabTest**: Individual test within an order (LOINC/CPT coded, tracks result status)
- **LabResult**: Result values with abnormal/critical flags, acknowledgment tracking
- **Specimen**: Specimen collection tracking (type, condition, tracking number)
- **LabPanel**: Catalog of lab panels (CBC, BMP, CMP, Lipid, HbA1c, Thyroid, etc.) — tenant-scoped or global (NULL tenantId)
- **ReferenceRange**: Reference ranges by LOINC code, gender, and age (with critical thresholds)
- **ImagingOrder**: Radiology orders (X-ray, MRI, CT, ultrasound) with findings/impression
- **LabOrderStatusHistory**: Audit trail of status transitions

### Auto-Seed
On first boot, `LabSeedService` seeds 10 common lab panels (CBC, BMP, CMP, Lipid, HbA1c, Thyroid, Urinalysis, LFT, Coagulation, Iron) and 39 reference ranges with critical thresholds.

### API Endpoints (all under `/api/v1/laboratory`)
- `GET /stats` — Dashboard statistics (pending, completed today, abnormal, critical unacknowledged)
- `GET /panels` / `GET /panels/:id` / `POST /panels` — Lab panel catalog
- `GET /reference-ranges?loincCode=...` — Reference range lookup by LOINC
- `GET /results/critical` — Unacknowledged critical results
- `GET /results/pending-review` — Results pending provider review
- `PATCH /results/:resultId/acknowledge` — Acknowledge a result (critical value read-back)
- `GET /patient/:patientId/history?loincCode=...` — Patient lab history for trend analysis
- `GET /orders` / `GET /orders/:id` / `POST /orders` / `PATCH /orders/:id` / `DELETE /orders/:id` — Lab order CRUD
- `GET /orders/:id/status-history` — Status transition audit trail
- `GET /orders/:id/specimens` / `POST /orders/:id/collect` — Specimen management
- `GET /orders/:id/results` / `POST /orders/:id/results` — Submit/retrieve results
- `POST /orders/:id/status` / `POST /orders/:id/cancel` — Status transitions
- `GET /imaging` / `GET /imaging/:id` / `POST /imaging` / `PATCH /imaging/:id` / `DELETE /imaging/:id` — Imaging orders
- `POST /imaging/:id/findings` — Submit radiology findings

### AI Features (Phase 1)
- `POST /orders/:id/summarize` — AI: Generate plain-English summary of lab results (summary, keyFindings, recommendations, riskLevel). Requires Ollama.
- `GET /ai/triage` — AI: Smart triage of abnormal results with 0-100 urgency scoring. Falls back to rule-based scoring when Ollama unavailable.
- `POST /ai/query` — Natural language lab query (e.g. "Which patients have high HbA1c?"). AI parses query → structured criteria → DB search → AI summary. Falls back to keyword search when Ollama unavailable.
- **LaboratoryAiService** (`laboratory-ai.service.ts`): Injects AiService + LaboratoryService, uses Ollama generateStructured for JSON-guaranteed output
- **Frontend**: "AI Summarize" button on LabOrderDetailPage, "AI Triage" tab on LaboratoryPage, "Ask AI" search bar on LaboratoryPage

### Frontend Pages
- **LaboratoryPage** (`/laboratory`): Main lab dashboard with 5 tabs:
  - Lab Orders: Searchable order list with expandable test details, row click → detail page
  - Results: Completed orders with abnormal flag highlighting
  - Critical Values: Unacknowledged critical results queue with acknowledgment modal (read-back protocol)
  - Pending Review: Results pending provider review with link to order detail
  - Imaging: Imaging order list with "New Imaging Order" drawer and findings submission modal
- **LabOrderDetailPage** (`/laboratory/:id`): Full order view with 4 tabs (Tests, Specimens, Results, Status History):
  - Status transition buttons (ordered → collected → in_progress → resulted → completed)
  - Specimen collection form (type, method, volume, container, condition, tracking #)
  - Result entry form (value, unit, flag, reference range per test)
  - Cancel order with reason
  - Print order
- **PatientLabHistoryPage** (`/laboratory/patient/:patientId`): Patient lab history with trend chart (recharts) and result history table
- **laboratoryService.ts**: Frontend service with all lab API methods (orders, results, specimens, imaging, critical results, acknowledgment, patient history, reference ranges)

## Workflow System
The dynamic workflow module (`backend/src/modules/workflow/`) provides configurable state-machine workflows:

### Entities
- **WorkflowTemplate**: Stores step definitions, transitions, colors, icons for a workflow type (e.g., appointment)
- **WorkflowInstance**: Tracks a specific entity's current step, history, and status

### Auto-Seed
On first boot, `WorkflowSeedService` creates a default appointment workflow with steps: scheduled → confirmed → checked_in → in_progress → completed (plus cancelled/no_show)

### API Endpoints
- `POST /api/v1/workflow/templates` — Create template (admin)
- `GET /api/v1/workflow/templates` — List templates
- `GET /api/v1/workflow/templates/entity/:entityType` — Get active template for entity
- `PATCH /api/v1/workflow/templates/:id` — Update template (admin)
- `DELETE /api/v1/workflow/templates/:id` — Soft delete template (admin)
- `POST /api/v1/workflow/instances` — Create workflow instance
- `GET /api/v1/workflow/instances/entity/:entityType/:entityId` — Get instance
- `GET /api/v1/workflow/instances/entity/:entityType/:entityId/transitions` — Available next steps
- `POST /api/v1/workflow/instances/entity/:entityType/:entityId/transition` — Perform transition
- `POST /api/v1/workflow/instances/entity/:entityType/:entityId/complete` — Mark completed
- `POST /api/v1/workflow/instances/entity/:entityType/:entityId/cancel` — Cancel workflow

### Frontend Integration
- **WorkflowBuilderPage** (`/workflow/new`, `/workflow/:id`): Visual step builder (add/remove/reorder steps, configure transitions)
- **WorkflowListPage** (`/workflow`): List/manage all templates
- **WorkflowStatusBadge** component: Renders a clickable status tag with step popover; used in AppointmentPage when a workflow template is active
- **AppointmentPage** auto-loads the active appointment workflow and creates/transitions instances on status changes

## Authentication
- Dev user: `dr.sarah.chen@neuraline.health` / `Neuraline@2025`
- JWT token stored in `sessionStorage` under key `neuraline_token`
- Login endpoint: `POST /api/v1/auth/login`
- All AI endpoints require JWT Bearer auth

## AI Pipeline
1. Audio recording (browser MediaRecorder API)
2. Transcription via Whisper service (`POST /api/v1/ai/transcribe`)
3. SOAP note generation via Ollama/Mistral (`POST /api/v1/ai/generate-soap`)
4. Medical code suggestions (`POST /api/v1/ai/suggest-codes`)

## Verification Commands
```bash
# Frontend type check
cd frontend && npx tsc --noEmit

# Backend type check
cd backend && npx tsc --noEmit

# Test login (Docker: port 4001, direct: port 4000)
curl -s http://localhost:4001/api/v1/auth/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"dr.sarah.chen@neuraline.health","password":"Neuraline@2025"}'

# Test AI health
curl -s http://localhost:4000/api/v1/ai/health -H "Authorization: Bearer $TOKEN"
```

## HIPAA Notes
- All DTOs require class-validator decorators (whitelist + forbidNonWhitelisted)
- PHI must never be logged (audit interceptor sanitizes emails/SSN/phone)
- Session tokens use sessionStorage (not localStorage)
- 15-minute inactivity auto-logout
- Account lockout after 5 failed attempts (15 min cooldown)

## RCM (Revenue Cycle Management) Modules

The following modules implement a comprehensive EOB/ERA/Denial Analysis workflow, closing the gap with competitors like Waystar, Experian Health, and Adonis.

### Remittance Module (`backend/src/modules/remittance/`)
ERA/EOB data ingestion and payment posting:
- **Entities**: Remittance, RemittanceClaim, RemittanceServiceLine, ClaimAdjustment, EOB, CarcCode, RarcCode
- **X12 835 Parser**: `x12-parser-835.service.ts` parses raw X12 835 ERA files
- **Auto-Seed**: `remittance-seed.service.ts` seeds CARC/RARC code master on first boot
- **Auto-Post**: Matches remittance claims to existing encounter claims and posts payments
- **API Endpoints** (all under `/api/v1/remittance`):
  - `POST /era/import` — Import X12 835 ERA file (file upload or paste)
  - `POST /era/:id/repost` — Re-run auto-posting
  - `POST /eob` — Import EOB document
  - `GET /` — List remittances (filter by status)
  - `GET /stats` — Dashboard stats (total, posted, pending, unmatched, denied)
  - `GET /:id` / `GET /:id/claims` — Remittance detail with claims
  - `GET /claims/:claimId` — Single remittance claim detail
  - `GET /eob` / `GET /eob/:id` — EOB queries
  - `GET /codes/carc` / `GET /codes/rarc` — CARC/RARC code lookup

### Denials Module (`backend/src/modules/denials/`)
Denial management, analytics, and AI-powered recovery scoring:
- **Entities**: DenialRecord (with root cause categorization, priority, worklist status)
- **DenialCategoryEngine**: Maps CARC/RARC codes to 16 root cause categories (eligibility, prior_auth, medical_necessity, coding_error, etc.)
- **DenialAiService**: AI-powered recovery scoring, NLP analysis of denial text, pattern clustering, worklist prioritization
- **API Endpoints** (all under `/api/v1/denials`):
  - `POST /generate/:remittanceId` — Auto-generate denial records from remittance adjustments
  - `GET /worklist` — Filtered worklist (status, priority, root cause, assignee, payer)
  - `GET /stats` — Denial stats (counts, amounts, critical, approaching deadline)
  - `GET /analytics` — Full analytics (by root cause, payer, priority, status, month, top CARC codes, success rates)
  - `GET /aging` — A/R aging buckets (0-30, 31-60, 61-90, 91-120, 120+)
  - `GET /payer-performance` — Payer scorecard
  - `PATCH /:id/status` — Update worklist status
  - `PATCH /:id/assign` — Assign denial to user
  - `POST /ai/score/:id` — AI recovery probability scoring (single)
  - `POST /ai/score-batch` — Batch AI scoring
  - `POST /ai/nlp/:id` — NLP analysis of denial reason text
  - `POST /ai/cluster` — AI denial pattern clustering
  - `POST /ai/prioritize` — AI worklist prioritization by expected recovery value

### Appeals Module (`backend/src/modules/appeals/`)
Appeal management with AI-generated appeal letters:
- **Entities**: Appeal (with status workflow, outcome tracking), AppealStatusHistory
- **AppealAiService**: Generates formal appeal letters via Ollama/Mistral, predicts appeal success probability
- **API Endpoints** (all under `/api/v1/appeals`):
  - `POST /from-denial/:denialId` — Create appeal from a denial record
  - `POST /:id/generate-letter` — AI-generate appeal letter
  - `POST /:id/predict-success` — AI predict success probability
  - `POST /:id/submit` — Mark appeal submitted to payer
  - `GET /` — List appeals (filter by status)
  - `GET /stats` — Appeal stats (total, pending, submitted, approved, denied, recovered, success rate)
  - `PATCH /:id/status` — Update appeal status/outcome

### Underpayments Module (`backend/src/modules/underpayments/`)
Underpayment detection and reconciliation:
- **Entities**: PayerContract (contracted fee schedule by CPT), UnderpaymentRecord
- **Detection Engine**: Compares actual paid amounts against contracted rates, flags variances > $5 and > 2%
- **API Endpoints** (all under `/api/v1/underpayments`):
  - `POST /contracts` — Add payer contract rate
  - `GET /contracts` — List contract rates
  - `POST /detect/:remittanceId` — Run underpayment detection on a remittance
  - `GET /` — List underpayment records
  - `GET /stats` — Underpayment stats (by payer, by CPT code)
  - `PATCH /:id/status` — Update status (recovered, disputed, written off, false positive)

### Automation Module (`backend/src/modules/automation/`)
Agentic AI orchestration and predictive denial prevention:
- **RcmAutomationService**: Chains the full pipeline: ERA Import → Payment Posting → Denial Generation → Underpayment Detection → AI Recovery Scoring → Auto-create Appeals
- **DenialPreventionService**: Pre-submission claim risk assessment using AI + heuristic quick-check
- **API Endpoints** (all under `/api/v1/automation`):
  - `POST /pipeline/:remittanceId` — Run full automated RCM pipeline
  - `GET /pipeline/status` — Pipeline run status
  - `POST /prevention/assess` — AI pre-submission denial risk assessment
  - `POST /prevention/quick-check` — Heuristic quick risk check (no AI needed)
