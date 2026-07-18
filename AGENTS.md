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
# Generate migration from entity changes (use the commonjs ts-node wrapper)
npx typeorm-ts-node-commonjs migration:generate -d src/config/database.config.ts src/migrations/MigrationName
# Run pending migrations
npx typeorm-ts-node-commonjs migration:run -d src/config/database.config.ts
# Revert last migration
npx typeorm-ts-node-commonjs migration:revert -d src/config/database.config.ts
```

To enable auto-sync temporarily (dev only), set `DB_SYNCHRONIZE=true` in `.env` or Docker env, then disable it and create a migration before committing.

## Backend Modules

- **Implemented**: Auth, Patients, FHIR, Superbill, ProviderAvailability, AI, Workflow, Prescriptions, Laboratory, Billing, Eligibility, Providers, ICD, Integrations, Medications, Pharmacies, Remittance, Denials, Appeals, Underpayments, Automation, Messaging, Subscriptions
- **Stubs (empty)**: Appointments, Clinical, Notifications, Reports, Telemedicine, Users
- AuthService looks up users via UsersService, falls back to in-memory dev user, and decrypts RSA-OAEP-encrypted passwords from the login form

## Subscriptions Module

The subscriptions module (`backend/src/modules/subscriptions/`) provides SaaS billing, payment method management, and dunning:

### Entities

- **Subscription**: Tenant subscription with plan tier, billing cycle, status (trialing/active/past_due/cancelled/expired), Stripe IDs, trial dates
- **SubscriptionPlan**: Plan catalog (free/professional/enterprise) with monthly/annual pricing and feature limits
- **SubscriptionInvoice**: Invoice history with status tracking (paid/open/failed/void/refunded)
- **SubscriptionPaymentMethod**: Saved payment methods (card/ACH) with brand, last4, expiry, billing address, HSA/FSA flag, default flag
- **SubscriptionPaymentPlan**: Installment payment plans for splitting balances across scheduled payments

### Providers

- **SubscriptionProvider interface**: Abstraction for subscription billing operations
- **StripeSubscriptionProvider**: Real Stripe integration (subscriptions, payment methods, SetupIntents, customer portal, invoice retry, dunning)
- **MockSubscriptionProvider**: In-memory mock for development without Stripe API keys

### API Endpoints (all under `/api/v1/subscriptions`)

- `GET /plans` / `GET /plans/:tier` — List/get subscription plans
- `GET /current` — Get current tenant subscription with plan details
- `POST /change-plan` — Change plan tier and/or billing cycle
- `POST /cancel` — Cancel subscription (immediate or at period end)
- `POST /reactivate` — Reactivate a cancelled subscription
- `GET /invoices` — List invoice history
- `GET /features/:feature` — Check if current plan includes a feature
- **Payment Methods**:
  - `GET /payment-methods` — List saved payment methods
  - `POST /setup-intent` — Create SetupIntent for collecting new payment method
  - `POST /payment-methods/attach` — Attach a confirmed payment method
  - `DELETE /payment-methods/:id` — Detach/remove a payment method
  - `PATCH /payment-methods/:id/default` — Set a payment method as default
  - `GET /payment-methods/expiry-check` — Check for expiring/expired cards
- **Dunning & Retry**:
  - `POST /retry-payment` — Retry a failed invoice payment
- **Customer Portal**:
  - `POST /customer-portal` — Create Stripe Customer Portal session
- **Fee Transparency**:
  - `GET /fee-estimate` — Get processing fee estimates for card vs ACH
- **AI Payment Optimization**:
  - `GET /payment-optimization` — Get AI-driven suggestions (switch to ACH, add backup card, update expired card, annual billing, remove unused methods)
- **Payment Plans**:
  - `GET /payment-plans` — List payment plans
  - `POST /payment-plans` — Create a payment plan (split balance into installments)
  - `POST /payment-plans/:id/installment` — Record an installment payment
  - `POST /payment-plans/:id/cancel` — Cancel a payment plan
- `POST /webhook` — Stripe webhook handler (invoice.payment_succeeded, invoice.payment_failed, customer.subscription.deleted, customer.subscription.updated)

### Notification System

- **SubscriptionNotificationService**: Daily cron job checks for:
  - Trial expiration sequence (7/3/0 days before, post-expiration grace)
  - Upcoming renewal reminders (7 days before)
  - Failed payment dunning (Day 1/3/7/14 with escalating urgency)
  - Expired subscription grace period (14-day healthcare context)
  - **Card expiry notifications** (60 days, 30 days, expired)
- Uses NotificationsModule for in-app + email notifications with deduplication

### Frontend

- **SettingsPage** (`/settings?tab=billing`): Full billing dashboard with:
  - Active subscription card with plan details, features, trial/renewal alerts
  - Payment methods list (card/ACH) with default selection, remove, add
  - Card expiry warnings (expired/expiring soon alerts)
  - Past due retry banner with retry button
  - AI Payment Optimization suggestions card
  - Transaction fee breakdown (card vs ACH comparison)
  - Available plans grid with change plan modal
  - Invoice history table with download links
  - Stripe Customer Portal link
- **UpdatePaymentMethodModal**: Stripe Elements-based modal for adding new payment methods (card or ACH)
- **StripeProvider**: Wraps Stripe Elements with SetupIntent client secret
- **subscriptionService.ts**: Frontend service with all subscription + payment method + payment plan API methods

## Patient Portal

The patient portal provides a dedicated, patient-facing interface separate from the staff EMR. It has its own authentication system, layout, and AI features.

### Patient Authentication

- **Separate JWT strategy** (`patient-jwt`): Patients get tokens with `role: 'patient'`
- **Login endpoint**: `POST /api/v1/patients/auth/login` (requires email, password, tenantId)
- **Other endpoints**: `/patients/auth/refresh`, `/patients/auth/logout`, `/patients/auth/forgot-password`, `/patients/auth/reset-password`, `/patients/auth/me`, `/patients/auth/:patientId/setup-account`
- **Guard**: `PatientJwtAuthGuard` — only validates patient tokens (not staff tokens)
- **Token storage**: `sessionStorage` under key `neuraline_patient_token`
- **Account lockout**: 5 failed attempts = 15-min lockout (same as staff auth)
- **Patient entity** extended with: `passwordHash`, `mfaEnabled`, `mfaSecret`, `portalActive`, `lastLoginAt`, `passwordResetToken`, `passwordResetExpiresAt`

### Patient Portal API (all under `/api/v1/patients/portal`, requires patient JWT)

- `GET /dashboard` — Aggregated summary (appointments, prescriptions, labs, invoices, EOBs, outstanding balance)
- `GET /appointments` — Patient's appointments
- `GET /appointments/available-slots` — Available slots for a provider/date
- `POST /appointments/request` — Request a new appointment (self-scheduling)
- `GET /prescriptions` — Patient's prescriptions
- `POST /prescriptions/:id/refill` — Request a prescription refill
- `GET /lab-results` — Patient's lab orders with tests
- `GET /invoices` — Patient's invoices
- `POST /invoices/:id/pay` — Make a payment on an invoice
- `GET /eobs` — Patient's EOBs from remittance module
- `GET /insurance` — Patient's insurance policies

### Patient Portal AI (all under `/api/v1/patients/portal/ai`, requires patient JWT)

- `POST /explain-lab-result` — AI explains a lab result in plain language
- `POST /assess-symptoms` — AI symptom checker with care navigation (self-care / schedule / urgent care / emergency)
- `POST /check-interactions` — AI medication interaction checker
- `POST /health-education` — AI generates personalized health education articles
- `POST /visit-questions` — AI generates questions to ask your doctor

### Secure Messaging Module (`/api/v1/messaging`)

- **Entities**: `Conversation` (patient-provider thread), `Message` (individual messages)
- **Patient endpoints** (requires patient JWT):
  - `GET /patient/conversations` — List patient's conversations
  - `GET /patient/conversations/:id` — Get conversation with messages (auto-marks read)
  - `POST /patient/conversations` — Start a new conversation
  - `POST /patient/conversations/:id/reply` — Reply to a conversation
  - `GET /patient/unread-count` — Get unread message count
- **Provider endpoints** (requires staff JWT):
  - `GET /provider/conversations` — List all conversations
  - `GET /provider/conversations/:id` — Get conversation with messages
  - `POST /provider/conversations/:id/reply` — Provider replies
  - `POST /provider/conversations/:id/close` — Close a conversation

### Frontend Patient Portal

- **Login page**: `/patient/login` (separate from staff login at `/login`)
- **Portal layout**: `PatientPortalLayout` — dedicated sidebar with patient menu (no admin features)
- **Route guard**: `PatientRoute` — redirects to `/patient/login` if not authenticated
- **Pages**:
  - `/portal` (dashboard) — Summary with stats and recent items
  - `/portal/appointments` — View appointments + request new ones with slot picker
  - `/portal/prescriptions` — View prescriptions + request refills
  - `/portal/lab-results` — View lab results with collapsible test details
  - `/portal/billing` — View invoices + make payments
  - `/portal/eobs` — View insurance EOBs with adjustment details
  - `/portal/insurance` — View insurance policies
  - `/portal/messages` — Secure messaging with care team
  - `/portal/ai-assistant` — AI Health Assistant (5 tabs: lab explainer, symptom checker, drug interactions, health education, visit prep)
  - `/portal/profile` — View profile information

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
- `POST /claims/:id/submit` — Submit a READY_TO_BILL claim to the clearinghouse (Stedi 837 or mock). On success moves to SUBMITTED and stores `metadata.clearinghouseTrackingId`.
- `GET /claims/:id/submission-status` — Poll the clearinghouse for the latest submission status of a previously submitted claim
- `POST/GET /invoices` / `GET /invoices/:id` / `PATCH /invoices/:id` / `DELETE /invoices/:id` — Invoice CRUD
- `PATCH /invoices/:id/status` — Update invoice status
- `POST /invoices/:id/payment` — Record patient payment (used internally by the payments module)
- `GET /payers` / `GET /payers/:id` — Insurance payer master
- `GET /patients/:patientId/insurance` — Patient's active insurance policies

### Claim Submission (Clearinghouse Integration)

The billing module ships with a pluggable claims provider (`ClaimsProvider` interface) that translates an `EncounterClaim` into an X12 837-equivalent JSON payload and submits it to a clearinghouse.

- **Provider selection** (in `billing.module.ts`): if `STEDI_API_KEY` is set, `StediClaimsProvider` is used; otherwise `MockClaimsProvider` returns a fake accepted tracking id for development.
- **Stedi provider** (`providers/stedi-claims.provider.ts`): POSTs to Stedi's claims API (`/change/medicalnetwork/claims/v2`), builds the subscriber/patient/provider/service-lines payload from the claim + patient insurance, and parses the ack into a tracking id.
- **Trading partner routing**: each `InsurancePayer` should have `metadata.tradingPartnerId` set (the seeder populates this for common payers). The submit flow resolves it from the payer master, falling back to the patient's `PatientInsurance.payer.metadata.tradingPartnerId`.
- **Lifecycle**: `DRAFT → READY_TO_BILL` (via `PATCH /claims/:id/status`) → `SUBMITTED` (via `POST /claims/:id/submit`). From there the remittance module's 835 auto-post moves the claim to `PAID` / `DENIED` / `PARTIALLY_PAID` when the ERA arrives.
- **Status polling**: `GET /claims/:id/submission-status` calls the clearinghouse and persists the result to `metadata.lastStatusPoll`.

### Insurance Payer Auto-Seed

On first boot, `BillingSeedService` seeds 12 common US payers (Medicare, Medicaid, Aetna, BCBS, Cigna, UHC, Humana, Molina, Anthem, Kaiser, TRICARE, Aetna Better Health) with `metadata.tradingPartnerId` and `ediPayerId` for Stedi routing. Payers are stored under a shared sentinel tenant UUID so they're available to all tenants; tenants can add their own payers with their real `tenantId`.

## Payments Module

The payments module (`backend/src/modules/payments/`) provides real patient payment processing for invoices, with a pluggable provider abstraction.

### Entities

- **Payment**: Records a payment attempt against an invoice with status (pending → succeeded/failed/refunded), method (card/ach/cash/check), provider name, provider payment id, and client secret (for Stripe.js).

### Provider Abstraction

- **`PaymentsProvider` interface**: `createPaymentIntent`, `confirmPayment`, `parseWebhook`
- **`MockPaymentsProvider`**: No network calls — simulates a succeeded intent. Used when `STRIPE_API_KEY` is not set.
- **`StripePaymentsProvider`**: Uses the Stripe REST API directly via `fetch` (no SDK dependency). Creates PaymentIntents, confirms server-side, and parses webhook events. Activate by setting `STRIPE_API_KEY` + `STRIPE_WEBHOOK_SECRET`.

### API Endpoints (all under `/api/v1/payments`, requires JWT except webhook)

- `POST /intent` — Create a payment intent for an invoice (validates amount ≤ balance due, creates Payment record, calls provider). Returns `clientSecret` for Stripe.js.
- `POST /confirm` — Confirm a pending payment. On success, posts the payment to the invoice via `BillingService.recordPayment` and updates invoice status.
- `GET /:id` — Get a payment by id
- `GET /invoice/:invoiceId` — List payments for an invoice
- `GET /patient/:patientId` — List payments for a patient
- `POST /webhook` — Stripe webhook endpoint (NOT JWT-guarded). Verifies signature, updates Payment status, posts to invoice on success.

### Integration Flow

1. Patient portal calls `POST /payments/intent` with `{ invoiceId, patientId, amount }`
2. Backend creates a `Payment` record (pending) + Stripe PaymentIntent, returns `clientSecret`
3. Frontend (Stripe.js) confirms the card payment using the `clientSecret`
4. Either: frontend calls `POST /payments/confirm`, OR Stripe sends a webhook to `POST /payments/webhook`
5. On success, `BillingService.recordPayment` posts the amount to the invoice → invoice becomes `PAID` or `PARTIALLY_PAID`

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
2. Transcription via **AssemblyAI** (`POST /api/v1/ai/transcribe`) — set `ASSEMBLYAI_API_KEY` in `.env`
3. SOAP note generation via Ollama/Mistral (`POST /api/v1/ai/generate-soap`)
4. Medical code suggestions (`POST /api/v1/ai/suggest-codes`)

### AssemblyAI Transcription

- The `POST /api/v1/ai/transcribe` endpoint accepts an audio file upload (`multipart/form-data`, field name `file`) and forwards it to the AssemblyAI REST API.
- Requires `ASSEMBLYAI_API_KEY` in the backend environment.
- Returns: `{ text, duration, confidence, words, languageCode, provider: "assemblyai" }`.
- File size limit: 100 MB.
- The legacy Whisper service (`WHISPER_SERVICE_URL`) is no longer used by the AI Encounter page but is kept for fallback / local-only deployments.

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

## Telemedicine Module (`backend/src/modules/telemedicine/`)

Real-time video visits with WebRTC signaling, session lifecycle, and AI-powered post-visit documentation.

### Backend

- **Entity**: `TelemedicineSession` with participants, chat, shared files, recording consent/status, AI SOAP note, suggested ICD/CPT codes, encounter/superbill links.
- **Provider abstraction**: `TelemedicineProvider` interface with a `MockTelemedicineProvider` (Daily.co provider can be added by implementing the interface and setting `ACTIVE_TELEMEDICINE_PROVIDER=daily`).
- **WebSocket gateway**: `/telemedicine` namespace with JWT auth; handles join/leave, WebRTC offer/answer/ICE, chat, screen-share events, recording-consent flow, and connection-quality updates.
- **REST endpoints** (`/api/v1/telemedicine`, JWT):
  - `POST /sessions` — Create a session for an appointment
  - `GET /sessions` — List sessions with filters
  - `GET /sessions/:id` — Get session details
  - `GET /sessions/:id/token` — Get short-lived token to join the video room
  - `PATCH /sessions/:id/end` — End visit; optionally auto-generates an Encounter and a Superbill
  - `PATCH /sessions/:id/cancel` — Cancel session
  - `POST /sessions/:id/intake` — AI pre-visit triage/questions
  - `GET /sessions/:id/care-plan` — AI post-visit care plan
  - `GET /analytics` — Session analytics
- **Patient portal endpoint** (`/api/v1/patients/portal/telemedicine`, patient JWT):
  - `GET /sessions/:id/token` — Patient token to join their visit

### Frontend

- `VideoRoom` component (React + simple-peer + socket.io-client): 1:1/group-capable WebRTC room with mute, camera toggle, screen share, in-visit chat, and recording-consent UI.
- Staff `TelemedicinePage`: start/admit visits, waiting room, past visits, post-visit AI summary (SOAP, suggested codes, encounter/superbill links, AI care plan).
- Patient `PortalVideoVisitPage`: patient joins from the portal appointments page (`/portal/visit/:sessionId`).

## Documentation Index

- `docs/ARCHITECTURE.md` — System architecture overview
- `docs/EOB-ERA-DENIAL-GAP-ANALYSIS.md` — RCM gap analysis
- `docs/PATIENT-PORTAL-GAP-ANALYSIS.md` — Patient portal competitor analysis
- `docs/FREE-TRIAL-ARCHITECTURE.md` — 15-day free trial provisioning architecture (Docker-based isolated instances, trial lifecycle, auto-expiry, conversion path)
