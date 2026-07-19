# Clinical Note-Taking: Codebase State, Competitor Analysis & AI Roadmap

## Date: July 2026
## Status: Foundation exists (~60% of core note-taking); 7 high-leverage AI features identified for build-out

---

## 0. TL;DR

Contrary to the assumption that patient note-taking is "not implemented yet," the codebase already contains a substantial **clinical documentation module** (`backend/src/modules/clinical/`) with SOAP note generation, audio transcription, AI note drafting, version history, signing workflow, evidence linking, quality scoring, action suggestions (orders/codes/CDI/prior-auth/AVS), and payer-risk-aware documentation prompts.

What's **missing** vs. competitors (drchrono, SimplePractice, athenahealth) is summarized in §3, and a 7-item AI feature roadmap with feasibility, effort, and phasing is in §6.

---

## 1. CURRENT STATE ASSESSMENT

### 1.1 What Exists Today

#### Backend — `backend/src/modules/clinical/`

| Component | File | Status |
|---|---|---|
| `DocumentationSession` entity | `entities/documentation-session.entity.ts` | Full lifecycle: `draft → transcribed → note_generated → reviewed → signed → cancelled` |
| Consent capture | Same entity | `pending / granted / declined / provider_dictation` with auditor, timestamp, method |
| Audio retention policy | Same entity | `delete_after_transcription` default; `audioDeletedAt` tracked |
| Transcript storage | Same entity | Full transcript, language, confidence, per-utterance JSONB (speaker, start/end, confidence) |
| SOAP note JSONB | Same entity + `Encounter.soapNote` | Both session and encounter carry the structured note |
| Note versioning | `entities/documentation-note-version.entity.ts` | `AI_GENERATED / CLINICIAN_EDITED / SIGNED` sources with version numbers |
| AI note generation | `documentation.service.ts` lines 144–160 | `AiService.generateStructured` with strict "do not invent facts" prompt |
| Signing workflow | `documentation.service.ts` lines 196–218 | Provider-or-admin only; applies note to encounter; transitions encounter to `COMPLETED`; signs encounter |
| HIPAA audit trail | `documentation.service.ts` lines 267–284 | Every action logged: `DOCUMENTATION_SESSION_CREATED`, `..._AUDIO_TRANSCRIBED`, `..._NOTE_GENERATED`, `..._NOTE_REVIEWED`, `..._NOTE_APPLIED_TO_ENCOUNTER`, `..._NOTE_SIGNED` |
| Provider documentation preferences | `documentation-intelligence.service.ts` | Per-provider: preferred language, note style, required sections, `doNotInfer` list, custom instructions |
| Evidence linking | `documentation-intelligence.service.ts` lines 46–69 | Maps each SOAP section back to supporting transcript utterance with match score |
| Quality check | `documentation-intelligence.service.ts` lines 77–93 | Scores note completeness (critical/warning findings, 0–100 score) |
| Pre-visit chart prep | `documentation-intelligence.service.ts` lines 95–117 | AI summary of last 5 encounters for a patient |
| AI action suggestions | `documentation-actions.service.ts` | From reviewed SOAP note: orders (lab/imaging/referral/procedure), diagnoses (ICD), procedures (CPT), CDI prompts, prior-auth recommendations, after-visit summary |
| Suggestion review workflow | `documentation-actions.service.ts` lines 59–77 | `PENDING → ACCEPTED / DISMISSED` with reviewer + timestamp |
| Payer denial/underpayment risk | `documentation-revenue.service.ts` | Per-payer risk scoring + documentation prompts keyed to root-cause categories |
| Appeal evidence bundling | `documentation-revenue.service.ts` lines 54–75 | Note + denial reason + filing deadline in one payload |
| Clinical templates | `entities/clinical-template.entity.ts` + `clinical-template-seed/` | Entity exists; specialty seed library not confirmed |

#### Frontend — `frontend/src/pages/ai-encounter/AiEncounterPage.tsx`

- 4-step wizard: setup → record/transcribe → SOAP review → code suggestions
- `AudioRecorder` component for browser mic capture
- `documentationService.ts` client wiring all 7 backend endpoints
- `ClinicalTemplateFormModal` + `ClinicalTemplateGallery` components for template management

#### Encounter Entity — `backend/src/modules/clinical/entities/encounter.entity.ts`

