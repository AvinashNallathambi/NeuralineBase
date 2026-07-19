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

### Payment Workflow & Security
- **Stripe handles recurring billing automatically** after a subscription is created with a Stripe Price ID. No backend scheduler initiates charges.
- **SetupIntent flow** (`POST /setup-intent` → Stripe Elements → `POST /payment-methods/attach`) collects payment details directly in Stripe's iframe. Card data never touches the backend.
- **Default payment method** is set on both the Stripe Customer and the Subscription, ensuring renewals use the correct card/bank.
- **Webhook security**:
  - Webhooks are verified with Stripe's official SDK using `STRIPE_WEBHOOK_SECRET`.
  - The raw request body is captured via a custom Express body parser (`bodyParser: false` + `verify` hook) so signature verification succeeds.
  - In production, `STRIPE_WEBHOOK_SECRET` is required; unverified webhooks are rejected with `400`.
- **Webhook idempotency**: Each Stripe event ID is recorded in `subscription_webhook_events`; duplicate events are ignored.
- **Invoice sync**: `invoice.payment_succeeded` and `invoice.payment_failed` webhooks upsert `SubscriptionInvoice` records, so the invoice history table stays current.
- **Trial enforcement**: `hasFeature` and `canAddProvider` deny access when the subscription is `past_due`/`cancelled`/`expired`, or when a trial has ended without a default payment method on file.
- **Plan change proration**: Upgrades use `create_prorations`; downgrades use `none` to avoid surprising credits/charges.
- **Mock billing simulation**: When `STRIPE_API_KEY` is empty, the daily job simulates trial conversion, renewals, and dunning/expiration using the database as the source of truth for payment methods.
- **Stripe Price IDs** are loaded from environment variables (`STRIPE_PRICE_*`) during plan seeding. Create the products/prices in Stripe first, then populate `.env` before enabling Stripe mode.

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
The billing module (`backend/src/modules/billing/`) provides claim lifecycle management, invoicing, insurance master data, AI card scanning, COB detection, coverage gap detection, and secondary claim auto-generation:

### Entities
- **EncounterClaim**: Insurance claims with status workflow (draft → ready_to_bill → submitted → paid/denied/partially_paid/appealed → cancelled). Now includes `patientInsuranceId` FK to PatientInsurance and `claimFrequency` field (1=original, 7=replacement/secondary, 8=void)
- **ClaimLineItem**: Individual service lines (CPT/ICD-10 coded with modifiers, diagnosis pointers, adjudication amounts)
- **Invoice**: Patient invoices (cash_pay, self_pay, balance_due) with payment tracking
- **InsurancePayer**: Insurance company master data with EDI submission URLs
- **PatientInsurance**: Patient insurance policies (primary/secondary/tertiary) with subscriber details, financial fields (copay, deductible, coinsurance), and card image storage (`cardFrontImage`, `cardBackImage`, `cardExtractedConfidence`)

### Services
- **BillingService**: Core claim/invoice/payer/insurance CRUD operations
- **InsuranceCardScanService**: AI-powered insurance card OCR using vision LLM (Ollama llava or OpenAI-compatible vision models). Extracts policy number, group number, subscriber info, copay, deductible, coinsurance with confidence scores. Auto-matches extracted payer name to InsurancePayer master data.
- **CobService**: AI-powered Coordination of Benefits order detection. Applies CMS MSP (Medicare Secondary Payer) rules to suggest correct primary/secondary/tertiary ordering. Falls back to rule-based COB when AI unavailable.
- **CoverageGapDetectorService**: Daily scheduler that scans patients with upcoming appointments for insurance gaps (no insurance, expired policy, expiring soon, no recent verification). Creates notifications for staff.
- **SecondaryClaimService**: AI-powered secondary claim auto-generation. Analyzes paid primary claims, calculates remaining balance, estimates secondary payment, and generates secondary claim with COB indicators (claim frequency code 7).

