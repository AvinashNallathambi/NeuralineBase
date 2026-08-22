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
- **NEVER use `DB_SYNCHRONIZE=true` in production.** The backend has a startup guard
  that will refuse to boot if `DB_SYNCHRONIZE=true` and `NODE_ENV=production`.
  CI also checks that `.env.example` files don't default to `DB_SYNCHRONIZE=true`.
  Using synchronize in production causes schema drift, untracked changes, and
  data loss (renamed columns are dropped). Always use migrations instead.

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

**Migration rules:**
- All `CREATE TABLE`, `CREATE TYPE`, and `CREATE INDEX` statements MUST use `IF NOT EXISTS`
- CI checks this automatically (migration-safety job) — bare CREATE statements will fail CI
- To enable auto-sync temporarily (dev only), set `DB_SYNCHRONIZE=true` in `.env`,
  then disable it and create a migration before committing.
- Never commit `.env` with `DB_SYNCHRONIZE=true`

## Backend Modules
- **Implemented**: Auth, Patients, FHIR, Superbill, ProviderAvailability, AI, Workflow, Prescriptions, CarePlans, Laboratory, Billing, Eligibility, Providers, ICD, Integrations, Medications (drug DB + PatientMedications), Pharmacies, Remittance, Denials, Appeals, Underpayments, Automation, Messaging, Subscriptions, Immunizations, Growth, RiskManagement, QualityMeasures
- **Stubs (empty)**: Appointments, Clinical, Notifications, Telemedicine, Users
- AuthService looks up users via UsersService, falls back to in-memory dev user, and decrypts RSA-OAEP-encrypted passwords from the login form

## Quality Measures Module
The `QualityMeasuresModule` (`backend/src/modules/quality-measures/`) provides formal clinical quality measure tracking with deterministic calculation, AI-powered gap closure recommendations, and persistent results:

### Entities
- **QualityMeasureResult** (`quality_measure_results` table) — one row per patient × measure × reporting period, stores status (met/not_met/overdue/not_applicable), last value, target, explanation, recommendation, data elements, cross-program mappings

### Measure Registry
- `measure-registry.ts` — 12 seeded eCQM/MIPS/HEDIS measure definitions covering diabetes care (HbA1c, eye exam, nephropathy), hypertension control, statin therapy, cancer screening (colorectal, breast, cervical), immunizations (influenza, pneumococcal), depression screening, and tobacco screening
- Each measure has: qualifying ICD-10 codes, required lab LOINC codes, frequency, target value, cross-program mappings, priority, and closeable-in-visit flag
- `getApplicableMeasures()` filters measures by patient age, sex, and active diagnoses

### Calculation Engine
- `QualityMeasuresService.calculateMeasure()` — deterministic logic per measure that evaluates labs, vitals, medications, immunizations, encounter SOAP notes, and social history
- Extracts data elements driving each result for explainability (source, field, value, date)
- Generates human-readable explanations for each measure status
- Checks reporting period compliance (annual, 27-month mammography, 3/5-year cervical, flu season)

### AI Integration
- `generateAiRecommendations()` — sends open gaps to AI for prioritized action recommendations and visit-readiness assessment
- `generateAiInsights()` — practice-level AI summary of quality performance and improvement opportunities

### API Endpoints (all under `/api/v1/quality-measures`)
- `GET /patients/:patientId` — Full quality profile with all applicable measures, summary, and AI recommendations
- `GET /dashboard` — Practice-level dashboard with per-measure compliance rates, top gaps, and AI insights
- `GET /registry` — All measure definitions in the registry

### Frontend
- `qualityMeasuresService.ts` — API service with TypeScript types
- `QualityMeasuresTab.tsx` — Patient-level tab with compliance summary, AI recommendations, and expandable measures table
- `QualityMeasuresDashboardPage.tsx` — Practice-level dashboard page at `/quality-measures`
- Sidebar navigation: "Quality Measures" under Reports
- Patient detail page: "Quality Measures" tab (next to Risk Management)

### Migration
- `CreateQualityMeasureResults1789300000000` — creates `quality_measure_results` table with indexes and FK to patients

## NSA (No Surprises Act) Module
The `NsaModule` (`backend/src/modules/nsa/`) provides full No Surprises Act compliance with AI-powered features across GFE generation, delivery tracking, variance detection, and IDR dispute resolution:

