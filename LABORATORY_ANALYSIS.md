# Laboratory Module — Analysis Report

## 1. Current State

| Layer | Status | Details |
|-------|--------|---------|
| **Frontend UI** | ✅ Built | `/laboratory` — 3 tabs (Lab Orders, Results, Imaging), New Lab Order drawer, stats cards |
| **Frontend Data** | ❌ Mock only | `useLabStore` with `mockLabOrders`, `mockImagingOrders`, `labPanels` — no API calls |
| **Backend Module** | ❌ Empty stub | Only `laboratory.module.ts` exists — no controller, service, entity, or DTO |
| **FHIR Integration** | ⚠️ Partial | `DiagnosticReport` endpoint exists but returns hardcoded mock data |
| **Integrations Config** | ⚠️ Partial | `lab_systems` integration defined (Quest/LabCorp) but no implementation |

---

## 2. Backend Wiring Required

### 2.1 Data Models (Entities)

```
LabOrder
├── id: uuid (PK)
├── tenantId: uuid
├── patientId: uuid
├── providerId: uuid
├── orderNumber: string (unique, auto-generated)
├── status: enum (ordered | in_progress | completed | cancelled)
├── priority: enum (routine | urgent | stat)
├── panelId: uuid (nullable, FK to LabPanel)
├── fastingRequired: boolean
├── clinicalNotes: text
├── orderedDate: timestamptz
├── completedDate: timestamptz (nullable)
├── labVendorId: string (nullable — Quest/LabCorp reference)
├── createdAt, updatedAt, deletedAt (audit)
└── tests: LabTest[] (1:N)

LabTest (line items)
├── id: uuid (PK)
├── labOrderId: uuid (FK)
├── name: string
├── loincCode: string
├── category: string
├── result: string (nullable)
├── referenceRange: string (nullable)
├── unit: string (nullable)
├── status: enum (pending | completed | abnormal)
├── abnormalFlag: enum (high | low | critical) (nullable)
├── resultedAt: timestamptz (nullable)
└── resultedBy: uuid (nullable)

LabPanel (catalog)
├── id: uuid (PK)
├── name: string
├── loincCode: string
├── description: text
├── tests: string[] (list of LOINC codes)
└── tenantId: uuid

ImagingOrder
├── id: uuid (PK)
├── tenantId: uuid
├── patientId: uuid
├── providerId: uuid
├── type: string (X-Ray | MRI | CT | Ultrasound | etc.)
├── bodyPart: string
├── status: enum (ordered | scheduled | completed | cancelled)
├── priority: enum (routine | urgent | stat)
├── findings: text (nullable)
├── orderedDate: timestamptz
├── completedDate: timestamptz (nullable)
└── createdAt, updatedAt, deletedAt
```

### 2.2 API Endpoints

```
Lab Orders:
  GET    /api/v1/laboratory/orders              — List (paginated, filterable by status/patient/date)
  GET    /api/v1/laboratory/orders/:id           — Get single order with tests
  POST   /api/v1/laboratory/orders               — Create new lab order
  PATCH  /api/v1/laboratory/orders/:id           — Update order (add results, change status)
  DELETE /api/v1/laboratory/orders/:id           — Cancel/soft-delete order
  GET    /api/v1/laboratory/orders/:id/print     — Generate printable requisition PDF

Results:
  GET    /api/v1/laboratory/results              — List completed results (filterable)
  GET    /api/v1/laboratory/results/:id          — Get full result details
  GET    /api/v1/laboratory/results/abnormal     — Get abnormal results only (alerting)

Imaging:
  GET    /api/v1/laboratory/imaging              — List imaging orders
  GET    /api/v1/laboratory/imaging/:id          — Get single imaging order
  POST   /api/v1/laboratory/imaging              — Create imaging order
  PATCH  /api/v1/laboratory/imaging/:id          — Update imaging order
  DELETE /api/v1/laboratory/imaging/:id          — Cancel imaging order

Panels (Catalog):
  GET    /api/v1/laboratory/panels               — List available lab panels/tests
  GET    /api/v1/laboratory/panels/:id           — Get panel details

Stats/Dashboard:
  GET    /api/v1/laboratory/stats                — Pending count, completed today, abnormal count

FHIR:
  GET    /api/v1/fhir/DiagnosticReport/:id       — FHIR-compliant result (existing stub)
  GET    /api/v1/fhir/Observation/:id            — FHIR-compliant individual test result
```

### 2.3 Frontend Wiring Needed

