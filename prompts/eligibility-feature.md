# Insurance Eligibility Verification Feature

Build an enterprise-grade Insurance Eligibility Verification feature for Neuraline EMR (a HIPAA-compliant healthcare platform). Follow existing code conventions, architecture patterns, and security requirements.

## Architecture
- **Frontend**: React + Vite + Ant Design + Zustand + TypeScript
- **Backend**: NestJS + TypeORM + PostgreSQL + class-validator
- **Auth**: JWT Bearer tokens in `sessionStorage`, key `neuraline_token`
- **API base**: `http://localhost:4000/api/v1` (axios instance in `frontend/src/services/api.ts`)
- **DB**: `DB_SYNCHRONIZE=true` for development (auto-creates tables)

## Before Writing Code

**Read these files first** to understand existing patterns (do NOT modify them):

| File | What to learn |
|---|---|
| `backend/src/modules/billing/billing.service.ts` | Service pattern, `findPatientInsurances()` method to reuse |
| `backend/src/modules/billing/billing.controller.ts` | Controller pattern, auth guards, route structure |
| `frontend/src/services/appointmentService.ts` | Frontend API service pattern (class, singleton, methods) |
| `frontend/src/store/dataStore.ts` | Zustand store pattern (async CRUD, loading/error state, API fallback) |
| `frontend/src/pages/appointments/AppointmentPage.tsx` | Table/drawer/modal patterns, Ant Design usage |
| `frontend/src/layouts/MainLayout.tsx` | Sidebar navigation structure |

## Existing Scaffolding (do NOT duplicate)

### Backend
- `PatientInsurance` at `backend/src/modules/billing/entities/patient-insurance.entity.ts` -- policy details, `@ManyToOne` to `InsurancePayer`, fields: `patientId`, `insurancePayerId`, `policyNumber`, `groupNumber`, `subscriberName`, `subscriberRelation`, `subscriberDob`, `subscriberSsn`, `authorizationNumber`, `effectiveDate`, `expirationDate`, `copayAmount`, `deductibleAmount`, `coinsurancePercentage`, `status`
- `InsurancePayer` at `backend/src/modules/billing/entities/insurance-payer.entity.ts` -- payer info: `payerId`, `name`, `payerType`, `address`, `phone`, `email`, `website`, `electronicClaimUrl`, `status`
- `BillingService` -- already has `findAllPayers()`, `findOnePayer(id)`, `findPatientInsurances(patientId)`
- `BillingModule` -- registers entities, exports `BillingService`
- `AppModule` -- imports `BillingModule`

### Frontend
- `EligibilityCheck` type is **imported but missing** from `frontend/src/types/index.ts` -- must be created
- `useEligibilityStore` is scaffolded in `frontend/src/store/dataStore.ts` (lines 580-602) with `checks`, `addCheck`, `updateCheck`, `deleteCheck` -- currently uses empty `mockEligibilityChecks`
- `mockEligibilityChecks: any[] = []` in `frontend/src/data/mockData.ts` (line 3245)
- `/eligibility` route is **commented out** in `frontend/src/routes/index.tsx` (lines 274-281)
- `InsuranceEligibilityPage` lazy import is **commented out** in routes (line 72)
- Settings page has "Insurance Clearinghouse" integration toggle (disabled, Availity) at `frontend/src/pages/settings/SettingsPage.tsx:528`

## What to Build (in order)

### 1. Backend: InsuranceVerification Entity
Create `backend/src/modules/billing/entities/insurance-verification.entity.ts`:
- Table: `insurance_verifications`
- `id` -- UUID PK
- `tenantId` -- `@Column({ type: 'uuid' })`, indexed
- `patientId` -- `@Column({ type: 'uuid' })` (plain column, NO `@ManyToOne` -- avoid TypeORM validation conflicts)
- `patientInsuranceId` -- `@Column({ type: 'uuid' })` (plain column, no relation)
- `verificationStatus` -- `@Column({ type: 'varchar', length: 20, default: 'pending' })`
- `verificationType` -- `@Column({ type: 'varchar', length: 20, default: 'realtime' })`
- `eligibilityData` -- `@Column({ type: 'jsonb', nullable: true })`
- `requestPayload` -- `@Column({ type: 'jsonb', nullable: true })`
- `responsePayload` -- `@Column({ type: 'jsonb', nullable: true })`
- `verifiedAt` -- `@Column({ type: 'timestamptz', nullable: true })`
- `verifiedBy` -- `@Column({ type: 'uuid', nullable: true })`
- `errorMessage` -- `@Column({ type: 'text', nullable: true })`
- `nextVerificationDate` -- `@Column({ type: 'date', nullable: true })`
- `createdAt`, `updatedAt`, `deletedAt` -- standard TypeORM date columns
- Indexes: `@Index(['tenantId', 'patientId'])`, `@Index(['tenantId', 'verificationStatus'])`

### 2. Backend: Eligibility DTOs
Create in `backend/src/modules/billing/dto/`:

