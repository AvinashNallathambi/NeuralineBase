# Patient Portal Gap Analysis & Competitor Comparison

## Date: January 2025
## Status: Current portal is ~70% static/mock data, ~30% functional

---

## 1. CURRENT STATE ASSESSMENT

### 1.1 What Exists Today

The patient portal lives at `frontend/src/pages/portal/PatientPortalPage.tsx` (593 lines) and is routed at `/portal`. It uses the **same MainLayout as the provider/admin app** — there is no dedicated patient-only layout or separate authentication flow.

#### Fully Static / Mock (No Backend Integration)

| Feature | Current State | Data Source |
|---------|--------------|-------------|
| Patient identity | Hardcoded to `mockPatients[0]` (John Smith) | Zustand store with mock data |
| Appointments display | Shows mock appointments filtered by patientId | `useAppointmentStore()` → mock data |
| Messages display | Shows mock messages, unread count | `useMessageStore()` → mock data |
| Prescriptions display | Shows mock prescriptions | `usePrescriptionStore()` → mock data |
| Lab results display | Shows mock lab orders | `useLabStore()` → mock data |
| Encounters display | Shows mock encounters | `useEncounterStore()` → mock data |
| Documents | **4 hardcoded items** (lab report, visit summary, prescription, EOB) | Static array in component |
| Health education articles | **5 hardcoded articles** | Static array in component |
| Patient profile | Shows mock patient demographics, read-only | `usePatientStore()` → mock data |

#### Placeholder UI (Form exists, no backend submission)

| Feature | Current State |
|---------|--------------|
| Request Appointment modal | Form fields: reason, provider, date, visit type, notes → shows `message.success()` on submit, no API call |
| Prescription Refill modal | Form fields: medication, pharmacy, notes → shows `message.success()` on submit, no API call |
| Quick Actions buttons | "Request Appointment", "Request Refill", "Send Message", "Download Health Summary" → no backend wiring |
| Profile Edit button | Visible but non-functional |

#### Completely Missing (No UI, No Backend)

| Feature |
|---------|
| Secure messaging (send/reply to provider) |
| Online bill pay / payment processing |
| Insurance EOB / ERA viewing |
| Document upload / download (real file storage) |
| Health summary export (PDF/CCD) |
| Telemedicine video visits from portal |
| Patient intake / registration forms |
| Appointment self-scheduling (real-time slot selection) |
| Medication adherence tracking |
| Wearable / device integration |
| AI symptom checker / care navigation |
| Notifications (email/SMS/push) |
| Patient education content management |
| Consent management (entity exists, no service) |
| Proxy / caregiver access |
| Account settings / preferences |
| Two-factor authentication |
| Mobile-responsive dedicated design |

### 1.2 Backend Modules Available But Not Connected

The backend has **fully implemented** modules that the portal doesn't use:

| Backend Module | API Available | Portal Uses It? |
|----------------|--------------|-----------------|
| Patients (`/api/v1/patients`) | Full CRUD, problem list, insurance | ❌ No |
| Appointments (`/api/v1/appointments`) | Full CRUD, availability slots | ❌ No |
| Prescriptions (`/api/v1/prescriptions`) | Full CRUD, refill requests | ❌ No |
| Laboratory (`/api/v1/laboratory`) | Orders, results, patient history | ❌ No |
| Billing (`/api/v1/billing`) | Invoices, payments, insurance | ❌ No |
| Eligibility (`/api/v1/eligibility`) | Coverage verification | ❌ No |
| AI (`/api/v1/ai`) | SOAP, coding, lab summarization | ❌ No |
| Remittance (`/api/v1/remittance`) | ERA/EOB data (newly built) | ❌ No |
| Notifications | **STUB** — empty module | N/A |
| Telemedicine | **STUB** — empty module | N/A |
| Messaging | **Does not exist** | N/A |

---

## 2. COMPETITOR ANALYSIS

### 2.1 Epic MyChart (KLAS #1 Patient Portal, Score 90.2)

**What they have that we don't:**
- **Self-scheduling** with real-time provider availability, slot selection, waitlist enrollment
- **Telehealth video visits** built directly into the app (no external browser launch)
- **Proxy access** — parents manage children's records, caregivers manage elderly patients
- **Health record sharing** between different Epic health systems (interoperability)
- **Mobile app** (iOS/Android) with push notifications
- **Bill pay** with online payment processing
- **Care Everywhere** — cross-organization record exchange
- **Lily AI** (2025) — AI-powered appointment booking via free-text "reason for visit"
- **After-visit summaries** with care plan instructions
- **Pre-visit check-in** — digital forms, insurance verification, copay collection