| Frontend File | Change Required |
|---------------|----------------|
| `services/labService.ts` | **New file** — API client for all lab endpoints |
| `store/dataStore.ts` | Replace `useLabStore` mock data with API-backed async actions |
| `pages/laboratory/LaboratoryPage.tsx` | Swap mock data for API calls, handle loading/error states |
| `types/index.ts` | Add `LabPanel`, `ImagingOrder` types (move from mockData.ts) |
| `pages/clinical/NewEncounterPage.tsx` | Wire embedded lab order entry to lab service |
| `pages/clinical/EncounterDetailPage.tsx` | Wire embedded lab order display to lab service |
| `pages/portal/PatientPortalPage.tsx` | Wire patient-facing lab results to API |
| `pages/dashboard/DashboardPage.tsx` | Wire "Pending Lab Results" stat to `/laboratory/stats` |

---

## 3. Third-Party Integration Opportunities

### 3.1 Quest Diagnostics

| Aspect | Details |
|--------|---------|
| **API** | Quest Care360™ API / Quest Direct™ — REST + HL7 v2 |
| **Capabilities** | Order lab tests, receive results via HL7 or FHIR, patient service center lookup |
| **Auth** | OAuth 2.0 (client credentials) |
| **Setup** | Requires business agreement, API key, NPI number |
| **Endpoints** | `POST /orders`, `GET /results`, `GET /patients/{id}/results` |
| **Format** | HL7 v2 ORU (results) + ORM (orders), JSON available for some APIs |

### 3.2 LabCorp

| Aspect | Details |
|--------|---------|
| **API** | LabCorp Beacon™ API / LabCorp Link™ |
| **Capabilities** | Order entry via HL7 ORM, result retrieval via HL7 ORU, patient portal integration |
| **Auth** | API key-based + certificate |
| **Setup** | Requires business agreement, CLIA number, tax ID |
| **Format** | HL7 v2.5.1 (primary), FHIR R4 (emerging) |

### 3.3 Other Lab Integration Options

| Vendor | Method | Complexity | Notes |
|--------|--------|:----------:|-------|
| **HL7 v2 Interface** | TCP/MLLP | High | Required by most hospital LIS; needs MLLP server |
| **FHIR R4 (STU3)** | REST/JSON | Medium | Direct, LabCorp, and hospital systems supporting SMART on FHIR |
| **APLab / Sonic** | Custom API | Medium | Large lab chains in APAC |
| **Local LIS** | HL7/SFTP/CSV | Varies | Most common — file-based result delivery via SFTP |
| **RCPA (AU)** | Custom | High | Australian lab standard |

### 3.4 Recommended Approach

```
Phase 1: HL7 v2.5.1 via MLLP (most universal)
  → Use: https://github.com/ianwward/hl7v2 or hl7apy
  → Listen on MLLP port for unsolicited results (ORU^R01)
  → Send orders (ORM^O01) to lab

Phase 2: FHIR R4 (modern, scalable)
  → Use: existing FHIR module (fhir.service.ts)
  → Extend DiagnosticReport and Observation endpoints
  → SMART on FHIR app launch for lab portals

Phase 3: Direct vendor APIs (Quest/LabCorp-specific)
  → OAuth 2.0 integration
  → Vendor-specific order catalogs and result formats
```

### 3.5 NPM Packages Required

```
hl7v2 OR hl7apy         — HL7 v2 message parsing/generation
mllp-node               — MLLP TCP transport for HL7
node-fetch OR axios     — REST API calls (already present)
@asymmetrik/fhir-qb     — FHIR query builder (optional)
pdfkit OR pdf-lib       — PDF generation for requisitions (pdf-lib already installed)
```

---

## 4. AI Features — Market Gap Analysis

### 4.1 Existing Market Solutions (What's Available)

| Feature | Vendors | Gap |
|---------|---------|-----|
| Lab result parsing | Most EHRs | Basic — just display, no intelligence |
| Reference range flagging | All LIS | Standard — just color codes high/low |
| PDF-to-FHIR conversion | Health Gorilla, Redox | Available but expensive |
| Basic trending | Epic, Cerner | Limited to single-patient line charts |
| HL7 routing | Interface engines | No clinical intelligence |

### 4.2 High-Value AI Features (Underserved in Market)

#### Tier 1 — High Impact, Low Complexity

| Feature | Description | Implementation |
|---------|-------------|----------------|
| **AI Result Summarization** | Generate plain-English summary of lab results for patients | Pass structured lab data to Ollama/Mistral with prompt: *"Explain these lab results in simple terms, flagging abnormal values and suggesting follow-up questions for the doctor"* |
| **Smart Abnormal Triage** | Score abnormal results by clinical urgency (not just high/low) | ML model trained on: result magnitude × patient history × comorbidity × trend rate. Rank: Critical → Urgent → Abnormal → Normal |
| **Auto-Reflex Logic Engine** | Suggest follow-up tests based on results (e.g., high TSH → suggest Free T4) | Rule engine + ML: map LOINC codes to reflex pathways from existing clinical guidelines |