**`create-eligibility-check.dto.ts`:**
- `patientId` -- `@IsUUID()`, `@IsNotEmpty()`
- `patientInsuranceId` -- `@IsUUID()`, `@IsNotEmpty()`
- `verificationType` -- `@IsOptional()`, `@IsEnum(['realtime', 'batch', 'manual'])`, default `'realtime'`

**`query-eligibility.dto.ts`:**
- `patientId` -- `@IsOptional()`, `@IsUUID()`
- `status` -- `@IsOptional()`, `@IsString()`
- `startDate` -- `@IsOptional()`, `@IsDateString()`
- `endDate` -- `@IsOptional()`, `@IsDateString()`
- `page` -- `@IsOptional()`, `@Type(() => Number)`, default 1
- `limit` -- `@IsOptional()`, `@Type(() => Number)`, default 20

**`update-eligibility.dto.ts`:**
- Use `PartialType` from `@nestjs/swagger` (like `update-appointment.dto.ts`)
- Fields: `verificationStatus`, `eligibilityData`, `errorMessage` (all optional)

### 3. Backend: Eligibility Service
Create `backend/src/modules/billing/eligibility.service.ts`:

Inject `InsuranceVerification` repository, `PatientInsurance` repository, and `HipaaAuditService`.

Methods:
- **`create(tenantId, dto, userId?)`**: Create record with status `'pending'`, run mock verification, update with results. Log via `HipaaAuditService`.
- **`findAll(tenantId, query)`**: Paginated list with filters (patientId, status, date range). Use `createQueryBuilder`.
- **`findOne(tenantId, id)`**: Single record by ID. `NotFoundException` if missing.
- **`findByPatient(tenantId, patientId)`**: All checks for a patient, ordered by `createdAt DESC`.
- **`requestVerification(tenantId, id, userId)`**: Re-run mock verification for existing record. Log via `HipaaAuditService`.

**Mock verification logic** -- private method `mockVerification(insurance)` that:
1. Takes a `PatientInsurance` (with eager-loaded `payer`)
2. Returns a complete `eligibilityData` object matching the `EligibilityData` interface
3. Derives amounts from insurance policy: `deductibleAmount`, `copayAmount`, `coinsurancePercentage`
4. Generates simulated remaining amounts (e.g., random portion consumed)
5. Returns `coverageStatus: 'active'`, effective/end dates from policy
6. Prefix with: `// In production, call external clearinghouse API (Availity, Change Healthcare) for X12 270/271 exchange`

### 4. Backend: Eligibility Controller
Create `backend/src/modules/billing/eligibility.controller.ts`:

Use `AuthenticatedRequest` interface matching `appointments.controller.ts`. Extract `tenantId` from `req.tenantId`.

| Method | Path | Roles | Description |
|---|---|---|---|
| POST | `/eligibility` | admin, doctor, billing_staff, receptionist | Create verification |
| GET | `/eligibility` | admin, doctor, billing_staff, receptionist | List with pagination/filters |
| GET | `/eligibility/patient/:patientId` | admin, doctor, billing_staff, receptionist | Patient checks |
| GET | `/eligibility/:id` | admin, doctor, billing_staff, receptionist | Single check |
| POST | `/eligibility/:id/verify` | admin, billing_staff | Re-run verification |
| PATCH | `/eligibility/:id` | admin, billing_staff | Update |
| DELETE | `/eligibility/:id` | admin | Soft delete |

All endpoints use `@UseGuards(JwtAuthGuard, RolesGuard)`, `@ApiBearerAuth('JWT-auth')`, and full Swagger decorators (`@ApiOperation`, `@ApiResponse`, `@ApiParam`, `@ApiQuery`).

Base controller path: `'eligibility'`.

### 5. Backend: Register in Module
In `backend/src/modules/billing/billing.module.ts`:
- Add `InsuranceVerification` to `TypeOrmModule.forFeature([...])`
- Add `EligibilityService` to `providers`
- Add `EligibilityController` to `controllers`
- Add `EligibilityService` to `exports`

### 6. Frontend: Define EligibilityCheck Type
Add to `frontend/src/types/index.ts`:

```
export type VerificationStatus = 'pending' | 'verified' | 'failed' | 'error';
export type VerificationType = 'realtime' | 'batch' | 'manual';

export interface EligibilityCheck {
  id: string;
  patientId: string;
  patientName: string;
  patientInsuranceId: string;
  insuranceProvider: string;
  policyNumber: string;
  verificationStatus: VerificationStatus;
  verificationType: VerificationType;
  eligibilityData?: EligibilityData;
  requestPayload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
  verifiedAt: string;
  nextVerificationDate?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EligibilityData {
  coverageStatus: 'active' | 'inactive' | 'terminated' | 'pending';
  effectiveDate: string;
  endDate: string;
  deductibles: { individual: number; family: number; individualRemaining: number; familyRemaining: number };
  copays: { primaryCare: number; specialist: number; urgentCare: number; emergency: number; prescription: { generic: number; brand: number; specialty: number } };
  coinsurance: { percentage: number; inpatient: number; outpatient: number };
  outOfPocketMax: { individual: number; family: number; individualRemaining: number; familyRemaining: number };
  benefits: Array<{ service: string; coverage: string; limitations?: string; authorizationRequired: boolean }>;
  serviceAddress?: { street1: string; city: string; state: string; zipCode: string };
  payerPhone?: string;
  payerWebsite?: string;
}
```