### 2.2 athenahealth athenaCommunicator (KLAS Top 5)

**What they have that we don't:**
- **Digital intake forms** — patients complete registration, medical history, consent forms online
- **Automated appointment reminders** via SMS, email, and push (reduces no-shows by 38%)
- **Online bill pay** with electronic statements (increases patient pay yield by 25-35%)
- **athenaTelehealth** — group sessions, participant management, waiting room experience, in-app video
- **athenaPatient mobile app** — native iOS/Android with smooth telehealth integration
- **AI document summaries** — GenAI summaries of external clinical documents
- **Text-messaging reminders** and two-way patient communication

### 2.3 Kaiser Permanente — KPIN (AI Navigator, 2024-2025)

**What they have that we don't:**
- **AI-powered care navigation** — patients type their needs in free-text, AI routes to appropriate care
- **Clinical alert system** — detects urgent symptoms (chest tightness, weakness) with 97.7% accuracy and immediately connects to clinician
- **Personalized care pathways** — uses patient age, gender, and history to recommend appropriate care options
- **97.7% accuracy** in detecting urgent medical cases
- **88.9% accuracy** in recommending appropriate care pathways
- **9% increase** in patient satisfaction scores

### 2.4 Cedars-Sinai Connect (AI Virtual Care, 2023-2025)

**What they have that we don't:**
- **24/7 AI chatbot** for symptom assessment and triage
- **AI compares symptoms** to patient's EHR and similar patients in the system
- **Photo submission** — patients can upload photos of rashes, sore throat, etc.
- **AI summarizes patient information** for physician review (reduces intake time)
- **AI treatment recommendations** with physician sign-off
- **Seamless escalation** from AI chat → virtual visit → in-person appointment

### 2.5 Hartford HealthCare — PatientGPT (2025)

**What they have that we don't:**
- **PatientGPT** — AI tool that securely accesses user's medical record
- **Personalized education** grounded in each user's personal health data
- **24/7 availability** for basic health questions
- **Seamless pathway to care** — AI can connect to telehealth or schedule in-person
- **Clinical guardrails** — AI operates within defined clinical safety boundaries
- **Medication interaction checks** using patient's medication list
- **Care plan questions** — AI generates questions for patient to ask their doctor

### 2.6 Oscar Health — Oswell AI Agent (2025)

**What they have that we don't:**
- **AI health agent** that taps into medical records, care guides, and plan benefits
- **Symptom management** recommendations
- **Medication refill** automation via AI
- **Drug interaction** checking
- **Test result explanation** in plain language
- **Plan benefit explanation** — what's covered, how much things cost
- **Nutrition and fitness recommendations** personalized to the patient
- **Question list generation** for doctor visits

### 2.7 Sutter Health — Sutter Sync (2025)

**What they have that we don't:**
- **EHR-linked remote monitoring devices** — BP cuff, scale, glucometer that transmit directly to Epic
- **Automatic data flow** — devices transmit even when app is closed
- **Chronic disease management** — dedicated pharmacist teams + behavioral scientists
- **Real-time provider visibility** into between-visit measurements
- **No app download required** for device data — seamless integration

### 2.8 InteliChart (KLAS #2 Patient Portal, Score 86.7)

**What they have that we don't:**
- **Multi-EHR aggregation** — works across different EHR systems
- **Pre-visit digital check-in** workflow
- **Patient-reported outcomes** collection
- **Automated outreach** campaigns

### 2.9 Oracle Health Patient Portal (2025 Release)

**What they have that we don't:**
- **Quick Pay** bill payment from dashboard
- **Message workflows** — receive, view, reply, compose
- **My Health dashboard** — test results, health history, vital signs, immunizations, conditions
- **Registration and arrival** workflows
- **Scheduling workflows** integrated with arrival

---

## 3. GAP ANALYSIS — FEATURE BY FEATURE

### 3.1 Critical Gaps (Must-Have for Competitiveness)