Already carries rich structured clinical data beyond SOAP:
- Vitals (BP, HR, temp, weight, height, BMI, SpO2, RR, pain, blood glucose, IOP, head/waist circumference)
- Diagnoses (ICD-10-CM / SNOMED CT / ICD-11, primary flag, chronic/acute/rule_out, status)
- Treatment plan (meds, procedures, follow-up, referrals, goals, interventions, home instructions, patient education, restrictions, recall reminders)
- Allergies (allergen, reaction, severity, type, onset)
- Orders (labs, imaging, referrals, procedures — each with status + priority)
- Attachments (lab_result / imaging / consent / referral / other)
- `clinicalNotes` + `notes` free-text fields
- `signedAt / signedBy / lockedAt / lockedBy / isLocked` lock state
- `auditTrail` JSONB array

### 1.2 What's Missing vs. Competitors

| Gap | Status | Impact |
|---|---|---|
| Ambient (live, in-visit) capture | ❌ Only post-visit file upload | Major — all 3 competitors have ambient |
| Real-time streaming transcription | ❌ Batch upload only | Major — differentiator gap |
| DAP / BIRP / behavioral-health formats | ❌ SOAP only | Blocks behavioral-health market |
| Specialty-specific templates (cardiology, ortho, behavioral, etc.) | ⚠️ Entity exists, no seeded library | drchrono/athena gate to premium tiers |
| Multi-language note generation | ⚠️ Preference field exists, not surfaced in prompt | EverHealth supports 10+ languages |
| Co-signing / supervision workflow | ❌ Only single-provider sign | SimplePractice "Sign and Share" is gold standard |
| Note amendments / unlock-after-sign | ❌ Signed = immutable | **Compliance gap** — required for HIPAA/Medicare audit |
| Patient after-visit summary delivery | ⚠️ AI generates as suggestion, no patient-facing delivery | athena delivers AVS; closes the loop |
| Auto-population of vitals/meds/labs into note context | ❌ AI prompt doesn't pull chart context | Level 3 integration gap |
| Voice commands (Suki-style "show me last labs") | ❌ | Only Suki does this well |
| Mobile capture | ❌ Web only | drchrono/athena have native iOS |

---

## 2. COMPETITOR ANALYSIS

### 2.1 drchrono

**Templates & Note Types**
- SOAP notes with preset templates + community library
- Custom Form Builder with specialty-specific templates
- Persistent forms auto-populate across visits
- Charting by exception supported
- Specialty templates gated to Growth/Premium tiers

**Note Creation Methods**
- Free text notepad
- Template-based forms
- M*Modal speech-to-text (iOS native)
- iPad/iPhone full charting
- EverHealth Scribe ambient AI (Premium only)

**AI Features**
- **EverHealth Scribe** — passive ambient listening (in-person + telehealth), structured note generation, 10+ languages, post-visit review workflow, maps notes to EHR fields, **CPT/ICD billing-assist suggestions**
- Available on Premium tier only (paid add-on)

**Signing/Locking**
- E-sign + lock
- **Supervising provider co-signing**
- Bulk lock capability
- Full amendment workflow with audit trail
- API webhooks: `CLINICAL_NOTE_LOCK`, `CLINICAL_NOTE_UNLOCK`

**Chart Integration**
- Custom vitals with trend visualization
- Medications module integrated
- Quest/LabCorp lab integration (extended labs as add-on)
- Reference fields pull data from other chart sections
- Persistent forms auto-populate from previous visits

**Pricing**
- Quote-based, ~$100–500/provider/month
- Speech-to-text: add-on on Foundation, included on Growth/Premium
- EverHealth Scribe: Premium only
- Specialty templates: add-on on Foundation, included on Growth/Premium

**User Complaints**
- Post-EverHealth acquisition decline (UI clutter, slowness, support quality)
- Unreliable claims processing (users report $20K losses)
- Auto-renewal contracts, 10–15% annual price hikes
- Capterra rating: 3.9/5 (490 reviews)

### 2.2 SimplePractice

**Templates & Note Types**
- SOAP, **DAP, BIRP** (behavioral-health native)
- Simple progress notes
- Intake forms, treatment plans, consent forms
- Pre-session AI summaries

