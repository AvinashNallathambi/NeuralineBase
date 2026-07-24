# Master Implementation Plan: Three Parallel Workstreams

## Date: July 19, 2026
## Status: **REVISED** — audits complete; scope dramatically reduced for W2 and W3
## Scope: Clinical note-taking unification + Patient portal gap closure + EOB/ERA/denials gap closure

---

## 0. Audit Results Summary (July 19, 2026)

Audits of W2 (patient portal) and W3 (EOB/ERA/denials) were completed on July 19, 2026. **Both gap docs were severely outdated.** The actual state is dramatically further along than documented:

| Workstream | Original Gap Doc Status | Actual Audited Status | Remaining Work |
|---|---|---|---|
| **W1** Clinical note-taking | Spec current (July 19) | Spec is accurate | Full unification spec (~3-4 weeks) |
| **W2** Patient portal | "100% mock data, ~30% functional" | **~85% functional, production-ready** | 6 features missing (AVS, notifications, telehealth backend, consent service, document storage, intake forms) + 7 low-priority emerging features |
| **W3** EOB/ERA/denials | "Critical gaps in 12 capabilities" | **~90% complete — 17 of 19 capabilities implemented** | 3 features missing (276/277, voice AI, contract NLP) + production testing |

**Both gap docs have been updated** with `§0 — Audit Results (July 19, 2026)` sections prepended. The original analysis is preserved below for historical reference.

**Impact on this plan:** W2 and W3 are no longer large build-outs. They are small gap-closure efforts. W1 (clinical unification) is now the largest remaining workstream by far.

---

## 1. Workstream Overview (Revised)

| ID | Workstream | Source Doc | Primary User | Remaining Effort | Feature Flag |
|---|---|---|---|---|---|
| **W1** | Clinical note-taking unification | `CLINICAL-NOTE-TAKING-UNIFICATION-SPEC.md` | Providers | **Large** (~3-4 weeks) | `FEATURE_UNIFIED_DOCUMENTATION` |
| **W2** | Patient portal gap closure | `PATIENT-PORTAL-GAP-ANALYSIS.md` §0 | Patients | **Small-Medium** (~2-3 weeks) | `FEATURE_PATIENT_PORTAL_V2` |
| **W3** | EOB/ERA/denials gap closure | `EOB-ERA-DENIAL-GAP-ANALYSIS.md` §0 | Billing staff | **Small** (~1-2 weeks + testing) | `FEATURE_REVENUE_CYCLE_V2` |

---

## 2. Shared Dependencies (Revised)

### 2.1 Notifications Module (Still a Stub — Confirmed by Audit)

The audit confirmed `NotificationsModule` exists but is not wired to the patient portal or used for reminders. This remains a shared dependency.

| Consumer | Use Case |
|---|---|
| W1 (Clinical) | Payer-risk prompts as in-app notifications; documentation session signed → notify billing |
| W2 (Portal) | Appointment reminders, refill status, lab result available, new secure message |
| W3 (EOB/ERA) | Denial received → notify billing; appeal deadline approaching; underpayment detected |

**Action:** Build a minimal `NotificationsModule` first (entity + service + in-app + email + SMS stub).

### 2.2 EncounterClaim API Contract (Already Exists — Verified)

The audit confirmed `POST /api/v1/billing/claims` exists and W3's remittance module already auto-matches to `EncounterClaim`. W1's "Submit Claim Directly" just needs to call the existing endpoint. **No new work needed** — just verify the contract accepts `{ encounterId }`.

### 2.3 Remittance / EOB Entities (Already Exist — Confirmed by Audit)

The audit confirmed `Remittance`, `RemittanceClaim`, `RemittanceServiceLine`, `ClaimAdjustment`, `EOB`, `CarcCode`, `RarcCode` entities all exist and are functional. W2's "View EOBs" feature is **already implemented** (`GET /patients/portal/eobs`). **No dependency — already shipped.**

### 2.4 PatientInsurance Lookup (Already Exists)

The audit confirmed `PatientInsurance` is fully implemented in the billing module. W1's payer-prompt feature just needs to query it. Extract a thin `PatientInsuranceLookupService` only if `ClinicalModule` importing `BillingModule` creates a circular dependency.

### 2.5 DocumentationSession SOAP Note (W1-Only Until AVS)

W2's AVS delivery feature is blocked on W1 shipping the documentation unification + action drafts. This remains a real sync point.

---

## 3. Revised Sequencing

### Track A: Shared Infrastructure (~3-5 days)

| # | Task | Blocks | Status |
|---|---|---|---|
| A1 | Build `NotificationsModule` (entity, service, in-app + email + SMS stub, audit) | W1, W2, W3 | Not started |
| A2 | Verify `POST /api/v1/billing/claims` accepts `{ encounterId }`; extract `PatientInsuranceLookupService` if circular dep | W1 | Verify + small extraction |