| # | Feature | Competitors | Our Status | Impact |
|---|---------|------------|------------|--------|
| 1 | **Real API integration** (replace all mock data) | All | ❌ 100% mock | Portal is non-functional |
| 2 | **Secure messaging** (send/reply to care team) | Epic, athena, Oracle | ❌ No backend | Core patient need |
| 3 | **Online bill pay** | Epic, athena, Oracle | ❌ Not built | Revenue collection |
| 4 | **Appointment self-scheduling** (real-time slots) | Epic, athena, Oracle | ⚠️ Form only | Access to care |
| 5 | **Prescription refill requests** (connected to backend) | All | ⚠️ Form only | Patient convenience |
| 6 | **Lab results with reference ranges + trending** | Epic, Oracle, athena | ⚠️ Mock display | Patient engagement |
| 7 | **Document storage & download** | All | ❌ Hardcoded | Record access (Cures Act) |
| 8 | **Notifications** (SMS/email/push reminders) | athena, Epic | ❌ Empty stub | No-show reduction |
| 9 | **Patient authentication** (separate from provider) | All | ❌ Shared login | Security/compliance |
| 10 | **Mobile-responsive design** | All | ⚠️ Partial | Patient access |

### 3.2 High-Value Gaps (Differentiators)

| # | Feature | Competitors | Our Status | Impact |
|---|---------|------------|------------|--------|
| 11 | **AI symptom checker / care navigation** | Kaiser, Cedars-Sinai, Hartford | ❌ Not built | AI differentiation |
| 12 | **AI lab result explanation** (plain language) | Oscar, Hartford | ❌ Not built | Patient understanding |
| 13 | **AI medication interaction checking** | Oscar, Hartford | ❌ Not built | Patient safety |
| 14 | **Telehealth video visits from portal** | Epic, athena | ⚠️ UI stub | Care access |
| 15 | **EOB/ERA viewing** (insurance explanations) | Epic, Oracle | ❌ Backend exists | Financial transparency |
| 16 | **Pre-visit digital check-in** | Epic, athena, InteliChart | ❌ Not built | Efficiency |
| 17 | **Patient intake forms** (digital) | athena, InteliChart | ❌ Not built | Onboarding |
| 18 | **Health summary export** (PDF/CCD/FHIR) | Epic, Oracle, iEHR | ❌ Not built | Interoperability (Cures Act) |
| 19 | **After-visit summaries with care plans** | Epic, athena | ❌ Not built | Care continuity |
| 20 | **Patient education content** (real, condition-specific) | All | ⚠️ 5 hardcoded articles | Engagement |

### 3.3 Emerging/Future Gaps (Innovation Opportunities)

| # | Feature | Competitors | Our Status | Impact |
|---|---------|------------|------------|--------|
| 21 | **AI care navigator** (free-text "reason for visit") | Kaiser (KPIN) | ❌ Not built | 9% satisfaction boost |
| 22 | **AI personalized health recommendations** | Oscar (Oswell) | ❌ Not built | Wellness engagement |
| 23 | **Wearable/device integration** (Apple Health, Fitbit) | Sutter, iEHR, ML Health | ❌ Not built | Chronic disease mgmt |
| 24 | **Remote patient monitoring** (BP, glucose, weight) | Sutter Sync | ❌ Not built | Chronic care |
| 25 | **Medication adherence tracking** | ML Health, PATTERN | ❌ Not built | Adherence improvement |
| 26 | **Proxy/caregiver access** | Epic, Oracle | ❌ Not built | Family care |
| 27 | **AI question generator for doctor visits** | Oscar, Hartford | ❌ Not built | Visit quality |
| 28 | **Group telehealth sessions** | athena (Fall 2025) | ❌ Not built | Therapy, education |
| 29 | **Patient-reported outcomes (PROs)** | InteliChart | ❌ Not built | Quality metrics |
| 30 | **Consent management** (digital signatures) | All | ⚠️ Entity exists, no service | Compliance |

---

## 4. WHAT WE CAN PROVIDE — IMPLEMENTATION ROADMAP

### Phase 1: Foundation — Make the Portal Real (Weeks 1-3)

**Goal:** Replace all mock data with real API calls, create patient authentication, and wire up existing backend modules.

| Task | Backend | Frontend | Effort |
|------|---------|----------|--------|
| Patient authentication (separate JWT, patient role) | New `PatientAuthGuard`, patient login endpoint | Patient login page | Medium |
| Connect appointments to real API | Use existing `/appointments` + `/appointments/availability/:providerId/slots` | Replace mock store with `appointmentService` calls | Low |
| Connect prescriptions to real API | Use existing `/prescriptions` + refill endpoints | Replace mock store with `prescriptionService` calls | Low |
| Connect lab results to real API | Use existing `/laboratory/patient/:patientId/history` | Replace mock store with `labService` calls | Low |
| Connect patient profile to real API | Use existing `/patients/:id` | Replace mock store with `patientService` calls | Low |
| Connect billing/invoices to real API | Use existing `/billing/invoices?patientId=` | New billing section in portal | Low |
| Dedicated patient portal layout | N/A | New `PatientPortalLayout` (no admin sidebar) | Medium |