**Note Creation Methods**
- Free text
- Template-based
- **Live recording during SimplePractice Telehealth only**
- Post-session dictation
- Audio/text file upload
- AI draft generation

**AI Features — Note Taker ($35/mo add-on)**
- Live telehealth transcription
- Post-session dictation
- File upload processing
- AI generates SOAP/DAP/BIRP drafts
- **Adaptive learning from clinician edits**
- **Pre-session summaries** combining recent notes + treatment plans
- 7-day transcript retention
- HITRUST certified
- Per-session opt-in; clients can opt out

**Signing/Locking**
- E-sign + lock
- **Supervision "Sign and Share" workflow** — supervisee signs + shares, supervisor reviews/requests edits/co-signs
- Amendment tracking with "Notice of Data Integrity"
- Client e-signature for consent forms
- Locked notes restrict appointment time/date/duration edits

**Chart Integration**
- Treatment plans referenced in notes
- Diagnoses from dropdown
- Pre-appointment summaries auto-generated
- **No auto-population of vitals/meds/labs** (behavioral health focus)

**Pricing**
- Starter $49 / Essential $79 / Plus $99 per month
- Note Taker: $35/mo add-on on all plans
- ePrescribe: $49/mo add-on
- Group appointments: $20/mo add-on (included on Plus)

**User Complaints**
- AI draft takes 5–10 minutes to generate (problematic for back-to-back sessions)
- Only works with SimplePractice Telehealth (no Zoom/Doxy)
- No in-person recording on web (mobile 2.5hr cap)
- No ICD/CPT code suggestions
- Behavioral-health only — no primary care/specialties
- Monthly fees doubling over 2 years reported

### 2.3 athenahealth

**Templates & Note Types**
- SOAP + 50+ specialty templates
- Problem-based plans
- Auto-generated after-visit summaries

**Note Creation Methods**
- Free text in athenaOne
- Specialty-specific templates
- Ambient Notes (passive listening in-person + telehealth)
- Post-visit dictation with pause/resume
- athenaOne Mobile

**AI Features — "Choose-Your-Player" Model**
- **Suki AI** — 72% documentation time reduction, 99 specialties, voice commands for orders, 200+ athena customers
- **iScribe AI** — patented EHR integration
- **Microsoft Dragon Copilot** — launching H1 2026
- **athenaAmbient (first-party, in testing Feb 2026)** — will be **free**, generates notes + diagnoses + orders + prescriptions, real-time care gap alerts

**Signing/Locking**
- Standard e-sign, HIPAA-compliant audit trail

**Chart Integration**
- AI surfaces diagnoses from conversation
- Suggests and creates orders
- Captures prescriptions
- Uses chart history for context
- **Real-time care gap alerts**
- athenaAmbient at launch does **NOT** include billing automation or coding intelligence

**Pricing**
- Ambient Notes free in athenaOne
- Third-party models (Suki, iScribe, Dragon): $200–400/provider/month
- Clinicians can switch models at calendar-month boundaries

**User Complaints**
- athenaAmbient not yet GA
- Model-dependent capability inconsistency (multi-provider groups have audit headaches)
- No admin automation (prior auths, letters, scheduling)
- Verbose output if not edited
- Accuracy/privacy/consent concerns (though 88% report positive workflow impact)

### 2.4 Feature Comparison Matrix

| Capability | drchrono | SimplePractice | athenahealth |
|---|---|---|---|
| SOAP notes | ✓ | ✓ | ✓ |
| DAP notes | Limited | ✓ | Limited |
| BIRP notes | Limited | ✓ | Limited |
| Specialty templates | Growth/Premium | N/A | Via third-party |
| Free text entry | ✓ | ✓ | ✓ |
| Template-based | ✓ | ✓ | ✓ |
| Ambient listening | Premium (EverHealth) | No | ✓ |
| Post-visit dictation | ✓ | ✓ | ✓ |
| Mobile dictation | ✓ (iOS) | ✓ | ✓ |
| Audio upload | Limited | ✓ | Limited |
| AI draft generation | Premium | $35/mo add-on | Free (third-party) |
| Adaptive learning | Limited | ✓ | Model-dependent |
| Coding suggestions | Premium (EverHealth) | None | Model-dependent |
| Vitals auto-population | ✓ | Limited | Limited |
| Meds auto-population | ✓ | Limited | Limited |
| Diagnosis auto-population | Limited | Limited | ✓ |
| Lab auto-population | ✓ | Limited | Limited |
| E-signature | ✓ | ✓ | ✓ |
| Amendment tracking | ✓ | ✓ | ✓ |
| Supervision workflow | Limited | ✓ | Limited |
| HIPAA compliant | ✓ | ✓ (HITRUST) | ✓ |