### Track B: W1 — Clinical Note-Taking Unification (~3-4 weeks) — LARGEST REMAINING WORK

Follows `CLINICAL-NOTE-TAKING-UNIFICATION-SPEC.md` exactly. This is now the primary build effort.

| Phase | Tasks | Depends On |
|---|---|---|
| B1 | Backend: migrations + `DocumentationService` new methods + controller endpoints + encounter sync | A2 |
| B2 | Frontend: `documentationService.ts` extensions + `DocumentationPanel` + sub-components | B1 |
| B3 | Frontend: encounter editor Tab integration + AI Assist rewire + AI wizard redirect | B2 |
| B4 | Frontend: `DocumentationSessionListPage` + sidebar + deprecation banner | B3 |
| B5 | Wire "Submit Claim Directly" button | A2 |
| B6 | Feature flag `FEATURE_UNIFIED_DOCUMENTATION` rollout + testing | B4, B5 |

### Track C: W3 — EOB/ERA/Denials Gap Closure (~1-2 weeks + testing) — SMALL

**Most of W3 is already built.** Only 3 features are missing:

| # | Task | Effort | Priority |
|---|---|---|---|
| C1 | Claim status inquiry (276/277) — X12 276/277 parser + Stedi integration | Medium | MEDIUM |
| C2 | Contract intelligence (NLP contract PDF parsing) | Large | MEDIUM |
| C3 | Voice AI for payer calls — Whisper integration for payer IVR | Large | LOW |
| C4 | **Production testing** — import real ERA 835 files, verify auto-posting, denial generation, appeal letters, underpayment detection | Medium | **HIGH** |

**Recommendation:** Do C4 (production testing) first to validate the existing implementation before building C1-C3. C2 and C3 are large efforts with lower ROI — defer unless explicitly requested.

### Track D: W2 — Patient Portal Gap Closure (~2-3 weeks) — SMALL-MEDIUM

**Most of W2 is already built.** Only 6 features are missing (high/medium priority):