### Entities
- **GoodFaithEstimate** (`good_faith_estimates` table) — persisted GFE with version history, delivery tracking, acknowledgment, variance status, AI accuracy scores, patient-friendly explanation, diagnosis predictions, and reconciliation data
- **NsaVarianceRecord** (`nsa_variance_records` table) — tracks variance between GFE estimate and final billed amount; flags $400+ threshold for dispute
- **NsaIdrCase** (`nsa_idr_cases` table) — Independent Dispute Resolution case with jurisdiction routing, eligibility scoring, open negotiation offers, win probability, patient acuity letter, and support documents
- **NsaIdrDeadline** (`nsa_idr_deadlines` table) — tracks IDR deadlines (30-business-day open negotiation, 4-business-day IDR initiation, 10-business-day submission)

### GFE Types
- `insured_oon` — Out-of-network insured patient (NSA balance billing protections)
- `self_pay` — Self-pay patient (full charge as patient estimate)
- `uninsured` — Uninsured patient (full charge as patient estimate)

### GFE Status Workflow
`draft` → `delivered` → `acknowledged` | `disputed` | `expired` | `superseded`

### Delivery Tracking
- **Methods**: portal, email, mail, in_person, verbal_witness
- **3-business-day deadline**: auto-calculated excluding weekends and all 11 US federal holidays
- **On-time compliance**: automatically checked when GFE is marked delivered
- **Version history**: superseded GFEs are preserved; new versions increment version number

### $400 Variance Detection
- Compares final billed amount to GFE total charge
- Flags variance ≥ $400 (NSA threshold) for dispute
- Per-item variance tracking by CPT code
- Auto-updates GFE status to `disputed` when threshold exceeded

### AI Features (P1 — Differentiators)
- **Estimate Accuracy Predictor** (`POST /nsa/gfe/:id/predict-accuracy`) — predicts how accurate the GFE is likely to be vs final bill; flags high-risk estimates before delivery; uses historical reconciliation data
- **GFE-to-Claim Reconciliation Loop** (`POST /nsa/gfe/:id/reconcile`) — compares GFE to actual ERA/claim amounts; generates per-item variance, insights, and rate corrections for future estimates
- **Patient-Friendly GFE Explainer** (`POST /nsa/gfe/:id/patient-explanation`) — generates plain-language (6th-grade reading level) explanation of GFE for patient portal; explains $400 dispute right
- **Diagnosis-Code Completion** (`POST /nsa/gfe/:id/predict-diagnosis`) — predicts likely ICD-10 codes from patient history + chief complaint for pre-encounter GFEs

### AI Features (P2 — IDR Dispute Resolution)
- **IDR Eligibility Engine** (`POST /nsa/idr/:id/assess-eligibility`) — scores claim eligibility for IDR; determines federal vs state jurisdiction; estimates expected recovery
- **Open Negotiation Offer Generator** (`POST /nsa/idr/:id/generate-offer`) — generates data-backed offer using QPA, median in-network rates, and case complexity
- **State/Federal Jurisdiction Router** (`POST /nsa/idr/:id/route-jurisdiction`) — routes to federal NSA or state-specific law (CA AB 72, NY, TX SB 1264, NJ OON Act) based on patient state, payer type, and service
- **Patient Acuity Letter** (`POST /nsa/idr/:id/acuity-letter`) — auto-generates clinical justification letter from encounter notes for IDR submission

### AI Features (P3 — Win Probability)
- **IDR Win-Probability Model** (`POST /nsa/idr/:id/win-probability`) — predicts win probability using historical outcomes, payer behavior, case strength; recommends optimal final offer
- **Deadline Tracking** (`GET /nsa/deadlines`) — auto-updates deadline statuses (upcoming → due_soon → overdue); supports marking deadlines as met

