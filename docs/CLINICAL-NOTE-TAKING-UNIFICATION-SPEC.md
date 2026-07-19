# Spec: Unify Note-Making Surfaces & Wire Up Documentation Intelligence

## Date: July 2026
## Status: Draft — implementation spec for Item #0 (prerequisite to the 7-feature roadmap)
## Scope: Backend consolidation + frontend unification + exposure of 3 dark intelligence services

---

## 0. Problem Statement

Neuraline currently has **two parallel, disconnected note-making surfaces** that do not share state, plus **three backend intelligence services** with no frontend exposure:

### 0.1 The Two Surfaces

| Surface | Route | Writes To | Has Audio? | Has Versioning? | Has Structured Chart? |
|---|---|---|---|---|---|
| AI-Assisted Encounter wizard | `/ai-encounter` | `DocumentationSession` → `Encounter.soapNote` (via `applyToEncounter`) | ✅ | ✅ `DocumentationNoteVersion` | ❌ |
| Encounter editor | `/clinical/encounters/new` and `/clinical/encounters/:id` | `Encounter` directly | ❌ | ❌ | ✅ vitals, diagnoses, meds, orders, allergies |

**Symptoms of the split:**
- A provider who starts in the AI wizard cannot continue in the encounter editor (and vice versa).
- The AI wizard creates `DocumentationSession` rows; the encounter editor never reads them.
- After leaving the AI wizard, the documentation session is orphaned — there is no list view, no resume, no way to view its version history.
- The encounter editor has no audio/transcript path; a provider who wants to dictate must abandon the encounter and start over in the wizard.
- `applyToEncounter` writes the SOAP into `Encounter.soapNote` but the encounter editor's "AI Assist" button calls a **different** endpoint (`/ai/generate-soap`) that does not create a `DocumentationSession` or version history.

### 0.2 The Three Dark Services

| Service | Backend Endpoint | Computes | Frontend Exposure |
|---|---|---|---|
| `DocumentationIntelligenceService` | `GET /clinical/documentation/sessions/:id/evidence`, `GET .../quality`, `GET .../previsit/:patientId/:providerId`, `GET/PATCH .../preferences/:providerId` | Evidence linking (note section → transcript utterance + match score), quality score (0–100 with critical/warning findings), pre-visit chart summary, per-provider documentation preferences | ❌ None |
| `DocumentationActionsService` | `POST/GET /clinical/documentation/sessions/:id/action-drafts`, `PATCH /clinical/documentation/action-drafts/:id/review` | AI drafts: orders (lab/imaging/referral/procedure), diagnoses (ICD), procedures (CPT), CDI prompts, prior-auth recommendations, after-visit summary. Review workflow `PENDING → ACCEPTED/DISMISSED` | ❌ None |
| `DocumentationRevenueService` | `GET /clinical/documentation/revenue-risk/payer/:payerName`, `GET .../sessions/:id/appeal-evidence/:denialId` | Per-payer denial/underpayment risk + documentation prompts keyed to root causes; appeal evidence bundling | ❌ None |

### 0.3 Other Gaps Addressed by This Spec

- "Submit Claim Directly" button in the AI wizard has no `onClick` handler.
- No documentation session list view.
- No note version history UI (backend stores versions, frontend never shows them).
- No way to resume an in-progress documentation session.

---

## 1. Goals & Non-Goals

### 1.1 Goals

1. **One unified note-making surface** that supports both audio-driven and form-driven workflows, with the documentation session as the single source of truth for note content, versioning, and audit.
2. **Bidirectional sync** between `DocumentationSession.soapNote` and `Encounter.soapNote` so either surface can edit and the other reflects changes.
3. **Expose the three intelligence services** in the unified surface: evidence links, quality score, action drafts, payer-risk prompts, pre-visit summary, provider preferences.
4. **Resume + list views** for documentation sessions.
5. **Version history UI** for notes.
6. **Wire the "Submit Claim Directly" button** to the existing claims/superbills flow.

### 1.2 Non-Goals (Deferred to the 7-Feature Roadmap)