### API Endpoints (all under `/api/v1/billing`)
- `POST/GET /claims` / `GET /claims/:id` / `PATCH /claims/:id` / `DELETE /claims/:id` — Claim CRUD
- `PATCH /claims/:id/status` — Update claim status (state-machine validated)
- `POST /claims/:id/calculate` — Calculate claim totals from line items
- `POST /claims/:id/analyze-secondary` — AI: Analyze paid primary claim for secondary claim opportunity
- `POST /claims/:id/generate-secondary` — AI: Auto-generate secondary claim from paid primary claim
- `POST/GET /invoices` / `GET /invoices/:id` / `PATCH /invoices/:id` / `DELETE /invoices/:id` — Invoice CRUD
- `PATCH /invoices/:id/status` — Update invoice status
- `POST /invoices/:id/payment` — Record patient payment
- `GET /payers` / `GET /payers/:id` — Insurance payer master
- `POST /payers` — Create insurance payer
- `PATCH /payers/:id` — Update insurance payer
- `GET /patients/:patientId/insurance` — Patient's active insurance policies
- `POST /patients/:patientId/insurance` — Create patient insurance policy (auto-assigns priority if not specified)
- `PATCH /patients/:patientId/insurance/:id` — Update patient insurance policy
- `DELETE /patients/:patientId/insurance/:id` — Soft-delete patient insurance policy
- `PATCH /patients/:patientId/insurance/:id/priority` — Update insurance priority (swaps with existing if promoting to primary)
- `POST /patients/:patientId/insurance/card-scan` — AI: Scan insurance card images (front/back) with vision LLM OCR
- `POST /patients/:patientId/insurance/suggest-cob-order` — AI: Suggest COB order based on CMS MSP rules
- `POST /patients/:patientId/insurance/apply-cob-order` — Apply COB order suggestion
- `POST /coverage-gaps/scan` — Trigger coverage gap scan for upcoming appointments
- `GET /patients/:patientId/coverage-gaps` — On-demand coverage gap check for a patient

### Patient Portal Insurance Endpoints (under `/api/v1/patients/portal`, requires patient JWT)
- `GET /insurance` — Get patient's insurance policies
- `POST /insurance/card-scan` — Patient self-service: scan insurance card with AI OCR
- `POST /insurance/request-update` — Patient submits scanned insurance data for staff review

### Eligibility AI Endpoints (under `/api/v1/eligibility/ai`, requires staff JWT)
- `POST /alerts/:id` — Generate actionable eligibility alerts (coverage, auth, referral, financial, expiry) with severity levels
- `POST /summary/:id` — Generate plain-English eligibility summary
- `POST /parse-271/:id` — Parse raw X12 271 response with AI
- `POST /estimate-responsibility/:id` — Estimate patient financial responsibility
- `POST /denial-risk/:id` — Assess claim denial risk
- `POST /prior-auth/:id` — Draft prior authorization request letter

### Frontend Insurance Management
- **PatientInsuranceManager** component (`frontend/src/components/patients/PatientInsuranceManager.tsx`): Full multi-policy insurance CRUD with:
  - Primary/secondary/tertiary priority selector with up/down arrows
  - Payer dropdown from InsurancePayer master data
  - Subscriber information (name, DOB, relation, SSN)
  - Coverage dates (effective/expiration)
  - Financial details (copay, deductible, coinsurance)
  - AI insurance card scanning (front/back upload with auto-extraction)
  - Confidence indicators and warnings for low-confidence extracted fields
  - Integrated into PatientDetailPage
- **billingService.ts**: Frontend service with all insurance CRUD, card scan, COB order, coverage gap, and secondary claim methods
- **eligibilityService.ts**: Frontend service with eligibility alerts and summary methods

### AI Vision Configuration
- **Ollama**: Set `OLLAMA_VISION_MODEL` env var (default: `llava`). Pull with `ollama pull llava`
- **OpenRouter**: Set `OPENROUTER_VISION_MODEL` env var (e.g., `google/gemini-2.0-flash-exp:free`)
- **OpenAI**: Set `OPENAI_VISION_MODEL` env var (e.g., `gpt-4o`)
- The `AiService.visionGenerateStructured()` method supports both Ollama and OpenAI-compatible vision APIs

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

## Integrations Module
The integrations module (`backend/src/modules/integrations/`) provides a pluggable integration framework with OAuth support, test-connection, config schemas, and audit logging:

### Entities
- **Integration**: Tenant integration with key, name, category, status (disconnected/connected/error/pending), config (JSONB), credentials (encrypted JSONB), requiresOAuth, configurable, lastConnectedAt, errorMessage
- **IntegrationAuditLog**: Audit trail of all integration changes (enable/disable/configure/test/oauth)

### Integration Catalog (22 integrations across 10 categories)
- **Calendar**: Google Calendar, Outlook/Microsoft 365 Calendar (OAuth, two-way sync)
- **Communication**: Twilio SMS, RingCentral (OAuth, voice/SMS/fax), Email Notifications (Resend/SendGrid/SES/SMTP)
- **Video**: Zoom, Microsoft Teams, Google Meet (OAuth, meeting creation)
- **Clinical**: RxNorm Medication Database
- **Pharmacy**: Pharmacy Network (Surescripts), EPCS, PDMP, Formulary, ePA (CoverMyMeds), Medication History
- **Lab**: Lab Systems (Quest/LabCorp/BioReference)
- **Billing**: Insurance Clearinghouse (Availity/Change Healthcare/Waystar), Stripe Payments
- **EHR**: EHR Interoperability (FHIR R4)
- **AI**: AI Prescribing Assistant, Voice-to-Prescription
- **Patient Engagement**: Email Notifications