### API Endpoints (all under `/api/v1/nsa`)
- `POST /gfe` — Create GFE manually
- `POST /gfe/generate-from-superbill` — Generate GFE from superbill via AI and persist
- `GET /gfe` — List GFEs (filter by patientId or status)
- `GET /gfe/:id` — Get single GFE
- `PATCH /gfe/:id` — Update GFE
- `POST /gfe/:id/new-version` — Create new version (supersedes original)
- `POST /gfe/:id/deliver` — Mark delivered (checks on-time compliance)
- `POST /gfe/:id/acknowledge` — Record patient acknowledgment
- `POST /gfe/:id/variance` — Detect $400 variance
- `GET /variance` — List variance records
- `POST /variance/:id/resolve` — Resolve variance record
- `GET /dashboard` — NSA compliance dashboard metrics
- `POST /gfe/:id/predict-accuracy` — AI accuracy prediction
- `POST /gfe/:id/reconcile` — AI GFE-to-claim reconciliation
- `POST /gfe/:id/patient-explanation` — AI patient-friendly explanation
- `POST /gfe/:id/predict-diagnosis` — AI diagnosis code prediction
- `POST /idr` — Create IDR case
- `GET /idr` — List IDR cases
- `GET /idr/:id` — Get IDR case
- `PATCH /idr/:id` — Update IDR case
- `POST /idr/:id/assess-eligibility` — AI eligibility assessment
- `POST /idr/:id/generate-offer` — AI open negotiation offer
- `POST /idr/:id/route-jurisdiction` — AI jurisdiction routing
- `POST /idr/:id/acuity-letter` — AI patient acuity letter
- `POST /idr/:id/win-probability` — AI win probability
- `GET /idr/:id/deadlines` — List deadlines for IDR case
- `GET /deadlines` — List all deadlines (auto-updates statuses)
- `POST /deadlines/:id/met` — Mark deadline as met

### Patient Portal Endpoints (under `/patients/portal`)
- `GET /gfe-estimates` — Patient views their GFEs
- `GET /gfe-estimates/:id` — Patient views specific GFE
- `POST /gfe-estimates/:id/acknowledge` — Patient acknowledges GFE receipt

### Frontend
- `nsaService.ts` — API service with full TypeScript types
- `GfePanel.tsx` — Upgraded GFE panel with persistence, delivery tracking, AI accuracy prediction, patient explanation, variance detection
- `NsaDashboardPage.tsx` — NSA compliance dashboard at `/nsa` with metrics, IDR case management, deadline tracking
- `PortalGfePage.tsx` — Patient portal GFE page at `/portal/gfe-estimates` with view + acknowledge

### Business Day Calculator
`BusinessDayCalculator` service handles all NSA deadline calculations:
- US federal holidays (fixed + floating: MLK Day, Presidents Day, Memorial Day, Labor Day, Columbus Day, Thanksgiving)
- 3-business-day GFE delivery deadline (before service date)
- 30-business-day open negotiation period
- 4-business-day IDR initiation deadline
- 10-business-day IDR submission deadline

### Migration
- `CreateNsaModule1790000000000` — creates `good_faith_estimates`, `nsa_variance_records`, `nsa_idr_cases`, `nsa_idr_deadlines` tables with all indexes (all `IF NOT EXISTS` guarded)

## Patient Medications Module
The `PatientMedications` feature lives inside the `MedicationsModule` and provides a longitudinal medication list distinct from e-prescriptions:
- **Entity**: `PatientMedication` (`patient_medications` table) — tracks what the patient is *actually taking*, not just what was prescribed
- **Sources**: `prescription` | `patient_reported` | `pbm_history` | `encounter` — supports OTC, supplements, herbal, outside-provider meds
- **Taking status**: `taking` | `taking_differently` | `not_taking` | `unknown` | `completed` — matches Epic's medication reconciliation model
- **Medication reconciliation**: `isReviewed`, `reviewedAt`, `reviewedBy` fields for tracking reconciliation
- **API**: `/api/v1/patient-medications` — CRUD, `findByPatient`, `updateTakingStatus`, `markReviewed`
- **Frontend**: `patientMedicationService.ts` + `Medications` tab on `PatientDetailPage` (separate from `E-Prescriptions` tab)

## Care Plans Module
The `CarePlansModule` provides longitudinal care management with goals, monitoring tasks, and care team coordination:
- **Entities**: `CarePlan` (`care_plans`), `CarePlanGoal` (`care_plan_goals`), `CarePlanTask` (`care_plan_tasks`)
- **CarePlan**: persistent, cross-encounter plan with health concerns, care team, patient education, AI-generated flag, provider approval workflow
- **CarePlanGoal**: measurable goals with target values, current values, direction (decrease/increase/maintain), auto-achievement detection
- **CarePlanTask**: monitoring/patient/care-team tasks with frequency, due dates, patient-reported values, goal linkage
- **Task types**: monitoring, lab_order, imaging_order, medication_adherence, patient_education, questionnaire, appointment, care_team_action, lifestyle, follow_up, referral, custom
- **API**: `/api/v1/care-plans` — full CRUD for plans, goals, tasks; `completeTask`, `reportTaskValue`, `approve`
- **Patient portal**: `/portal/care-plan` — patients view approved plans, complete tasks, report vital readings
- **AI endpoints** (`/api/v1/ai`): `generate-care-plan`, `suggest-monitoring-tasks`, `risk-stratification`, `care-gap-detection`
- **Migration**: `CreatePatientMedicationsAndCarePlans1788000000000`