- Ambient real-time streaming capture (Phase C, item #1)
- Co-signing / supervision workflow (Phase B, item #3)
- Note amendments after signing (Phase B, item #4)
- DAP/BIRP formats (Phase B, item #5)
- Specialty template seeding (Phase B, item #5)
- Chart-context-aware note generation prompt change (Phase A, item #2) — though this spec prepares the wiring for it

---

## 2. Architecture Decisions

### 2.1 Documentation Session as the Single Source of Truth

**Decision:** The `DocumentationSession` becomes the canonical owner of the note during the documentation lifecycle. The `Encounter.soapNote` is a **projection** that is updated whenever the session is saved, applied, or signed.

**Rationale:**
- The session already carries consent, transcript, version history, evidence, quality score, and audit trail. The encounter does not.
- Keeping the session as the source of truth preserves the audit/versioning guarantees that already exist.
- The encounter remains the canonical owner of structured clinical data (vitals, diagnoses, meds, orders, allergies) — those continue to be edited directly on the encounter.

**Consequence:** The encounter editor's "AI Assist" button must be changed to create/reuse a documentation session rather than calling `/ai/generate-soap` directly. The standalone `/ai/generate-soap` endpoint is deprecated (kept for backward compat for one release).

### 2.2 One Session Per Encounter (With Resumption)

**Decision:** A `DocumentationSession` is linked 1:1 with an `Encounter` via `encounterId`. If a session already exists for an encounter, the UI resumes it rather than creating a new one.

**Schema change required:** Add a unique partial index:
```sql
CREATE UNIQUE INDEX documentation_sessions_encounter_id_unique
  ON documentation_sessions (tenant_id, encounter_id)
  WHERE encounter_id IS NOT NULL AND status IN ('draft', 'transcribed', 'note_generated', 'reviewed');
```
This allows multiple historical sessions (signed/cancelled) per encounter but only one **active** session.

### 2.3 Encounter Editor Becomes the Primary Surface

**Decision:** The encounter editor (`/clinical/encounters/:id`) becomes the primary note-making surface. The AI wizard (`/ai-encounter`) is **not deleted** but is reframed as a "Quick Start" entry point that creates an encounter + session and then redirects to the encounter editor.

**Rationale:**
- The encounter editor already has the structured chart (vitals, diagnoses, meds, orders, allergies) — the wizard does not.
- Providers charting in a real encounter need both the note and the structured data in one place.
- The wizard's linear 5-step flow is too rigid for real workflows where a provider switches between dictation, structured entry, and review.

**Migration path:**
- `/ai-encounter` continues to work for one release.
- After the wizard creates a session, it redirects to `/clinical/encounters/:encounterId?tab=documentation`.
- A deprecation banner is shown on `/ai-encounter` pointing to the new flow.
- The wizard is removed in the release after next.

### 2.4 New "Documentation" Tab in Encounter Editor

**Decision:** The encounter editor gains a `Tabs` component with two tabs:
- **Chart** (existing form: vitals, diagnoses, meds, orders, allergies, treatment plan, attachments, audit trail)
- **Documentation** (new: audio/transcript, SOAP note, version history, evidence, quality, action drafts, payer prompts)

The SOAP note fields move from the Chart tab to the Documentation tab. The Chart tab's SOAP section is replaced with a read-only preview that links to the Documentation tab.

### 2.5 Backend: New `DocumentationSessionService` Methods

Add methods to `DocumentationService`:
- `findOrCreateForEncounter(tenantId, actor, encounterId)` — resumes an active session or creates one linked to the encounter
- `listForTenant(tenantId, filters)` — paginated list of sessions for a list view
- `getWithIntelligence(tenantId, sessionId)` — returns the session + evidence + quality + action drafts + payer prompts in one payload (avoids 5 round-trips from the frontend)

---

## 3. Backend Changes

### 3.1 Schema Migrations

#### Migration 1: `AddDocumentationSessionEncounterUniqueIndex`

```sql
CREATE UNIQUE INDEX documentation_sessions_encounter_active_unique
  ON documentation_sessions (tenant_id, encounter_id)
  WHERE encounter_id IS NOT NULL
    AND status IN ('draft', 'transcribed', 'note_generated', 'reviewed');
```

No new columns — `encounterId` already exists on `DocumentationSession`.

#### Migration 2: `AddEncounterDocumentationSessionIdColumn` (optional, for reverse lookup)

Add `documentation_session_id` to `encounters` table (nullable uuid, indexed) so the encounter editor can find the active session without a separate query.

```sql
ALTER TABLE encounters ADD COLUMN documentation_session_id uuid;
CREATE INDEX encounters_documentation_session_id_idx ON encounters (documentation_session_id);
```

Update `DocumentationService.applyToEncounter` and `sign` to write `documentation_session_id` back to the encounter.

### 3.2 `DocumentationService` New Methods

```typescript
// documentation.service.ts (additions)

async findOrCreateForEncounter(
  tenantId: string,
  actor: DocumentationActor,
  encounterId: string,
): Promise<DocumentationSession> {
  const encounter = await this.encounterService.findOne(encounterId, tenantId);

  // Look for an active session linked to this encounter
  const existing = await this.sessionRepository.findOne({
    where: {
      tenantId,
      encounterId,
      status: In([
        DocumentationSessionStatus.DRAFT,
        DocumentationSessionStatus.TRANSCRIBED,
        DocumentationSessionStatus.NOTE_GENERATED,
        DocumentationSessionStatus.REVIEWED,
      ]),
    },
  });
  if (existing) return existing;

  // Create a new session linked to the encounter
  const session = this.sessionRepository.create({
    tenantId,
    encounterId,
    patientId: encounter.patientId,
    providerId: encounter.providerId,
    consentStatus: DocumentationConsentStatus.GRANTED, // encounter already exists; consent assumed for in-visit dictation
    consentCapturedBy: actor.id,
    consentCapturedAt: new Date(),
    consentMethod: 'encounter_resume',
    transcriptUtterances: [],
    soapNote: encounter.soapNote || {}, // seed from encounter's existing SOAP
    metadata: {},
  });
  const saved = await this.sessionRepository.save(session);

  // Write the session id back to the encounter
  await this.encounterService.update(encounterId, { documentationSessionId: saved.id } as any, tenantId);

  await this.audit(actor, tenantId, saved.id, 'DOCUMENTATION_SESSION_RESUMED_OR_CREATED', { encounterId });
  return saved;
}

async listForTenant(
  tenantId: string,
  filters: {
    patientId?: string;
    providerId?: string;
    status?: DocumentationSessionStatus;
    encounterId?: string;
    page?: number;
    limit?: number;
  },
): Promise<{ data: DocumentationSession[]; total: number; page: number; limit: number }> {
  const where: FindOptionsWhere<DocumentationSession> = { tenantId };
  if (filters.patientId) where.patientId = filters.patientId;
  if (filters.providerId) where.providerId = filters.providerId;
  if (filters.status) where.status = filters.status;
  if (filters.encounterId) where.encounterId = filters.encounterId;

  const [data, total] = await this.sessionRepository.findAndCount({
    where,
    order: { createdAt: 'DESC' },
    skip: ((filters.page || 1) - 1) * (filters.limit || 20),
    take: filters.limit || 20,
  });
  return { data, total, page: filters.page || 1, limit: filters.limit || 20 };
}

async getWithIntelligence(
  tenantId: string,
  sessionId: string,
): Promise<{
  session: DocumentationSession;
  evidence: DocumentationEvidence[];
  quality: { score: number; findings: Array<{ severity: string; section: string; message: string }> };
  actionDrafts: DocumentationSuggestion[];
  payerPrompts: Array<{ payerName: string; prompts: string[]; denialCount: number; unresolvedDeniedAmount: number }>;
}> {
  const session = await this.findOne(tenantId, sessionId);
  const [evidence, quality, actionDrafts] = await Promise.all([
    this.intelligenceService.getEvidence(tenantId, sessionId),
    this.intelligenceService.qualityCheck(tenantId, sessionId),
    this.actionsService.list(tenantId, sessionId),
  ]);

  // Payer prompts: look up the patient's active insurance payers and fetch risk for each
  const payerPrompts: Array<{ payerName: string; prompts: string[]; denialCount: number; unresolvedDeniedAmount: number }> = [];
  // Implementation: query PatientInsurance for the session's patientId, then call revenueService.payerRisk for each unique payerName
  // (Detailed in §3.4)

  return { session, evidence, quality, actionDrafts, payerPrompts };
}
```

### 3.3 Controller Changes

#### `DocumentationController` — new endpoints

```typescript
// documentation.controller.ts (additions)

@Get('sessions')
@Roles('admin', 'doctor', 'nurse')
list(
  @Query() query: { patientId?: string; providerId?: string; status?: string; encounterId?: string; page?: string; limit?: string },
  @Request() req: AuthenticatedRequest,
) {
  return this.documentationService.listForTenant(req.user.tenantId, {
    patientId: query.patientId,
    providerId: query.providerId,
    status: query.status as DocumentationSessionStatus,
    encounterId: query.encounterId,
    page: query.page ? Number(query.page) : 1,
    limit: query.limit ? Number(query.limit) : 20,
  });
}

@Post('encounters/:encounterId/resume')
@Roles('admin', 'doctor', 'nurse')
findOrCreateForEncounter(
  @Param('encounterId') encounterId: string,
  @Request() req: AuthenticatedRequest,
) {
  return this.documentationService.findOrCreateForEncounter(req.user.tenantId, req.user, encounterId);
}

@Get('sessions/:id/intelligence')
@Roles('admin', 'doctor', 'nurse')
getWithIntelligence(
  @Param('id') id: string,
  @Request() req: AuthenticatedRequest,
) {
  return this.documentationService.getWithIntelligence(req.user.tenantId, id);
}
```

#### `EncounterController` — extend update to sync SOAP back to session

When `EncounterService.update` is called with a `soapNote` change AND the encounter has a `documentationSessionId`, also update the session's `soapNote` and create a `CLINICIAN_EDITED` version. This keeps the two surfaces in sync when the provider edits SOAP from the Chart tab (or anywhere else).

```typescript
// encounter.service.ts (modify update)

async update(id: string, dto: UpdateEncounterDto, tenantId: string): Promise<Encounter> {
  const encounter = await this.findOne(id, tenantId);
  // ... existing update logic ...
  const saved = await this.encounterRepository.save(encounter);

  // Sync SOAP back to documentation session if present
  if (dto.soapNote && encounter.documentationSessionId) {
    await this.documentationService.syncFromEncounter(tenantId, encounter.documentationSessionId, dto.soapNote);
  }

  return saved;
}
```

```typescript
// documentation.service.ts (new method)

async syncFromEncounter(
  tenantId: string,
  sessionId: string,
  soapNote: DocumentationSoapNote,
  actor?: DocumentationActor,
): Promise<void> {
  const session = await this.findOne(tenantId, sessionId);
  if (session.status === DocumentationSessionStatus.SIGNED || session.status === DocumentationSessionStatus.CANCELLED) return;
  const changed = JSON.stringify(session.soapNote) !== JSON.stringify(soapNote);
  if (!changed) return;
  session.soapNote = soapNote;
  await this.sessionRepository.save(session);
  await this.createVersion(session, DocumentationNoteVersionSource.CLINICIAN_EDITED, actor?.id || 'system');
}
```

### 3.4 Payer Prompts Aggregation

`getWithIntelligence` needs the patient's active insurance payers to fetch per-payer risk. Add a method that:

1. Queries `PatientInsurance` for the session's `patientId` (active, non-deleted).
2. Extracts unique payer names.
3. Calls `DocumentationRevenueService.payerRisk` for each.
4. Returns the prompts array.

```typescript
// documentation.service.ts (private helper)

private async collectPayerPrompts(tenantId: string, patientId: string): Promise<Array<{ payerName: string; prompts: string[]; denialCount: number; unresolvedDeniedAmount: number }>> {
  // Inject PatientInsuranceRepository in constructor
  const insurances = await this.patientInsuranceRepository.find({
    where: { tenantId, patientId, deletedAt: IsNull() },
    relations: ['payer'],
  });
  const payerNames = [...new Set(insurances.map((i) => i.payer?.name).filter(Boolean))] as string[];
  const results = await Promise.all(
    payerNames.map((payerName) => this.revenueService.payerRisk(tenantId, payerName)),
  );
  return results.map((risk) => ({
    payerName: risk.payerName,
    prompts: risk.documentationPrompts,
    denialCount: risk.denialCount,
    unresolvedDeniedAmount: risk.unresolvedDeniedAmount,
  }));
}
```

**Module wiring:** `ClinicalModule` must import `BillingModule` (or specifically the `PatientInsurance` repository). Check for circular dependency — if circular, expose a thin `PatientInsuranceLookupService` from `BillingModule` and inject it.

### 3.5 Deprecate `/ai/generate-soap`

Keep the endpoint for one release. Add a `@Deprecated` JSDoc comment and a log warning. The encounter editor's "AI Assist" button will be changed to call `documentationService.generateNote` (which already exists and uses `AiService.generateStructured` with the strict no-hallucination prompt — better than `/ai/generate-soap` which has a different, less-strict prompt).

### 3.6 Submit Claim Directly Wiring

The AI wizard's "Submit Claim Directly" button should call the existing billing/claims endpoint to create an `EncounterClaim` from the encounter. Concretely:

```typescript
// AiEncounterPage.tsx — replace the no-op button
const handleSubmitClaim = async () => {
  if (!documentationSession?.encounterId) {
    message.warning('Apply the note to an encounter before submitting a claim.');
    return;
  }
  setLoading(true);
  try {
    const res = await billingService.createClaim({ encounterId: documentationSession.encounterId });
    message.success('Claim created. Redirecting to claim detail...');
    navigate(`/billing/claims/${res.data.id}`);
  } catch (err: any) {
    message.error(err?.response?.data?.message || 'Failed to create claim');
  } finally {
    setLoading(false);
  }
};
```

Verify `billingService.createClaim` exists; if not, add a thin wrapper to `POST /api/v1/billing/claims` with `{ encounterId }`.

---

## 4. Frontend Changes

### 4.1 New Service: `documentationService.ts` Extensions

Add the new endpoints to the existing `documentationService`:

```typescript
// frontend/src/services/documentationService.ts (additions)

export interface DocumentationEvidence {
  id: string;
  noteSection: 'subjective' | 'objective' | 'assessment' | 'plan';
  noteText: string;
  speakerLabel: string | null;
  transcriptStartMs: number | null;
  transcriptEndMs: number | null;
  sourceText: string;
  matchScore: number;
}

export interface DocumentationQualityFinding {
  severity: 'critical' | 'warning';
  section: string;
  message: string;
}

export interface DocumentationQuality {
  score: number;
  findings: DocumentationQualityFinding[];
}

export interface DocumentationSuggestion {
  id: string;
  kind: 'order' | 'coding' | 'cdi' | 'prior_auth' | 'after_visit_summary';
  payload: Record<string, unknown>;
  status: 'pending' | 'accepted' | 'dismissed';
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface PayerPrompt {
  payerName: string;
  prompts: string[];
  denialCount: number;
  unresolvedDeniedAmount: number;
}

export interface DocumentationNoteVersion {
  id: string;
  versionNumber: number;
  source: 'ai_generated' | 'clinician_edited' | 'signed';
  soapNote: DocumentationSoapNote;
  createdBy: string;
  aiModel: string | null;
  createdAt: string;
}

export interface DocumentationIntelligenceBundle {
  session: DocumentationSession;
  evidence: DocumentationEvidence[];
  quality: DocumentationQuality;
  actionDrafts: DocumentationSuggestion[];
  payerPrompts: PayerPrompt[];
}

export const documentationService = {
  // ... existing methods ...

  list: (params?: { patientId?: string; providerId?: string; status?: string; encounterId?: string; page?: number; limit?: number }) =>
    api.get<{ data: DocumentationSession[]; total: number; page: number; limit: number }>('/clinical/documentation/sessions', { params }),

  findOrCreateForEncounter: (encounterId: string) =>
    api.post<DocumentationSession>(`/clinical/documentation/encounters/${encounterId}/resume`),

  getWithIntelligence: (sessionId: string) =>
    api.get<DocumentationIntelligenceBundle>(`/clinical/documentation/sessions/${sessionId}/intelligence`),

  getVersions: (sessionId: string) =>
    api.get<DocumentationNoteVersion[]>(`/clinical/documentation/sessions/${sessionId}/versions`),

  buildEvidence: (sessionId: string) =>
    api.post<DocumentationEvidence[]>(`/clinical/documentation/sessions/${sessionId}/evidence`),

  generateActionDrafts: (sessionId: string) =>
    api.post<DocumentationSuggestion[]>(`/clinical/documentation/sessions/${sessionId}/action-drafts`),

  reviewActionDraft: (draftId: string, status: 'accepted' | 'dismissed') =>
    api.patch<DocumentationSuggestion>(`/clinical/documentation/action-drafts/${draftId}/review`, { status }),

  getPreference: (providerId: string) =>
    api.get<DocumentationPreference | null>(`/clinical/documentation/preferences/${providerId}`),

  savePreference: (providerId: string, data: Partial<DocumentationPreference>) =>
    api.patch<DocumentationPreference>(`/clinical/documentation/preferences/${providerId}`, data),

  prepareChart: (patientId: string, providerId: string) =>
    api.get<{ summary: string; encounters: Array<{ id: string; startTime: string; chiefComplaint: string | null }> }>(
      `/clinical/documentation/previsit/${patientId}/${providerId}`,
    ),
};
```

### 4.2 New Components

#### 4.2.1 `DocumentationPanel` (the new Documentation tab content)

**Location:** `frontend/src/components/clinical/DocumentationPanel.tsx`

**Props:**
```typescript
interface DocumentationPanelProps {
  encounterId: string;
  patientId: string;
  providerId: string;
  encounterStatus: Encounter['status'];
  onSoapChange: (soap: DocumentationSoapNote) => void; // bubbles up to keep Chart tab preview in sync
}
```

**Layout (top to bottom):**

1. **Session status banner** — shows current `DocumentationSession.status` with a colored tag and the next allowed action. If no session exists, a "Start Documentation" button calls `findOrCreateForEncounter`.

2. **Pre-Visit Summary card** (collapsible) — fetched on mount via `prepareChart(patientId, providerId)`. Shows the AI-generated summary of the last 5 encounters. "Refresh" button re-fetches.

3. **Audio + Transcript section** (collapsible, hidden if no audio path is desired):
   - `AudioRecorder` component (reuse from AI wizard)
   - "Transcribe" button → `documentationService.transcribe`
   - Transcript textarea (editable) → `documentationService.saveTranscript`
   - "Generate SOAP from Transcript" button → `documentationService.generateNote`
   - Consent status display + "Re-capture consent" link if `pending`

4. **SOAP Note editor** — 4 textareas (Subjective / Objective / Assessment / Plan). On blur or debounced (1.5s), calls `documentationService.updateNote`. Each section has an **evidence popover** (info icon) that shows the linked transcript utterance + match score (from `evidence` array).

5. **Quality Score card** — circular progress (reuse `Progress` from antd) showing `quality.score`. Below: list of findings with severity icons. "Re-check Quality" button re-fetches. If score < 70, show a warning banner.

6. **Payer Documentation Prompts card** — for each entry in `payerPrompts`, show the payer name, denial count, unresolved amount, and the list of prompt strings as callout alerts. Example: "Aetna — 12 denials, $4,200 unresolved. Prompts: Confirm authorization number is documented..."

7. **AI Action Drafts card** — grouped by `kind`:
   - **Orders** (lab/imaging/referral/procedure): table with name, reason, priority. "Accept" creates the order in `Encounter.orders`; "Dismiss" calls `reviewActionDraft(id, 'dismissed')`.
   - **Coding** (diagnoses + procedures): table with code, description, rationale. "Accept" adds to `Encounter.diagnoses` or treatment plan procedures; "Dismiss" dismisses.
   - **CDI Prompts**: list of `{ message, section }` shown as inline alerts above the relevant SOAP textarea.
   - **Prior Auth**: card showing `recommended`, `rationale`, `requiredEvidence[]`. If recommended, show a "Start Prior Auth" button (wires to eligibility module — out of scope for this spec, just log a TODO).
   - **After-Visit Summary**: card showing `summary`, `followUp`, `warnings[]`. "Send to Patient Portal" button (wires to item #7 in the roadmap — for this spec, just display the content).

8. **Version History drawer** — opened by a "History" button in the SOAP section header. Shows timeline of versions with source tag (AI / Edited / Signed), author, timestamp, and a diff view (render old vs new SOAP side by side). "Restore this version" button copies the old SOAP into the editor (does not delete newer versions — creates a new version on next save).

**Behavior on encounter status:**
- `scheduled` / `in_progress`: full edit access
- `completed`: read-only except for "Sign" button
- `signed` / `locked`: read-only, "History" button still works, no edit

#### 4.2.2 `DocumentationSessionListPage`

**Location:** `frontend/src/pages/clinical/DocumentationSessionListPage.tsx`
**Route:** `/clinical/documentation-sessions`

A paginated table of documentation sessions with columns:
- Patient name (resolved via patient map)
- Provider name
- Encounter link (clickable → `/clinical/encounters/:encounterId?tab=documentation`)
- Status tag
- Consent status tag
- Created at
- Signed at (if signed)
- Actions: "Resume" (if active), "View" (if signed)

Filters: patient, provider, status, date range.

**Sidebar entry:** Add to `MainLayout.tsx` under Clinical: "Documentation Sessions".

#### 4.2.3 `DocumentationPreferencesModal`

**Location:** `frontend/src/components/clinical/DocumentationPreferencesModal.tsx`

A modal opened from a "Preferences" button in the Documentation tab header. Fields:
- Preferred language (select)
- Note style (concise / detailed / narrative)
- Required sections (multi-select: subjective / objective / assessment / plan + custom)
- Do-not-infer list (multi-select: diagnoses / medications / vitals / orders / procedures)
- Custom instructions (textarea)

Saves via `documentationService.savePreference`.

### 4.3 Encounter Editor Changes

#### `EncounterDetailPage.tsx`

1. **Wrap the existing form in a `Tabs` component** with two tabs: "Chart" and "Documentation".

2. **Chart tab:** Remove the SOAP Notes section (Section 3). Replace with a read-only "SOAP Note Preview" card that shows the current SOAP and a "Open in Documentation tab" link.

3. **Documentation tab:** Render `<DocumentationPanel encounterId={encounter.id} patientId={encounter.patientId} providerId={encounter.providerId} encounterStatus={encounter.status} onSoapChange={(soap) => form.setFieldsValue(soap)} />`.

4. **"AI Assist" button:** Change the handler from `aiService.generateSoap` to:
   ```typescript
   const handleAiAssist = async () => {
     const session = await documentationService.findOrCreateForEncounter(encounter.id);
     // If no transcript, prompt the user to either record audio or paste a transcript
     if (!session.data.transcript) {
       message.info('Open the Documentation tab to record audio or paste a transcript, then generate a SOAP note.');
       setActiveTab('documentation');
       return;
     }
     const updated = await documentationService.generateNote(session.data.id);
     form.setFieldsValue(updated.data.soapNote);
     message.success('AI-generated SOAP note applied. Review in the Documentation tab.');
   };
   ```

5. **URL tab param:** Read `?tab=documentation` from the URL on mount and set the active tab accordingly (so the AI wizard redirect and the session list "Resume" link land on the right tab).

#### `NewEncounterPage.tsx`

Same changes as `EncounterDetailPage` — wrap in Tabs, move SOAP to Documentation tab, change AI Assist handler.

### 4.4 AI Wizard Changes (`AiEncounterPage.tsx`)

1. **After `handleStartEncounter` succeeds**, redirect to the encounter editor:
   ```typescript
   if (response.data.encounterId) {
     navigate(`/clinical/encounters/${response.data.encounterId}?tab=documentation`);
     return;
   }
   ```
   Keep the wizard's current step UI as a fallback for one release, but the primary flow becomes redirect-on-start.

2. **Add a deprecation banner** at the top: "This wizard is being replaced by the unified encounter editor. After starting, you'll be redirected to the new Documentation tab."

3. **Wire "Submit Claim Directly"** as described in §3.6.

### 4.5 Route + Sidebar Changes

```typescript
// routes/index.tsx (addition)
{
  path: "/clinical/documentation-sessions",
  element: (
    <LazyPage>
      <DocumentationSessionListPage />
    </LazyPage>
  ),
},
```

```typescript
// MainLayout.tsx (addition to Clinical submenu)
{ key: '/clinical/documentation-sessions', icon: <FileTextOutlined />, label: 'Documentation Sessions' },
```

---

## 5. Data Flow Diagrams

### 5.1 Resuming a Documentation Session

```
Provider opens /clinical/encounters/:id?tab=documentation
  → EncounterDetailPage fetches encounter
  → DocumentationPanel mounts
  → documentationService.findOrCreateForEncounter(encounterId)
    → Backend: find active session for encounter
      → If found: return it
      → If not: create new session, seed soapNote from encounter.soapNote, write documentationSessionId back to encounter
  → documentationService.getWithIntelligence(sessionId)
    → Backend: parallel fetch of evidence, quality, action drafts, payer prompts
  → Render panel with all data
```

### 5.2 Editing SOAP from the Documentation Tab

```
Provider edits Subjective textarea
  → Debounced 1.5s
  → documentationService.updateNote(sessionId, { subjective: newValue })
    → Backend: update session.soapNote, create CLINICIAN_EDITED version, audit log
  → onSoapChange callback fires
  → EncounterDetailPage form.setFieldsValue({ subjective: newValue })
  → Chart tab SOAP preview updates
```

### 5.3 Editing SOAP from the Chart Tab (Legacy Path)

```
Provider edits SOAP in Chart tab (if any inline edit remains)
  → encounterService.update(encounterId, { soapNote: newSoap })
    → Backend: update encounter.soapNote
    → Backend: documentationService.syncFromEncounter(sessionId, newSoap)
      → Update session.soapNote, create CLINICIAN_EDITED version
  → Documentation tab reflects updated SOAP on next render
```

### 5.4 Accepting an Action Draft

```
Provider clicks "Accept" on a lab order draft
  → documentationService.reviewActionDraft(draftId, 'accepted')
    → Backend: mark suggestion ACCEPTED, set reviewedBy + reviewedAt
  → Frontend: add the order to Encounter.orders via encounterService.update
  → Frontend: remove the draft from the pending list
```

---

## 6. Testing Plan

### 6.1 Backend Unit Tests

- `DocumentationService.findOrCreateForEncounter`
  - Returns existing active session when one exists
  - Creates new session when none exists, seeds SOAP from encounter
  - Writes `documentationSessionId` back to encounter
  - Throws `NotFoundException` if encounter doesn't exist
- `DocumentationService.syncFromEncounter`
  - Updates session SOAP and creates a version
  - No-ops if session is signed/cancelled
  - No-ops if SOAP is unchanged
- `DocumentationService.getWithIntelligence`
  - Returns all four bundles in one call
  - Handles missing evidence/quality gracefully (empty arrays, default score)
  - Payer prompts aggregation handles patient with no insurance (empty array)
- `DocumentationService.listForTenant`
  - Filters by patient, provider, status, encounter
  - Paginates correctly

### 6.2 Backend Integration Tests

- Create encounter → resume session → transcribe → generate note → edit note → sign → verify encounter.soapNote matches session.soapNote
- Create encounter → edit SOAP from encounter update → verify session.soapNote syncs and a CLINICIAN_EDITED version is created
- Create encounter with patient insurance → resume session → getWithIntelligence → verify payer prompts include the patient's payer

### 6.3 Frontend Component Tests

- `DocumentationPanel`
  - Renders session status banner correctly for each status
  - Renders quality score with findings
  - Renders evidence popovers on SOAP textareas
  - Accept/dismiss action drafts calls the right endpoints
  - Read-only mode when encounter is signed/locked
- `DocumentationSessionListPage`
  - Renders table with correct columns
  - Filters work
  - "Resume" navigates to encounter editor with `?tab=documentation`

### 6.4 E2E Test (Manual)

1. Start a new encounter from `/clinical/encounters/new`
2. Switch to Documentation tab
3. Record audio, transcribe, generate SOAP
4. Edit SOAP, verify version history shows AI + edited versions
5. View quality score, verify findings update after edit
6. View payer prompts (if patient has insurance)
7. Generate action drafts, accept a lab order, verify it appears in Chart tab orders
8. Sign the encounter
9. Verify SOAP is read-only, version history still accessible
10. Navigate to `/clinical/documentation-sessions`, verify the session appears as signed

---

## 7. Migration & Rollout

### 7.1 Backward Compatibility

- The `/ai/generate-soap` endpoint is kept for one release. Frontend stops calling it.
- The `/ai-encounter` route is kept for one release with a deprecation banner.
- Existing `DocumentationSession` rows are unchanged; the new unique index only affects new active sessions.
- Existing encounters without `documentationSessionId` continue to work; the column is nullable and populated lazily on first resume.

### 7.2 Rollout Sequence

1. **Backend first:** migrations + new service methods + new controller endpoints. No frontend changes yet. Existing flows continue to work.
2. **Frontend service layer:** extend `documentationService.ts` with new methods. No UI changes yet.
3. **Frontend `DocumentationPanel` component:** build in isolation with storybook-style test harness.
4. **Frontend encounter editor integration:** add Tabs, move SOAP, wire AI Assist to new flow.
5. **Frontend AI wizard redirect:** change `handleStartEncounter` to redirect.
6. **Frontend session list page + sidebar entry.**
7. **Deprecation banner on `/ai-encounter`.**
8. **Next release:** remove `/ai-encounter` route and `/ai/generate-soap` endpoint.

### 7.3 Feature Flag

Gate the new Documentation tab behind a `FEATURE_UNIFIED_DOCUMENTATION` env flag (frontend `VITE_FEATURE_UNIFIED_DOCUMENTATION`, backend `FEATURE_UNIFIED_DOCUMENTATION`). If off, the encounter editor shows the old inline SOAP section and the AI wizard works as before. This allows a safe rollout and instant rollback.

---

## 8. File Inventory

### 8.1 New Files

| File | Purpose |
|---|---|
| `backend/src/migrations/AddDocumentationSessionEncounterUniqueIndex.ts` | Unique partial index on active sessions per encounter |
| `backend/src/migrations/AddEncounterDocumentationSessionIdColumn.ts` | `documentation_session_id` column on encounters |
| `frontend/src/components/clinical/DocumentationPanel.tsx` | The new Documentation tab content |
| `frontend/src/components/clinical/DocumentationSessionStatusBanner.tsx` | Status banner sub-component |
| `frontend/src/components/clinical/DocumentationQualityCard.tsx` | Quality score + findings card |
| `frontend/src/components/clinical/DocumentationPayerPromptsCard.tsx` | Payer risk prompts card |
| `frontend/src/components/clinical/DocumentationActionDraftsCard.tsx` | AI action drafts (orders/coding/CDI/prior-auth/AVS) |
| `frontend/src/components/clinical/DocumentationVersionHistoryDrawer.tsx` | Version history timeline + diff |
| `frontend/src/components/clinical/DocumentationPreferencesModal.tsx` | Provider documentation preferences modal |
| `frontend/src/components/clinical/DocumentationEvidencePopover.tsx` | Evidence link popover for SOAP textareas |
| `frontend/src/pages/clinical/DocumentationSessionListPage.tsx` | List page for all documentation sessions |

### 8.2 Modified Files

| File | Changes |
|---|---|
| `backend/src/modules/clinical/documentation.service.ts` | Add `findOrCreateForEncounter`, `listForTenant`, `getWithIntelligence`, `syncFromEncounter`, `collectPayerPrompts` |
| `backend/src/modules/clinical/documentation.controller.ts` | Add `list`, `findOrCreateForEncounter`, `getWithIntelligence` endpoints |
| `backend/src/modules/clinical/encounter.service.ts` | Sync SOAP to session on update; populate `documentationSessionId` on create |
| `backend/src/modules/clinical/clinical.module.ts` | Import `BillingModule` (or expose `PatientInsuranceLookupService`); inject new repositories into `DocumentationService` |
| `backend/src/modules/clinical/entities/encounter.entity.ts` | Add `documentationSessionId` column |
| `frontend/src/services/documentationService.ts` | Add new methods + types |
| `frontend/src/pages/clinical/EncounterDetailPage.tsx` | Wrap in Tabs, move SOAP to Documentation tab, change AI Assist handler, read `?tab=` URL param |
| `frontend/src/pages/clinical/NewEncounterPage.tsx` | Same as EncounterDetailPage |
| `frontend/src/pages/ai-encounter/AiEncounterPage.tsx` | Redirect after session creation, deprecation banner, wire Submit Claim Directly |
| `frontend/src/routes/index.tsx` | Add `/clinical/documentation-sessions` route |
| `frontend/src/layouts/MainLayout.tsx` | Add "Documentation Sessions" sidebar entry |

---

## 9. Open Questions

1. **Circular dependency risk:** `ClinicalModule` needs `PatientInsurance` from `BillingModule`. Does `BillingModule` already import `ClinicalModule` for any reason? If yes, extract a thin `PatientInsuranceLookupService` into a shared module.
2. **`documentationSessionId` on encounter vs. lookup by `encounterId`:** The column on encounter is a convenience for O(1) lookup. Alternatively, always query `DocumentationSession` by `encounterId`. The column adds a small sync burden but simplifies the encounter editor. Recommend keeping the column.
3. **Version history diff rendering:** Plain text diff (line-by-line) or structured per-section diff? Recommend per-section (show old vs new Subjective side by side, etc.) — simpler and more useful for SOAP.
4. **Action draft "Accept" side effects:** When a provider accepts a lab order draft, should it be added to `Encounter.orders.labs` with status `ordered` and `orderedDate = now`? Or should it open a confirmation modal first? Recommend a confirmation modal to avoid accidental orders.
5. **Payer prompts performance:** If a patient has 3 insurance policies, `getWithIntelligence` makes 3 sequential `payerRisk` calls. Each scans the denials + underpayments tables. For tenants with large denial volumes, this could be slow. Consider caching payer risk per tenant+payer for 5 minutes, or computing prompts asynchronously and storing them on the session.

---

## 10. Effort Estimate

| Workstream | Effort |
|---|---|
| Backend migrations + service methods + controller endpoints | Medium |
| Backend encounter sync + payer prompts aggregation | Medium |
| Frontend `documentationService` extensions | Small |
| Frontend `DocumentationPanel` + sub-components | Large (the bulk of the work) |
| Frontend encounter editor Tab integration | Medium |
| Frontend AI wizard redirect + Submit Claim wiring | Small |
| Frontend session list page | Small |
| Testing (unit + integration + e2e) | Medium |
| **Total** | **Large but bounded — no new infrastructure, all wiring + UI** |

---

## 11. Success Criteria

1. A provider can start an encounter, record audio, transcribe, generate a SOAP note, edit it, view quality score, view payer prompts, accept action drafts, and sign — all from one page (`/clinical/encounters/:id`).
2. A provider can leave the encounter editor and return later; the documentation session resumes with all transcript, SOAP, versions, and intelligence intact.
3. The three intelligence services (evidence, quality, action drafts, payer prompts) are visible and interactive in the UI.
4. Note version history is viewable with source tags and per-section diffs.
5. The `/clinical/documentation-sessions` list page shows all sessions with filters and resume/view actions.
6. The AI wizard redirects to the unified surface; the "Submit Claim Directly" button works.
7. No regression in existing encounter editor functionality (vitals, diagnoses, meds, orders, allergies, sign/lock/reopen).