---

## 3. MARKET GAP ANALYSIS

### 3.1 The $5B Small-Practice Gap

- ~190,000 independent US practices with 1–10 physicians deliver the majority of outpatient care but are structurally excluded from enterprise AI scribes
- Enterprise tools cost $500–1,500/provider/month with 6–12 month sales cycles and 4–12 week implementations
- AI scribe adoption: **49% of large practices (20+ physicians) vs. only 22% of small practices (<7)**
- Willingness-to-pay: 37.5% of PCPs willing to pay ≤$50/mo, 32.2% ≤$100/mo, only 6.6% >$100/mo, 22.4% only if free
- Market rates are $135–400/mo; affordable options (Freed at $99–149/mo) are lightweight point solutions requiring copy-paste back into the EHR

### 3.2 Behavioral Health vs. Primary Care Divide

- Behavioral health needs SOAP/DAP/BIRP, mental status exam, risk assessment, 42 CFR Part 2 compliance, weekly session-based documentation
- Primary care EHRs are built for 15-min checkbox visits and fail therapy workflows (50-min narrative sessions)
- SimplePractice owns behavioral health but has no primary care
- drchrono/athena cover primary care but treat behavioral health as second-class

### 3.3 Integration Depth Gap

- **Level 1** (copy-paste, 2–4 min/note): most small-practice third-party tools
- **Level 2** (API, limited discrete data, 60–120 sec/note)
- **Level 3** (full bidirectional, 30–90 sec/note): enterprise only
- Small practices are stuck at Level 1

### 3.4 Specialty Template Gap

- Enterprise tools tune per specialty (cardiology HF/AFib, ortho MSK exam, oncology staging)
- Small-practice tools offer generic templates; specialty tuning requires expensive custom config

### 3.5 Ambient AI Scribe Market

- 2025 market size: $600M–$1.75B; projected $12B–$27.8B by 2034 (CAGR 23.9–48.2%)
- Market share: Nuance DAX 33%, Abridge 30%, Ambience 13%, Suki 10%, Nabla 4%, Freed 4%
- 68% of physicians report increased use of AI for documentation
- 48.2% of US physicians report burnout (AMA 2023); 20.9% spend 8+ hours/week on EHR tasks outside work hours

---

## 4. WHAT SMALL PRACTICES ACTUALLY NEED

Based on practitioner feedback and market research:

1. No dedicated IT required — setup and onboarding manageable by non-technical team
2. Native EHR integration — no copy-paste, no third-party bridge, no reconciliation step
3. Flexible, hybrid documentation — AI for some sections, templates for others
4. Specialty-aware output — notes reflecting clinical language of specialty
5. Affordable pricing — $50–150/provider/month, not $500+
6. Month-to-month contracts — not 12-month minimums
7. Fast implementation — days, not months
8. Discrete data population — auto-populate vitals, meds, diagnoses, labs
9. Coding suggestions — ICD-10/CPT recommendations from notes
10. Workflow efficiency — 30–90 second note finalization, not 5+ minutes

---

## 5. AI FEATURES NEURALINE CAN PROVIDE

### Tier 1 — Close Existing Gaps (Highest ROI)

#### 1. Ambient Real-Time Capture
- WebSocket streaming from browser mic during the encounter (not just post-visit upload)
- Reuse `AssemblyAiTranscriptionService` for streaming (requires streaming API tier)
- Browser `MediaRecorder` + `WebSocket` on frontend with token-auth on socket
- **Closes the biggest competitive gap vs. all 3 competitors**

#### 2. Chart-Context-Aware Note Generation
- Pull patient's last 5 encounters, current problem list, active meds, recent labs, and vitals into the SOAP generation prompt
- `prepareChart` method already builds this summary — wire it into `generateNote`
- Pure prompt-engineering change, low effort
- **None of the three competitors do this well**