### Encounter Medication Sync → Patient Medications
`EncounterOrderSyncService` now also synchronizes encounter `treatmentPlan.medications` into the `patient_medications` table (in addition to `prescriptions`):
- Each encounter medication creates a `PatientMedication` with `source: 'encounter'`, `takingStatus: 'taking'`, `status: 'active'`
- Dedup key: `encounterId` + medication name (case-insensitive)
- Removed encounter medications are marked `not_taking` (only if still active)
- This ensures the patient's medication list stays current with what was documented during encounters

### Medication Reconciliation at Encounter Start
The encounter detail page (`EncounterDetailPage.tsx`) now includes a **Medication Reconciliation** section (Section 4b) that appears before the Prescribed Medications section:
- Fetches the patient's active medications from `patient_medications` on encounter load
- Shows each medication with source tag, taking-status selector (Taking / Taking Differently / Not Taking / Unknown), and review status
- "Mark All Reviewed" button marks all meds as reviewed for reconciliation
- "Add to Rx" button copies an existing patient medication into the encounter's prescribed medications list
- Taking-status changes are saved immediately to the `patient_medications` table

### AI Care Plan Generation
The Care Plans tab on the patient detail page includes a **"Generate AI Care Plan"** button:
- Sends the patient's active problems (from the problem list), current medications, allergies, age, and sex to `POST /ai/generate-care-plan`
- AI returns a complete plan with title, description, goals (measurable with targets), tasks (monitoring, education, lifestyle), patient education content, and care team roles
- Provider reviews the AI plan in a preview modal, then saves it
- Saved plans are marked `isAiGenerated: true` and `isApproved: false` — provider must approve before the patient sees it
- On approval, the plan becomes visible in the patient portal at `/portal/care-plan`

### Encounter Order Sync
Lab orders, imaging orders, and medications added in the encounter editor are stored in the encounter's JSONB columns (`encounter.orders` and `encounter.treatmentPlan.medications`). The `EncounterOrderSyncService` (`backend/src/modules/clinical/encounter-order-sync.service.ts`) propagates these into the real `lab_orders`, `imaging_orders`, and `prescriptions` tables on encounter `create`, `update`, and `sign`. This makes them visible in the Laboratory module, Prescriptions module, patient portal, and enables the full order lifecycle (collect → result → complete).
- **Dedup key**: Lab orders by `encounterId` + test name; imaging orders by `encounterId` + study name; medications by `encounterId` + medication name (all case-insensitive).
- **Status updates**: Only orders still in `draft`/`ordered` (labs), `ordered`/`scheduled` (imaging), or `draft` (prescriptions) are updated by the sync. Orders that have progressed are left alone — the lab/radiology/pharmacy team owns the lifecycle from that point.
- **Medications**: Encounter medications are created as `active` prescriptions in the `prescriptions` table, so they immediately appear in the patient portal's Prescriptions page and the patient detail page's Medications tab.
- **Removal**: If a lab/imaging order or medication is removed from the encounter, the corresponding table row is cancelled (only if still in an editable state).
- **Name resolution**: Patient and provider display names are resolved via `PatientsService` and `ProvidersService`, falling back to the ID if the record isn't found.

## Immunizations Module
The `ImmunizationsModule` provides patient immunization tracking with full vaccine administration details:
- **Entity**: `PatientImmunization` (`patient_immunizations` table) — tracks vaccine name, CVX code, CPT code, NDC code, manufacturer, lot number, expiration date, administered date, dose number/amount/unit, route, site, status, source, provider, facility, VIS date, VFC eligibility, funding source, reaction notes, and general notes
- **Sources**: `administered` | `historical` | `registry` | `patient_reported` — supports vaccines given in-clinic, historical records from other providers, registry imports, and patient-reported immunizations
- **Status**: `completed` | `entered-in-error` | `not-done`
- **API**: `/api/v1/immunizations` — CRUD + `findByPatient`; staff roles (admin, doctor, nurse, receptionist) can read; admin/doctor/nurse can create/update/delete
- **Patient portal**: `GET /patients/portal/immunizations` — patients view their own immunization history
- **Frontend staff UI**: `Immunizations` tab on `PatientDetailPage` with table view + "Add Immunization" drawer (vaccine name, CVX/CPT codes, date, dose, route, site, lot/manufacturer, source, provider, notes)
- **Frontend portal UI**: `/portal/immunizations` page with printable immunization history table
- **AI care gap integration**: `RiskManagementService` now fetches real immunization data and passes it to the AI care gap detection prompt, so immunization gap recommendations are based on actual vaccination history instead of age-based guessing
- **Migration**: `CreatePatientImmunizations1789000000000`
- **Vaccine CPT codes**: 11 vaccine-related CPT codes are pre-seeded (90471, 90472, 90480, 90686, 90633, 90714, 90715, 90670, 90732, 90716, 90736) for billing when immunizations are administered
- **AI endpoints** (`/api/v1/ai`):
  - `immunization-forecast` — ACIP-based vaccine forecasting: analyzes immunization history and returns due now, overdue (with catch-up recommendations), upcoming, and completed series
  - `immunization-contraindication` — checks vaccine safety against patient conditions, allergies, medications, prior reactions; distinguishes absolute contraindications from precautions; suggests alternative vaccines
  - `vaccine-education` — generates parent-friendly vaccine education material (what it protects against, why important, how given, common/rare side effects, when to call doctor, myths & facts, parent tips) at 6th grade reading level