### Phase 2: Core Patient Features (Weeks 3-6)

**Goal:** Implement the features patients use most: messaging, bill pay, self-scheduling, and document access.

| Task | Backend | Frontend | Effort |
|------|---------|----------|--------|
| **Secure messaging module** | New `MessagingModule` (Message entity, Conversation entity, threaded messaging, file attachments) | Message inbox, compose, reply, threaded view | High |
| **Online bill pay** | Stripe/payment gateway integration, `PaymentService`, invoice payment endpoint | Bill list, payment modal, payment history, receipt download | High |
| **Appointment self-scheduling** | New endpoint: `POST /appointments/self-schedule` (patient-facing, uses provider availability) | Real-time slot picker, provider filter, appointment confirmation | Medium |
| **Prescription refill requests** | Use existing `/prescriptions/:id/refill` endpoint | Wire refill modal to backend, track refill status | Low |
| **Document storage & download** | S3/local storage service, `DocumentService`, upload/download endpoints | Document list from API, upload, download, preview | Medium |
| **EOB/ERA viewing** | Use existing `/remittance` module — new patient-facing endpoint to filter by patient | EOB list with denial explanations, payment breakdown | Medium |
| **Notifications module** | Implement `NotificationsModule` (entity, service, email/SMS via SendGrid/Twilio) | Notification preferences, notification center | High |

### Phase 3: AI-Powered Patient Features (Weeks 6-10)

**Goal:** Leverage our existing Ollama/Mistral AI infrastructure to deliver AI features that competitors charge premium for.

| Task | Backend | Frontend | Effort |
|------|---------|----------|--------|
| **AI lab result explainer** | New endpoint: `POST /ai/explain-lab-result` — takes lab result + reference range, generates plain-language explanation using Ollama | "Explain my results" button next to each lab result | Medium |
| **AI symptom checker / care navigator** | New `PatientAiService` — patient describes symptoms in free-text, AI recommends care pathway (self-care, schedule appointment, urgent care, ER) with clinical safety guardrails | Chat interface in portal, symptom input, AI response with recommended action | High |
| **AI medication interaction checker** | New endpoint: `POST /ai/check-interactions` — takes patient's medication list + new medication, checks for interactions using Ollama | "Check interactions" feature in medications section | Medium |
| **AI question generator for visits** | New endpoint: `POST /ai/generate-questions` — takes patient's conditions, recent labs, upcoming appointment, generates questions to ask doctor | Pre-visit question list, printable | Medium |
| **AI health summary** | New endpoint: `POST /ai/health-summary` — generates plain-language summary of patient's health status from encounters, labs, problems, medications | "My Health Summary" section with AI-generated narrative | Medium |
| **AI personalized education** | New endpoint: `POST /ai/patient-education` — generates condition-specific education content based on patient's diagnoses, labs, medications | Dynamic education articles personalized to patient's conditions | Medium |

### Phase 4: Telemedicine & Remote Care (Weeks 10-14)

**Goal:** Complete the telemedicine backend and add remote monitoring capabilities.

| Task | Backend | Frontend | Effort |
|------|---------|----------|--------|
| **Telemedicine backend** | Implement `TelemedicineModule` — WebRTC signaling server, video session management, recording (optional) | Video call UI integration, patient-side join flow from portal | High |
| **Pre-visit digital check-in** | New endpoint: `POST /appointments/:id/check-in` — digital forms, insurance verification, copay estimation, consent collection | Check-in flow before appointment, form filling, insurance card upload | Medium |
| **Patient intake forms** | New `FormsModule` — dynamic form builder, form templates (registration, medical history, consent), form submission storage | Form rendering, submission, status tracking | High |
| **After-visit summaries** | New endpoint: `GET /encounters/:id/summary` — generates printable after-visit summary with instructions, medications, follow-up | After-visit summary view, PDF download, care plan display | Medium |
| **Consent management** | Implement service for existing `PatientConsent` entity — digital consent forms, e-signatures, consent history | Consent form viewing, e-sign, consent history | Medium |

### Phase 5: Advanced & Emerging (Weeks 14-20)

**Goal:** Differentiate with wearable integration, remote monitoring, and advanced AI.