#### 3. Co-Signing / Supervision Workflow
- Add `coSignerId`, `coSignedAt`, `coSignDecision` (approved/changes-requested) to `DocumentationSession`
- New controller endpoints for supervisor queue
- Frontend UI for supervisor review queue
- SimplePractice's "Sign and Share" is the gold standard

#### 4. Note Amendments After Signing
- New `DocumentationAmendment` entity with reason, old/new content, auditor
- Required for HIPAA and Medicare audit compliance
- Currently signed = immutable, which is a real compliance gap

#### 5. Real-Time Coding Suggestions + Discrete Field Auto-Population
- As transcript streams, surface ICD-10/CPT candidates with confidence
- Extract vitals ("BP 138/86"), meds ("increase lisinopril to 20mg"), orders ("let's get a CBC"), referrals ("refer to cardiology") into structured `Encounter` fields
- Must be drafted, not auto-applied — reuse `DocumentationSuggestion` review workflow
- Depends on #1 for true real-time; otherwise runs post-transcript
- **Level 3 integration — the gap small practices can't get elsewhere**

#### 6. Specialty Templates + DAP/BIRP
- Seed `ClinicalTemplate` for primary care, behavioral health (SOAP/DAP/BIRP), cardiology, orthopedics, pediatrics, psychiatry
- Schema change: make `soapNote` a discriminated union or add `noteFormat` column
- Per-format prompt variants in `generateNote`
- drchrono gates this to Premium; include on all tiers as differentiator
- **Unlocks behavioral-health market SimplePractice owns**

#### 7. Payer-Aware Documentation Coaching
- `DocumentationRevenueService.payerRisk` already computes per-payer denial root causes
- Surface as inline prompts during note writing ("Aetna denies 23% of claims from this practice for missing medical necessity — document clinical indication for the imaging order")
- **No competitor does this — unique differentiator leveraging existing infrastructure**

#### 8. After-Visit Summary Delivered to Patient Portal
- `DocumentationActionsService` already generates AVS as a suggestion
- Add endpoint to publish AVS to patient
- Add `GET /patients/portal/visits/:id/summary` endpoint
- Add portal page for AVS viewing
- athena generates AVS; drchrono/SimplePractice don't deliver it to a patient portal

### Tier 2 — Differentiators None of the Three Fully Deliver

#### 9. Voice Commands (Suki-Style)
- "Show me last CBC", "Add lisinopril 10mg", "Schedule follow-up in 2 weeks"
- Interpreted against the encounter + chart context
- Suki is the only competitor doing this well

#### 10. Adaptive Learning From Clinician Edits
- Track diff between AI draft and signed note per provider
- Fine-tune prompt or a small personal LoRA
- SimplePractice does this opaquely; do it transparently with an opt-in

#### 11. CDI Prompts in Real-Time
- `DocumentationActionsService` already generates `cdiPrompts` post-review
- Surface during dictation: "You mentioned chest pain but no ROS was documented — add ROS?"
- Ambience Healthcare charges $300–500/mo for this

#### 12. Prior Authorization Pre-Check
- `DocumentationActionsService` already outputs `priorAuthorization` recommendations
- Wire to the eligibility module to auto-initiate prior auth when an order is signed
- **No competitor automates this**

#### 13. Specialty-Tuned Note Generation
- Separate prompts/few-shot examples per specialty
- DeepScribe built a $750/mo business on this; include on Professional tier

#### 14. Multilingual Note Generation
- `DocumentationPreference.preferredLanguage` exists but isn't used in the prompt
- Generate note in provider's preferred language regardless of conversation language
- EverHealth Scribe supports 10+ languages; athena/SimplePractice don't publish language lists

#### 15. Quality Score Gating Before Sign
- `qualityCheck` exists; block signing if score < threshold or critical findings
- Reduces denials at the source
- **None of the three competitors enforce this**

### Tier 3 — Adjacent AI Features

#### 16. Ambient Intake Summarization
- Patient completes pre-visit form, AI summarizes into the Subjective section draft before provider enters the room

#### 17. Referral Letter Auto-Generation
- From the note's plan section, generate a structured referral letter

#### 18. Patient Education Handout Generation
- Plain language at 6th-grade reading level, localized

#### 19. Risk-Stratified Follow-Up Scheduling
- AI suggests follow-up timing based on assessment + problem list acuity