- **Frontend AI UI**: Immunizations tab has "AI Forecast" button that shows due/overdue/upcoming/completed vaccines, and each due vaccine has an "Education" button that generates patient-friendly vaccine education

### Immunization Phase 3: Advanced Features
- **FHIR Immunization resource**: `GET /fhir/Immunization/:id` returns a FHIR R4 Immunization resource mapped from `PatientImmunization` entity (CVX codes, lot number, manufacturer, dose, route, site, performer, reaction notes). `GET /fhir/Immunization?patient=:id` returns a Bundle of all immunizations for a patient
- **Vaccine inventory**: `VaccineInventory` entity (`vaccine_inventory` table) tracks vaccine lots with quantity on hand, quantity administered, expiration dates, funding source (VFC/private/state/section317), storage location and temperature, status (available/depleted/expired/recalled/quarantined)
  - API: `GET /immunizations/inventory`, `POST /immunizations/inventory`, `PATCH /immunizations/inventory/:id`, `POST /immunizations/inventory/:id/adjust` (adjust quantity), `DELETE /immunizations/inventory/:id`
  - Alerts: `GET /immunizations/inventory/expiring?days=60` and `GET /immunizations/inventory/low-stock?threshold=10`
  - Migration: `CreateVaccineInventory1789200000000`
- **Travel vaccine AI**: `POST /ai/travel-vaccines` — CDC Yellow Book-based recommendations for travel-specific vaccines (yellow fever, typhoid, Hep A/B, Japanese encephalitis, rabies, meningococcal, cholera, polio), antimalarial prophylaxis, destination-specific risks, time-sensitive actions, and general precautions. Frontend has a "Travel Vaccines" button with a modal for destinations, dates, and pregnancy status

## Growth Management Module
The `GrowthModule` provides pediatric growth chart functionality with CDC/WHO percentile calculations:
- **Percentile engine**: `GrowthPercentileService` uses the LMS (Lambda-Mu-Sigma) method to calculate z-scores and percentiles from CDC and WHO reference data
  - WHO charts (0-24 months): weight-for-age, length-for-age, head circumference-for-age
  - WHO charts (24-60 months): weight-for-age, height-for-age, head circumference-for-age
  - CDC charts (24-240 months / 2-20 years): weight-for-age, height-for-age, BMI-for-age
  - Auto-switches from WHO to CDC at age 2 (standard clinical practice)
  - Linear interpolation between LMS data points for intermediate ages
  - Standard normal CDF for z-score → percentile conversion
- **Preemie adjusted age**: For infants born < 37 weeks gestation, chronological age is adjusted by subtracting the weeks of prematurity (only for first 24 months, per standard practice)
- **Mid-parental height**: Calculates target adult height from parental heights (boys: mid-parent + 6.5cm; girls: mid-parent - 6.5cm; ±8.5cm range = ~90% prediction interval)
- **Growth chart service**: `GrowthChartService` aggregates all encounter vitals (weight, height, head circumference, BMI) into a time series with percentile calculations for each measurement
- **API**: `GET /api/v1/growth/chart/:patientId` — returns complete growth chart data (patient info, measurement data points with percentiles, percentile curve data for charting, mid-parental height)
- **Patient portal**: `GET /patients/portal/growth-chart` — patients/parents view their growth charts
- **Pediatric patient fields**: `birthWeightGrams`, `gestationalAgeWeeks`, `fatherHeightCm`, `motherHeightCm` added to Patient entity
- **Frontend staff UI**: `Growth Charts` tab on `PatientDetailPage` with interactive charts (recharts) showing:
  - Weight-for-Age (WHO/CDC percentile curves + patient data points)
  - Height/Length-for-Age (with mid-parental height target lines)
  - Head Circumference-for-Age (0-5 years)
  - BMI-for-Age (2-20 years)
  - Preemie badge when gestational age < 37 weeks
  - Percentile curves: 3rd, 5th, 10th, 25th, 50th, 75th, 90th, 95th, 97th