| Task | Backend | Frontend | Effort |
|------|---------|----------|--------|
| **Wearable/device integration** | New `DeviceIntegrationModule` — Apple HealthKit, Google Fit, Fitbit API integration, sync data as FHIR Observation resources | Device connection settings, data visualization (steps, HR, sleep, glucose) | High |
| **Remote patient monitoring** | New `RpmModule` — device data ingestion, threshold alerts, care team dashboards, chronic disease protocols | RPM dashboard for patients, alert history, trend charts | High |
| **Medication adherence tracking** | New `AdherenceModule` — patient logs medication taken/missed, adherence score, reminders, care team visibility | Medication log, adherence score, reminder settings | Medium |
| **Proxy/caregiver access** | Extend auth system — proxy relationships, scoped permissions, audit logging | Caregiver login, patient switching, permission management | Medium |
| **Health summary export** | New endpoint: `GET /patients/:id/health-summary` — export as PDF, C-CDA document, or FHIR Bundle | Export buttons, format selection, download | Medium |
| **Patient-reported outcomes (PROs)** | New `ProModule` — PROMIS surveys, custom questionnaires, scheduled collection, trend analysis | Survey taking, results history, trend visualization | Medium |
| **AI personalized recommendations** | New `PatientAiService.recommend()` — nutrition, fitness, wellness recommendations based on patient data (like Oscar's Oswell) | Recommendations feed, actionable suggestions | Medium |
| **Group telehealth sessions** | Extend telemedicine — multi-participant sessions, group therapy, education sessions | Group session join, participant list | Medium |

---

## 5. COMPETITIVE POSITIONING STRATEGY

### 5.1 Our Unique Advantages

1. **AI-First Architecture**: We already have Ollama/Mistral integrated for clinical AI. We can extend this to patient-facing AI at minimal cost — competitors pay millions for AI features.

2. **Integrated RCM**: Our newly built Remittance/Denials/Appeals/Underpayments modules mean patients can see real EOB data, denial explanations, and billing transparency — most portals only show invoices.

3. **Multi-Tenant Design**: Our architecture supports multiple practices — patients could potentially access records across providers (like Epic's Care Everywhere but for smaller practices).

4. **Open Source / Self-Hosted**: Unlike Epic ($500K+ licenses) or athena (% of revenue), our platform can be deployed at low cost, making advanced portal features accessible to small/mid practices.

### 5.2 Recommended Priority Order

Based on patient usage data from athenahealth's survey (what patients actually use):

1. **View test results** (most used) → Phase 1 (wire lab API)
2. **Schedule appointments** → Phase 2 (self-scheduling)
3. **Pay bills** → Phase 2 (bill pay)
4. **Message care team** → Phase 2 (messaging)
5. **Request refills** → Phase 1 (wire existing backend)
6. **View visit notes** → Phase 1 (wire encounters API)
7. **AI features** → Phase 3 (our differentiator)

### 5.3 What Would Make Us Best-in-Class

To match or exceed Epic MyChart (KLAS 90.2), we would need:

| Feature Category | Epic MyChart | Our Target |
|-----------------|-------------|------------|
| Core portal features | ✅ Full | Phase 1-2 |
| AI care navigation | ✅ KPIN (2024) | Phase 3 |
| Telehealth | ✅ Built-in | Phase 4 |
| Remote monitoring | ✅ Sutter Sync | Phase 5 |
| Wearable integration | ✅ Apple Health | Phase 5 |
| Bill pay | ✅ Full | Phase 2 |
| Self-scheduling | ✅ Real-time | Phase 2 |
| Mobile app | ✅ Native | Future (PWA first) |
| Interoperability | ✅ Care Everywhere | Phase 5 (FHIR export) |
| AI lab explanation | ❌ Not yet | Phase 3 (our advantage) |
| AI medication interactions | ❌ Not yet | Phase 3 (our advantage) |
| AI personalized education | ❌ Not yet | Phase 3 (our advantage) |
| Integrated RCM transparency | ❌ Limited | Phase 2 (our advantage) |

---

## 6. SUMMARY

The current patient portal is a **UI prototype with 100% mock data** — none of the displayed information comes from the backend, and none of the interactive forms submit to any API. However, the backend infrastructure to support most core features already exists (appointments, prescriptions, labs, billing, patients).

The biggest gaps relative to competitors are:
1. **No real data integration** (everything is mocked)
2. **No secure messaging** (patients' #2 most-used feature)
3. **No bill pay** (revenue impact)
4. **No AI features** (our biggest opportunity for differentiation)
5. **No notifications** (no-show reduction)
6. **No telemedicine backend** (video visits)

Our **AI-first strategy** is the key differentiator. While Epic and athena are adding AI incrementally, we can build AI-native patient features (lab result explanation, symptom checker, medication interactions, personalized education) using our existing Ollama/Mistral infrastructure at a fraction of the cost.