#### 20. Note-to-Claim Auto-Coding
- Bridge signed note → `EncounterClaim` with AI-suggested CPT/ICD
- Leverages existing `SecondaryClaimService` and superbill AI infrastructure

---

## 6. THE 7 RECOMMENDED BUILDS

### Feasibility Matrix

| # | Feature | Feasibility | Effort | Dependencies / Risks |
|---|---|---|---|---|
| 1 | Ambient streaming capture | High | **High** | New WebSocket gateway; AssemblyAI streaming tier; browser `MediaRecorder` + `WebSocket`; token-auth on socket. Existing `AssemblyAiTranscriptionService` is batch-only — needs streaming sibling. |
| 2 | Chart-context-aware note generation | High | **Low** | `prepareChart` already exists. Inject its output into the `generateNote` prompt. Pure prompt-engineering change. |
| 3 | Co-signing + amendments | High | **Medium** | New `DocumentationAmendment` entity + migration; add `coSignerId/coSignedAt/coSignDecision` columns; new controller endpoints; frontend UI for supervisor queue. Compliance-relevant — needs careful audit trail. |
| 4 | Real-time coding + discrete field auto-population | Medium | **High** | Depends on #1 for true real-time; otherwise runs post-transcript. Structured extraction → `Encounter` JSONB fields. Hallucination risk — must be drafted, not auto-applied. |
| 5 | Specialty templates + DAP/BIRP | High | **Medium** | `ClinicalTemplate` entity exists. Schema change: add `noteFormat` enum column + generalized `note` JSONB. Seed library for ~6 specialties. Per-format prompt variants. |
| 6 | Payer-aware documentation coaching | High | **Low** | `DocumentationRevenueService.payerRisk` already returns prompts. Fetch when session opens and surface as inline callouts in note editor. |
| 7 | AVS delivery to patient portal | High | **Low** | `DocumentationActionsService` already generates AVS as suggestion. Add endpoint to publish + `GET /patients/portal/visits/:id/summary` + portal page. |

**Verdict:** All 7 are doable. None require new infrastructure you don't have (Postgres, NestJS, AI service, patient portal, AssemblyAI integration all exist). The only new external dependency is AssemblyAI's **streaming** API tier for #1, which is a paid upgrade from current batch transcription.

### Risks & Caveats

1. **#1 (streaming) is the long pole.** WebSocket gateway + new frontend recording UI + streaming transcription client + reconnection/error handling. If skipped, #4 becomes "near-real-time" (runs after visit ends) instead of truly live — still useful, just less differentiated.

2. **#3 (amendments) is a compliance feature, not a UX feature.** Must be done correctly — full audit trail, reason-for-amendment required, original preserved. Don't rush.

3. **#4 (auto-population) has the highest clinical risk.** AI-extracted vitals/meds/orders must always be **drafts requiring provider confirmation**, never auto-applied. Reuse existing `DocumentationSuggestion` review workflow (`PENDING → ACCEPTED/DISMISSED`).

4. **#5 (DAP/BIRP) requires a schema decision.** Either:
   - (a) Add `noteFormat` enum column and store different formats in a generalized `note` JSONB (recommended — future-proofs for new formats), or
   - (b) Keep `soapNote` and add `dapNote`, `birpNote` columns (wasteful).

5. **#6 and #7 are quick wins** — they wire together services that already exist. Do these first for visible progress.

### Recommended Phasing

**Phase A — Quick Wins (items 2, 6, 7)** — pure wiring of existing services, no new infrastructure, immediate visible value. Validates UX patterns Phase C will rely on.

**Phase B — Compliance + Formats (items 3, 5)** — schema migrations, audit trail work, behavioral-health market unlock. Can ship independently of streaming.

**Phase C — Real-Time AI (items 1, 4)** — the big differentiator. WebSocket streaming + inline coding. Highest effort, highest reward. Requires AssemblyAI streaming tier confirmation.

This way you ship value continuously instead of waiting for one big release.

### Pre-Build Verification

Before greenlighting #1, confirm:
- AssemblyAI plan supports streaming (or budget for the upgrade)
- Browser `MediaRecorder` + WebSocket is acceptable vs. native mobile apps (drchrono/athena have native iOS — Neuraline is web-only)
- Clinic rooms have microphones capable of picking up both provider and patient (a real-world adoption barrier)