- **Frontend portal UI**: `/portal/growth-chart` page for parents to view their child's growth charts
- **Quality measures**: 3 pediatric growth measures added to the quality measure registry:
  - `GROWTH-WELLCHILD-0-2`: Well-child growth monitoring (0-2 years)
  - `GROWTH-BMI-2-19`: Childhood BMI screening (2-19 years)
  - `GROWTH-HEADCIRC-0-3`: Head circumference monitoring (0-3 years)
- **Migration**: `AddPediatricPatientFields1789100000000` (adds 4 nullable columns to patients table)
- **LMS data**: `backend/src/modules/growth/data/who-lms.data.ts` and `cdc-lms.data.ts` contain the published WHO and CDC LMS reference values
- **AI endpoints** (`/api/v1/ai`):
  - `growth-assessment` — AI growth analysis: detects failure to thrive, stunting, wasting, overweight/obesity, microcephaly/macrocephaly, crossing percentiles; calculates growth velocity; generates prioritized recommendations and follow-up plan with referral suggestions
  - `growth-counseling` — generates parent-friendly growth explanation at 6th grade reading level: explains what percentiles mean, weight/height/head circumference/BMI status, nutrition tips, activity tips, when to recheck, when to call doctor
- **Frontend AI UI**: Growth Charts tab has "AI Assessment" button (shows clinical concerns, growth velocity, recommendations, follow-up plan) and "AI Counseling" button (shows parent-friendly explanation with nutrition/activity tips)

### Growth Phase 3: Advanced Features
- **Specialty growth charts**: Down syndrome (height + weight, 0-36 months), achondroplasia (height, 0-36 months), Turner syndrome (height, 0-20 years) LMS reference data in `specialty-lms.data.ts`. The `GrowthPercentileService` accepts an optional `specialty` parameter that overrides standard WHO/CDC charts. Frontend has a specialty chart selector dropdown that reloads the chart with the selected specialty's percentiles
  - API: `GET /growth/chart/:patientId?specialty=down-syndrome|achondroplasia|turner-syndrome`
  - `GET /growth/specialty-charts` lists available specialty charts
- **Growth velocity**: `GrowthChartService` calculates weight, height, and head circumference velocity (value per year) between the first and last measurements, with assessment (normal/slow/rapid). Displayed in a "Growth Velocity" card on the Growth Charts tab
- **Bone age**: Encounter vitals JSONB now includes `boneAgeYears` and `boneAgeMethod` fields for recording bone age from radiographic studies (e.g. Greulich-Pyle, Tanner-Whitehouse). No migration needed (JSONB field)
- **FHIR Observation resources**: `GET /fhir/Observation/growth?patient=:id` returns a FHIR R4 Bundle of Observation resources for all growth measurements (weight LOINC 29463-7, height LOINC 8302-2, head circumference LOINC 9843-4, BMI LOINC 39156-5) with vital signs profile, extracted from encounter vitals

## Specialty Support
Neuraline is a **multi-specialty, specialty-agnostic EMR**. The `specialty` column on clinical templates and the `department`/`specialization` columns on providers are free-text `varchar`, so any specialty can be added at runtime without a schema change.

### Shared Specialty Taxonomy
- **Backend**: `backend/src/modules/clinical/specialties.ts` — exports `CLINICAL_SPECIALTIES`, `CLINICAL_DEPARTMENTS`, `CUSTOM_SPECIALTY_SENTINEL`
- **Frontend**: `frontend/src/constants/specialties.ts` — mirrors the backend list and exports `SPECIALTY_OPTIONS` (includes the `Custom` sentinel) for selectors
- Keep both files in sync. Supported specialties: General Medicine, Primary Care, Family Medicine, Internal Medicine, Pediatrics, Cardiology, Pulmonology, Neurology, Endocrinology, Behavioral Health, Urgent Care, Telehealth