Verify the existing import in `dataStore.ts` line 14 resolves correctly after adding.

### 7. Frontend: Create eligibilityService.ts
Create `frontend/src/services/eligibilityService.ts`:
- Follow the exact pattern of `appointmentService.ts`
- Class `EligibilityService` with methods: `create`, `findAll`, `findByPatient`, `findOne`, `verify`, `update`, `delete`
- Export singleton: `export const eligibilityService = new EligibilityService();`
- Define DTO interfaces inline: `CreateEligibilityCheckDto`, `QueryEligibilityDto`, `UpdateEligibilityDto`, `PaginatedResult`

### 8. Frontend: Update Eligibility Store
Update `useEligibilityStore` in `dataStore.ts`:
- Add `loading: boolean` and `error: string | null` state
- Replace in-memory CRUD with async API calls (follow `useAppointmentStore` pattern exactly)
- Methods: `fetchChecks`, `addCheck`, `verifyCheck`, `updateCheck`, `deleteCheck`
- Set `loading: true` before API calls, catch errors with `error` state + console.error, fallback to local state on failure
- Keep existing `mockEligibilityChecks` import as initial fallback

### 9. Frontend: Populate Mock Data
Update `mockEligibilityChecks` in `mockData.ts`:
- 3 realistic entries using patient ID `387d6bd8-09b3-4b39-8e43-4e96534f4636`
- One verified (full eligibilityData), one pending, one failed
- EligibilityData must match the interface exactly with realistic values (e.g., $1,500 deductible, $30 PCP copay, 20% coinsurance)
- Remove the `: any[]` type annotation -- use proper typing

### 10. Frontend: Create InsuranceEligibilityPage
Create `frontend/src/pages/insurance/InsuranceEligibilityPage.tsx`:

**Layout:**
- Header: Title "Insurance Eligibility Verification", subtitle, "New Verification" button (`PlusOutlined`)
- Filters: Patient search (`Select` with `showSearch`), status filter, date range (`RangePicker`)
- Table columns: Patient (Avatar + name), Insurance Provider, Policy #, Status (color-coded Tag), Verified At (dayjs formatted), Actions (View, Re-verify with Popconfirm, Delete with Popconfirm)

**Detail Drawer** (width 600):
- Header banner with status/type tags
- Coverage card (status, effective/end dates)
- Deductibles (progress bars)
- Copays table (service type and amount)
- Coinsurance (percentage, inpatient/outpatient)
- Out-of-pocket max (progress bars)
- Benefits table (service, coverage, limitations, auth required)
- Request/Response payloads (Collapse panel with formatted JSON)

**Create Modal:**
- Patient select (searchable, loads from patientService)
- Insurance policy select (filtered by patient)
- Verification type (Radio.Group: Real-time, Batch, Manual)
- Submit calls addCheck

**States:**
- Loading: Skeleton placeholders
- Empty: Ant Design Empty component
- Error: Alert with retry button

### 11. Frontend: Register Route
In `frontend/src/routes/index.tsx`:
- Uncomment `const InsuranceEligibilityPage = lazyWithRetry(...)` import
- Uncomment the `/eligibility` route path
- In `frontend/src/layouts/MainLayout.tsx`, add sidebar menu item:
  `{ key: '/eligibility', icon: <SafetyCertificateOutlined />, label: 'Eligibility' }`
  Import `SafetyCertificateOutlined` from `@ant-design/icons`

### 12. Integration: EligibilityStatusBadge (optional)
Create `frontend/src/components/eligibility/EligibilityStatusBadge.tsx`:
- Small component accepting `status: VerificationStatus`
- Renders a color-coded Tag (green=verified, gold=pending, red=failed, red=error)

## Conventions

- **No comments** in code (unless required by framework decorators like `@ApiOperation`)
- **No TODOs**
- Use class-validator decorators on all DTOs
- Use existing service/DTO/controller/entity pattern from AppointmentsModule
- Frontend: Follow `appointmentService.ts` pattern for API services
- Frontend: Follow `useAppointmentStore` pattern for state management
- Frontend: Use Ant Design components (Table, Card, Tag, Button, Drawer, Modal, Form, Select, DatePicker, Descriptions, Progress, Alert, Skeleton, Empty, Collapse, Radio)
- All clearinghouse integration is a mock with the comment: `// In production, call external clearinghouse API (Availity, Change Healthcare)`
- PHI must never be logged (use HipaaAuditService for audit events)
- `patientId` on entity is a plain `@Column({ type: 'uuid' })` -- NO relation decorators

## Verification

```bash
# Ensure DB is running
docker compose up -d postgres redis

# Backend type check
cd backend && npx tsc --noEmit

# Frontend type check
cd frontend && npx tsc --noEmit

# Start backend
cd backend && npx nest start --watch

# Test endpoints
# POST /api/v1/eligibility (create)
# GET /api/v1/eligibility (list)
# GET /api/v1/eligibility/patient/:patientId (by patient)
# POST /api/v1/eligibility/:id/verify (re-verify)
```