---

## 7. SOURCES

### Platform Documentation
- https://www.drchrono.com
- https://www.simplepractice.com
- https://www.athenahealth.com
- https://support.drchrono.com
- https://support.simplepractice.com

### drchrono Specific
- https://support.drchrono.com/home/360013034851-clinical-notes
- https://eh.drchrono.com/everhealth-scribe
- https://support.drchrono.com/home/everhealth-scribe-frequently-asked-questions-faq
- https://support.drchrono.com/home/115000964187-how-does-a-supervising-provider-sign-off-on-a-rendering-provider-s-clinical-note
- https://www.drchrono.com/pricing/
- https://www.trustpilot.com/review/drchrono.com
- https://softwarefinder.com/emr-software/drchrono/reviews

### SimplePractice Specific
- https://www.simplepractice.com/features/ai-therapy-notes-taker/
- https://support.simplepractice.com/hc/en-us/articles/34118738412685-Understanding-Note-Taker
- https://support.simplepractice.com/hc/en-us/articles/42030897904269-Using-dictation-for-client-notes
- https://support.simplepractice.com/hc/en-us/articles/35507783848973-Note-Taker-FAQs
- https://support.simplepractice.com/hc/en-us/articles/28743754453773-Adding-progress-notes-for-individual-appointments
- https://support.simplepractice.com/hc/en-us/articles/360048689851-Reviewing-and-signing-documentation-under-supervision
- https://www.simplepractice.com/pricing/
- https://www.trytwofold.com/compare/simplepractice-ai-note-taker-review
- https://www.mentalyc.com/blog/simplepractice-reviews

### athenahealth Specific
- https://www.athenahealth.com/solutions/ambient-notes
- https://www.businesswire.com/news/home/20251104083540/en/athenahealths-AI-native-Clinical-Encounter-Transforms-the-EHR-into-a-Real-Time-Clinical-Intelligence-Partner
- https://www.businesswire.com/news/home/20251209452332/en/athenahealth-Collaborates-with-Microsoft-to-Offer-Microsoft-Dragon-Copilot-as-Ambient-Notes-Option-Enhancing-Choice-and-Flexibility-for-Ambulatory-Clinicians
- https://www.businesswire.com/news/home/20241030050913/en/athenahealth-Launches-AI-Powered-Ambient-Notes-a-Unique-Fully-Integrated-Documentation-Solution-Designed-for-Ambulatory-Practices
- https://physicianaitools.com/tools/athenahealths-ambient-notes/
- https://www.deepcura.com/resources/ai-scribe-athenahealth
- https://www.commure.com/blog-scribe/athenahealth-ai-scribe-review

### Market Research
- https://marketintelo.com/report/ai-ambient-clinical-documentation-scribe-market
- https://www.grandviewresearch.com/industry-analysis/us-ai-medical-scribing-market-report
- https://growthmarketreports.com/report/ambient-ai-scribe-market
- https://2digital.news/ambient-listening-in-healthcare-what-are-medical-ai-scribes/

### Small Practice Barriers
- https://agentman.ai/blog/5-billion-problem-small-practices-left-behind-healthcare-ai
- https://www.ontariomd.ca/documents/ai%20scribe/ai%20scribe%20evaluation_2024-07-31.pdf
- https://www.nexusclinical.com/blogs/ai-medical-scribe-worth-it-for-small-clinics/
- https://www.trytwofold.com/blog/why-small-practices-cant-adopt-hospital-tools

### Specialty-Specific
- https://www.icanotes.com/2026/06/29/behavioral-health-ehr-vs-general-medical-ehr/
- https://pimsyehr.com/why-primary-care-ehrs-fail-behavioral-health-practices/
- https://patientnotes.ai/specialties

### AI Scribe Comparisons
- https://www.axios.com/pro/health-tech-deals/2024/03/21/ai-medical-scribes-comparison-price-accuracy-abridge-suki-ambience-nuance
- https://dr7.ai/blog/health/abridge-vs-suki-vs-ambience-best-ai-scribe-2025/
- https://litmustools.com/best-ai/ai-medical-scribes/
- https://omnimd.com/compare/deepscribe-vs-suki/