### Seeded Clinical Templates
`backend/src/modules/clinical/clinical-template-seed.ts` seeds default templates on first boot for the seed tenant (`00000000-0000-0000-0000-000000000000`). Seeding is skipped if any templates already exist for that tenant.
- **Primary Care / General Medicine**: Annual Physical, Follow-Up Visit, Diabetic Management
- **Urgent Care**: Urgent Care (acute care workup)
- **Behavioral Health**: Mental Health Assessment (CPT 90791, ICD-10 F32.9)
- **Telehealth**: Telehealth Visit
- **Cardiology**: Hypertension Follow-Up, Atrial Fibrillation Follow-Up, CHF Management, Chest Pain Evaluation, Post-MI Follow-Up (each with SOAP, vitals, diagnoses, meds, orders/labs/imaging, treatment plan, and CPT/ICD-10 billing codes)

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
- **Production Stripe guard**: The backend refuses to boot if `NODE_ENV=production` and `STRIPE_API_KEY` is empty (see `main.ts`). This prevents accidental mock-mode billing in production, where `MockSubscriptionProvider` would accept fake payment methods. CI also checks that `.env.example` files don't ship a live `sk_live_` key.
- **India recurring billing (RBI e-mandate)**: `StripeSubscriptionProvider` now passes `payment_method_options[card][mandate_options]` to the SetupIntent, derived from the subscription's `priceCents`, `currency`, and `billingCycle`. Stripe only activates the mandate for Indian cards (`card.country === 'IN'`), so passing these options is safe for US/EU cards — they use the normal SCA flow. RBI requirements:
  - An explicit **e-mandate** created at first authentication with `amount`, `currency`, `start_date`, `interval`, `interval_count`, and `supported_countries: ['IN']`.
  - **3DS / OTP** on mandate setup and on the first charge (handled by Stripe Elements `confirmSetup` inline).
  - Recurring debits must stay within the mandate amount (₹15,000 per-mandate cap for some categories).
  - **Re-authentication** may be required for amount increases or plan upgrades.
  - One-time payments (e.g., patient portal `/invoices/:id/pay`) only need 3DS, not a mandate.
  - The frontend `UpdatePaymentMethodModal` handles `requires_action` (3DS redirect) and shows helpful error messages for `authentication_required` and `card_declined` errors.

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
- `GET /imaging` — Patient's imaging orders with findings/impression
- `GET /invoices` — Patient's invoices
- `POST /invoices/:id/pay` — Make a payment on an invoice
- `GET /eobs` — Patient's EOBs from remittance module
- `GET /insurance` — Patient's insurance policies
- `GET /medical-history` — Patient's problem list (conditions)
- `POST /medical-history` — Patient self-reports a condition (marked unconfirmed)
- `DELETE /medical-history/:id` — Patient removes a self-reported condition
- `GET /allergies` — Patient's allergies
- `POST /allergies` — Patient self-reports an allergy (marked unconfirmed, source=patient)
- `DELETE /allergies/:id` — Patient removes a self-reported allergy
- `GET /family-history` — Patient's family history entries
- `POST /family-history` — Patient self-reports a family history entry (source=patient)
- `DELETE /family-history/:id` — Patient removes a self-reported family history entry
- `GET /surgical-history` — Patient's surgical history entries
- `POST /surgical-history` — Patient self-reports a surgical history entry (source=patient)
- `DELETE /surgical-history/:id` — Patient removes a self-reported surgical history entry
- `GET /social-history` — Patient's social history entries (smoking, alcohol, substance use, occupation, exercise, diet, etc.)
- `POST /social-history` — Patient self-reports a social history entry (source=patient)
- `DELETE /social-history/:id` — Patient removes a self-reported social history entry

### Patient Portal AI (all under `/api/v1/patients/portal/ai`, requires patient JWT)
- `POST /explain-lab-result` — AI explains a lab result in plain language
- `POST /assess-symptoms` — AI symptom checker with care navigation (self-care / schedule / urgent care / emergency)
- `POST /check-interactions` — AI medication interaction checker
- `POST /health-education` — AI generates personalized health education articles
- `POST /visit-questions` — AI generates questions to ask your doctor
- `POST /extract-history` — AI extracts structured medical/family history from free-text patient input
- `POST /family-history-risk` — AI assesses hereditary risk from family history (NCCN/ACMG criteria)
- `POST /health-summary` — AI generates a plain-language health summary organized by body system
- `POST /suggest-screenings` — AI suggests health screenings based on history, age, and gender (USPSTF guidelines)

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
  - `/portal/imaging` — View imaging orders with findings, impression, and report links
  - `/portal/billing` — View invoices + make payments
  - `/portal/eobs` — View insurance EOBs with adjustment details
  - `/portal/insurance` — View insurance policies
  - `/portal/messages` — Secure messaging with care team
  - `/portal/ai-assistant` — AI Health Assistant (5 tabs: lab explainer, symptom checker, drug interactions, health education, visit prep)
  - `/portal/health-history` — Patient health history with conditions, allergies, family history, surgical history, social history tabs + AI features (history intake, hereditary risk, health summary, screening recommendations)
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