### Provider Abstractions
- **CalendarProvider**: `testConnection`, `getAuthUrl`, `exchangeCode`, `refreshToken`, `upsertEvent`, `deleteEvent`, `listEvents`, `syncFromAppointments`
- **SmsProvider**: `testConnection`, `sendSms`, `makeCall`, `sendFax`, `getMessageStatus`, `parseWebhook`
- **VideoProvider**: `testConnection`, `getAuthUrl`, `exchangeCode`, `createMeeting`, `getMeeting`, `updateMeeting`, `deleteMeeting`, `getJoinToken`

### Provider Implementations
- **Calendar**: MockCalendarProvider, GoogleCalendarProvider (Google Calendar API v3), OutlookCalendarProvider (Microsoft Graph)
- **SMS**: MockSmsProvider, TwilioSmsProvider (Twilio REST API), RingCentralProvider (RingCentral REST API)
- **Video**: MockVideoProvider, ZoomProvider (Server-to-Server OAuth), MsTeamsProvider (Microsoft Graph), GoogleMeetProvider (Google Calendar with Meet conference data)

### Config Schemas
Each integration has a `IntegrationConfigSchema` that defines its configuration fields (text, password, select, boolean, url, phone, number). Fields marked `isCredential` are stored in the encrypted `credentials` column and never exposed to the frontend. The frontend uses these schemas to render dynamic config forms.

### API Endpoints (all under `/api/v1/integrations`)
- `GET /` — List all integrations (credentials stripped)
- `GET /:key` — Get single integration (credentials stripped)
- `PUT /:key` — Update integration (admin only) — splits config into visible config vs encrypted credentials
- `GET /schemas` — Get all config schemas
- `GET /schemas/:key` — Get config schema for a single integration
- `POST /:key/test` — Test connection (admin only)
- `POST /:key/oauth/url` — Get OAuth authorization URL (admin only)
- `POST /:key/oauth/callback` — Handle OAuth callback (admin only)
- `GET /audit-logs` — Get audit logs (admin only, optional `key` and `limit` query params)

### Frontend
- **IntegrationConfigDrawer** (`frontend/src/pages/settings/IntegrationConfigDrawer.tsx`): Config drawer with:
  - Dynamic form fields rendered from config schema
  - OAuth connect button (opens popup for Google/Microsoft/RingCentral)
  - Test connection button
  - Status badge (connected/disconnected/error/pending)
  - Error messages for failed connections
  - Last connected timestamp
  - Recent activity timeline (audit log)
  - Help text and setup instructions
- **IntegrationCard**: Card with icon, name, description, provider tag, status badge, OAuth/configurable tags, enable/disable switch, error banner
- **IntegrationsTabContent**: Groups integrations by category (Calendar, Communication, Video, Clinical, Pharmacy, Lab, Billing, EHR, AI, Patient Engagement)

### Integration Wiring
- **Appointments → Calendar**: When an appointment is created or updated, if Google Calendar or Outlook is enabled, the appointment is synced to the calendar via `upsertEvent`
- **Notifications → SMS**: When appointment reminders are sent, if Twilio or RingCentral is enabled, an SMS is also sent
- **Telemedicine → Video**: When a telehealth appointment needs a meeting link, if Zoom/Teams/Meet is enabled, a meeting is created via the video provider

## AI Module — Additional Features
The AI module (`backend/src/modules/ai/`) includes these additional endpoints beyond the core SOAP/coding/transcription features:

### AI Endpoints (all under `/api/v1/ai`)
- `POST /prior-auth-letter` — Generate a prior authorization letter from clinical notes
- `POST /denial-risk` — Predict claim denial risk (low/medium/high, score, factors, recommendations)
- `POST /coding-audit` — Audit clinical documentation for coding completeness (missing HPI/ROS/MDM, under/over-coding)
- `POST /noshow-prediction` — Predict appointment no-show risk (probability, factors, recommendations)
- `POST /cdi-review` — Clinical Documentation Improvement review (missing elements, quality score, audit risk)
- `POST /drug-dosing` — AI-powered drug dosing recommendations (renal/hepatic adjustments, warnings, alternatives)
- `POST /referral-letter` — Generate a referral letter to a specialist