| # | Task | Effort | Priority | Depends On |
|---|---|---|---|---|
| D1 | After-visit summaries with care plans (reads from W1's documentation session) | Medium | HIGH | B6 |
| D2 | Notifications (SMS/email/push for appointments, refills, lab results, messages) | Medium | HIGH | A1 |
| D3 | Telehealth video visits from portal (backend token generation endpoint) | Medium | HIGH | None |
| D4 | Consent management service (entity exists, no API — quick win) | Small | MEDIUM | None |
| D5 | Document storage & download (general, not just insurance cards) | Medium | MEDIUM | None |
| D6 | Pre-visit digital check-in + patient intake forms | Large | MEDIUM | None |
| D7 | Health summary export (PDF/CCD/FHIR) | Medium | MEDIUM | None |
| D8 | **Production testing** — test patient login, self-scheduling, messaging, bill pay, AI features, EOB viewing end-to-end | Medium | **HIGH** | None |

**Low-priority emerging features (defer unless requested):** wearable integration, remote patient monitoring, medication adherence tracking, proxy/caregiver access, group telehealth, patient-reported outcomes.

**Recommendation:** Do D8 (production testing) first to validate the existing portal. Then D4 (consent — quick win), D3 (telehealth backend), D2 (notifications), D1 (AVS — blocked on B6), D5/D6/D7.

---

## 4. Revised Critical Path

```
Days 1-5:   [A1 A2] ──────────────────────────────────────────────────
                │
                ├──> B1 (W1 backend) ──> B2 ──> B3 ──> B4 ──> B5/B6  [~3-4 weeks]
                │
                ├──> C4 (W3 testing) ──> C1 (276/277)                 [~1-2 weeks]
                │
                └──> D8 (W2 testing) ──> D4 ──> D3 ──> D2 ──> D1      [~2-3 weeks]
                                              (D1 depends on B6)
```

**Sync points (hard dependencies):**
1. **A1 (Notifications) must ship before** D2 (portal notifications) and W1's payer-prompt notifications.
2. **A2 (PatientInsurance lookup + claim API verify) must ship before** B1/B5.
3. **B6 (Clinical unification complete) must ship before** D1 (portal AVS delivery).

**Everything else is independent.** W3's C4 (testing) and W2's D8 (testing) can start immediately in parallel with W1.

---

## 5. Revised Execution Order

### If one engineer / one session (sequential):

1. **A1 → A2** (shared infra, ~3-5 days)
2. **B1 → B2 → B3 → B4 → B5 → B6** (clinical unification, ~3-4 weeks) — the main build
3. **D8 → D4 → D3 → D2 → D1** (portal gap closure, ~2-3 weeks) — D1 last because it needs B6
4. **C4 → C1** (RCM testing + 276/277, ~1-2 weeks) — testing first, then the one medium-priority feature

**Total: ~6-9 weeks sequential** (down from 12-17 weeks pre-audit).

### If three engineers / three parallel sessions:

- **Engineer 1:** A1 → A2 → B1 → B2 → B3 → B4 → B5 → B6 (the big build)
- **Engineer 2:** C4 (testing immediately) → C1 (276/277) → (C2/C3 if requested)
- **Engineer 3:** D8 (testing immediately) → D4 → D3 → D2 → (wait for A1) → (wait for B6) → D1 → D5/D6/D7

**Total: ~4-5 weeks parallel** (down from 6-8 weeks pre-audit).

---

## 6. Feature Flag Strategy (Unchanged)

| Flag | Scope | Default | Rollout |
|---|---|---|---|
| `FEATURE_UNIFIED_DOCUMENTATION` | W1 — new Documentation tab in encounter editor | Off | Enable per tenant after B6 |
| `FEATURE_REVENUE_CYCLE_V2` | W3 — only needed if C1/C2/C3 add new UI | Off | Enable per tenant after C1 (if built) |
| `FEATURE_PATIENT_PORTAL_V2` | W2 — only needed for new features (AVS, notifications, telehealth, consent, check-in) | Off | Enable per tenant after D1-D3 |

**Note:** Since W2 and W3 are already ~85-90% built and their existing features are already live without a flag, the flags only gate the **new** gap-closure features, not the existing ones.

---

## 7. Success Criteria (Revised)

### W1 — Clinical Note-Taking Unification (unchanged)
- Provider can record audio, transcribe, generate SOAP, edit, view quality/evidence/payer-prompts/action-drafts, sign — all from `/clinical/encounters/:id`
- Documentation session is resumable; version history viewable; three intelligence services exposed in UI; "Submit Claim Directly" works

### W2 — Patient Portal Gap Closure (revised — most is already done)
- After-visit summaries delivered to patient portal (reads from W1's signed documentation session)
- Notifications fire for appointments, refills, lab results, messages
- Telehealth video visits work from portal (backend generates session tokens)
- Consent management API works (entity already exists)
- **Existing features verified working via D8 testing**: login, self-scheduling, messaging, bill pay, AI features, EOB viewing

### W3 — EOB/ERA/Denials Gap Closure (revised — most is already done)
- Claim status inquiry (276/277) works via Stedi (if C1 is built)
- **Existing features verified working via C4 testing**: ERA 835 import, auto-payment posting, denial generation, CARC/RARC mapping, appeal letter generation, underpayment detection, analytics dashboard, agentic pipeline

---

## 8. Next Action

**The audits are complete. The gap docs are updated. The master plan is revised.**

Recommended next steps, in priority order:

1. **Start Track A** (Notifications module + PatientInsurance lookup + claim API verify) — ~3-5 days
2. **Start W1 (Track B)** in parallel — this is the largest remaining build and has a detailed spec ready (`CLINICAL-NOTE-TAKING-UNIFICATION-SPEC.md`)
3. **Start W2 testing (D8) and W3 testing (C4) immediately** — these validate existing implementations and can run in parallel with everything else, no dependencies
4. **After B6 ships**, build D1 (portal AVS delivery)
5. **Build D4 (consent service) and D3 (telehealth backend)** — quick wins that close real gaps
6. **Defer C2 (contract NLP) and C3 (voice AI)** unless explicitly requested — large effort, low ROI vs. W1

---

## 9. Document Inventory (Updated)

| Document | Status | Action |
|---|---|---|
| `CLINICAL-NOTE-TAKING-ANALYSIS.md` | Current (July 19) | No action — analysis doc |
| `CLINICAL-NOTE-TAKING-UNIFICATION-SPEC.md` | Current (July 19) | Implementation spec for W1 — ready to build |
| `PATIENT-PORTAL-GAP-ANALYSIS.md` | **Updated July 19** with §0 audit results | Original analysis outdated; §0 is accurate |
| `EOB-ERA-DENIAL-GAP-ANALYSIS.md` | **Updated July 19** with §0 audit results | Original analysis outdated; §0 is accurate |
| `ARCHITECTURE.md` | Reference | No action |
| `FREE-TRIAL-ARCHITECTURE.md` | Reference | No action |
| `PRICING-STRATEGY.md` | Reference | No action |
| `CLINICAL-NOTE-TAKING-MASTER-PLAN.md` (this doc) | **Revised July 19** post-audit | Current sequencing plan |