#### Tier 2 — Medium Complexity, Unique in Market

| Feature | Description | Implementation |
|---------|-------------|----------------|
| **Temporal Trend Prediction** | Predict future lab values based on historical pattern + current trajectory | Time-series model (Prophet/LSTM): input last 12 results → predict next value + confidence interval. Alert if predicted value will breach threshold |
| **Multi-Patient Pattern Detection** | Detect emerging population health trends (e.g., rising HbA1c in a clinic) | Aggregate anonymized results → anomaly detection on population-level LOINC trends. Alert: *"27% increase in elevated HbA1c this quarter compared to baseline"* |
| **AI-Driven Test Utilization** | Flag redundant/outdated test ordering patterns | Model trained on: patient history × recent results × clinical guidelines. Suggest: *"Patient has 3 recent HbA1c results. Ordering another may not be clinically useful"* |
| **Drug–Lab Interaction Warning** | Predict lab abnormalities based on active medications | Cross-reference RxNorm (medications) with LOINC (lab tests). Alert: *"Metformin may affect Vitamin B12 levels. Consider checking B12 at next visit"* |

#### Tier 3 — High Complexity, Near Zero Competition

| Feature | Description | Implementation |
|---------|-------------|----------------|
| **Diagnostic Hypothesis Generator** | Generate differential diagnosis from lab patterns | RAG pipeline: lab results → embed → search vector DB of medical literature → Ollama generates ranked differentials. *"Pattern: microcytic anemia + low ferritin + high TIBC → Likely: Iron deficiency anemia"* |
| **Generative Lab Report Narratives** | Auto-generate structured clinical notes from lab results (SOAP format) | Ollama prompt: *"Generate a SOAP note subsection for these lab results: [structured data]. Include assessment of abnormal values and recommendations."* |
| **Predictive Deterioration Model** | Predict patient deterioration 24-48h before clinical decompensation | Model: LSTM on vitals × labs × meds × age/comorbidity. Output: deterioration risk score. Re-train on outcome data |
| **Natural Language Lab Query** | "Which patients have uncontrolled diabetes and elevated creatinine?" | NL2SQL: LLM converts natural language → SQL query on lab data. Powered by Ollama + structured DB schema prompt |

### 4.3 Technical Architecture for AI Features

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Lab Data    │────▶│  Feature Store    │────▶│  ML Models    │
│  (LOINC)     │     │  (TimescaleDB)    │     │  (Python ONNX)│
└─────────────┘     └──────────────────┘     └──────────────┘
                           │                          │
                           ▼                          ▼
                    ┌──────────────────┐     ┌──────────────────┐
                    │  Ollama/Mistral   │     │  Alert Engine    │
                    │  (NLP pipeline)   │     │  (Redis Pub/Sub) │
                    └──────────────────┘     └──────────────────┘
                           │                          │
                           ▼                          ▼
                    ┌──────────────────┐     ┌──────────────────┐
                    │  Lab AI Service   │     │  Push/WebSocket  │
                    │  (NestJS module)  │     │  Notifications   │
                    └──────────────────┘     └──────────────────┘
```

### 4.4 Recommended AI Priority Roadmap

| Phase | Features | Timeline | Effort |
|:-----:|----------|:--------:|:------:|
| **P1** | AI Result Summarization, Smart Abnormal Triage, Natural Language Lab Query | 2-3 weeks | Low |
| **P2** | Auto-Reflex Logic, Drug–Lab Interaction, Generative Lab Report Narratives | 4-6 weeks | Medium |
| **P3** | Temporal Trend Prediction, Multi-Patient Pattern Detection | 6-8 weeks | Medium |
| **P4** | Diagnostic Hypothesis Generator, Predictive Deterioration Model | 8-12 weeks | High |

---

## 5. Summary

| Work Stream | Priority | Effort | Impact |
|-------------|:--------:|:------:|:------:|
| **Backend entities + API** | 🔴 Critical | 2 weeks | Unblocks frontend |
| **Frontend API wiring** | 🔴 Critical | 1 week | Replaces mock data |
| **HL7 v2 lab interface** | 🟡 Medium | 3-4 weeks | Enables real lab connectivity |
| **FHIR DiagnosticReport** | 🟡 Medium | 1 week | FHIR compliance |
| **Quest/LabCorp API** | 🟢 Nice-to-have | 2-3 weeks | Vendor-specific |
| **AI Result Summarization** | 🟢 High-value | 1 week | Differentiator |
| **AI Triage + Alerts** | 🟢 High-value | 2 weeks | Patient safety |
| **Advanced AI (P3/P4)** | Future | Ongoing | Market leadership |