## Reports Module
The reports module (`backend/src/modules/reports/`) provides real-time analytics, AI-powered insights, predictive risk scoring, and multi-format export. All endpoints are JWT-guarded with role-based access.

### Services
- **ReportsService**: Core report queries using raw SQL against encounter_claims, appointments, encounters, prescriptions, lab_orders, patient_problems, providers, denial_records, claim_adjustments, and payments tables. All queries are tenant-scoped.
- **ReportAiService**: AI-powered features including narrative insights, natural-language report builder, no-show risk prediction, denial risk prediction, revenue leakage detection, and anomaly detection.
- **ReportExportService**: Multi-format export (CSV, Excel-compatible CSV, printable HTML/PDF, JSON) with report flattening.

### API Endpoints (all under `/api/v1/reports`)
**Core Reports:**
- `GET /revenue` — Revenue report: KPIs (total revenue, collections rate, avg per visit, outstanding balance), revenue by month, revenue by payer, payment method breakdown, claim status breakdown
- `GET /appointments` — Appointments report: KPIs (total, completion rate, no-show rate, telehealth), appointments by day of week, type distribution, no-show trend, utilization by provider
- `GET /clinical` — Clinical report: KPIs (encounters, avg duration, prescriptions, labs, unique diagnoses), top diagnoses (ICD-10), encounters by type, prescription trends, lab orders by status
- `GET /providers` — Provider performance: comparison table (patients seen, encounters, revenue, utilization), productivity chart
- `GET /rcm` — RCM & Denials report: KPIs (total billed, denial rate, avg days in A/R, over 90 days), A/R aging buckets, denials by reason/payer, claims by status, top denial codes (CARC)
- `GET /patient-flags` — Patient flag distribution: by severity, category, type, resolution stats
- `GET /dashboard` — Executive dashboard: all report categories in one call

**Export:**
- `GET /export/:reportType?format=csv|excel|pdf|json` — Export any report as downloadable file

**AI-Powered Reports:**
- `POST /ai/insights` — AI narrative insights for a report tab (summary, bullets with severity, recommended actions). Falls back to rule-based insights if AI unavailable.
- `POST /ai/ask` — Natural-language report builder: ask a question in plain English, AI interprets it, fetches relevant data, and generates commentary
- `GET /ai/no-show-risk?days=7` — Predict no-show risk for upcoming appointments (rule-based scoring using patient history, lead time, day/time, telehealth)
- `GET /ai/denial-risk` — Predict denial risk for unsubmitted claims (payer denial history, claim value, aging, draft status)
- `GET /ai/revenue-leakage` — Revenue leakage report: coverage gaps, secondary claim opportunities, underpayments, denials at risk, old A/R. AI-generated executive summary and prioritized actions.
- `GET /ai/anomalies` — Anomaly detection: compares last 7 days vs 30-day baseline for denial count and no-show rate

### Query Parameters
All core report endpoints accept:
- `dateRange`: last7, last30, last90, thisMonth, thisQuarter, thisYear, lastYear, custom
- `startDate`, `endDate`: ISO strings (when dateRange=custom)
- `providerId`, `payerId`, `department`: optional filters

### Frontend
- **ReportsPage** (`frontend/src/pages/reports/ReportsPage.tsx`): Full analytics dashboard with:
  - 6 tabs: Revenue, Appointments, Clinical, Provider Performance, RCM & Denials, AI Analytics
  - Date range selector (7 presets + custom range picker)
  - KPI cards with color-coded metrics
  - Interactive charts (line, bar, pie, area) using Recharts
  - AI Insights panel with severity-coded bullets and recommended actions
  - Anomaly alerts banner
  - Export dropdown (CSV, Excel, PDF)
  - AI Analytics tab: natural-language report builder, revenue leakage analyzer, no-show risk table, denial risk table
- **reportsService.ts** (`frontend/src/services/reportsService.ts`): Frontend service with typed interfaces for all report endpoints
