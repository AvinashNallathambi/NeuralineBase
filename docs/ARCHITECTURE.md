# Neuraline EMR/EHR Platform - Complete Architecture Documentation

## Table of Contents
1. System Architecture
2. Database Schema Design
3. Microservices Breakdown
4. FHIR R4 Resource Mapping
5. API Design Structure
6. Folder Structure
7. Development Roadmap
8. Team Size, Timeline & Infrastructure Costs
9. Scaling Recommendations
10. Security & HIPAA Compliance

---

## 1. System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
├──────────┬──────────┬───────────┬──────────────────────────────┤
│ React    │ Patient  │ Mobile    │ Third-Party                   │
│ Web App  │ Portal   │ App (PWA) │ Integrations                  │
└─────┬────┴─────┬────┴─────┬─────┴──────────┬───────────────────┘
      │          │          │                │
      ▼          ▼          ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API GATEWAY (Kong/AWS ALB)                     │
│  • Rate Limiting  • SSL Termination  • Load Balancing            │
│  • API Versioning • Request Routing  • Authentication            │
└─────────────────────────────┬───────────────────────────────────┘
                              │
      ┌───────────┬───────────┼───────────┬───────────┐
      ▼           ▼           ▼           ▼           ▼
┌──────────┐┌──────────┐┌──────────┐┌──────────┐┌──────────┐
│   Auth   ││ Patient  ││Appoint-  ││ Clinical ││Prescrip- │
│ Service  ││ Service  ││  ment    ││ Service  ││  tion    │
│          ││          ││ Service  ││          ││ Service  │
└────┬─────┘└────┬─────┘└────┬─────┘└────┬─────┘└────┬─────┘
     │           │           │           │           │
┌──────────┐┌──────────┐┌──────────┐┌──────────┐┌──────────┐
│   Lab    ││ Billing  ││Notifica- ││Telemedi- ││Analytics │
│ Service  ││ Service  ││  tion    ││  cine    ││ Service  │
│          ││          ││ Service  ││ Service  ││          │
└────┬─────┘└────┬─────┘└────┬─────┘└────┬─────┘└────┬─────┘
     │           │           │           │           │
     └─────┬─────┴─────┬─────┴─────┬─────┴─────┬─────┘
           ▼           ▼           ▼           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                  │
├──────────┬──────────┬───────────┬──────────────────────────────┤
│PostgreSQL│  Redis   │OpenSearch │  AWS S3                       │
│ (Primary)│ (Cache)  │ (Search)  │  (Documents)                  │
└──────────┴──────────┴───────────┴──────────────────────────────┘
           │
┌─────────────────────────────────────────────────────────────────┐
│                   MESSAGE BROKER (AWS SQS/SNS)                   │
│  • Event-Driven Communication  • Async Processing                │
│  • Audit Event Streaming       • Notification Dispatch           │
└─────────────────────────────────────────────────────────────────┘
           │
┌─────────────────────────────────────────────────────────────────┐
│                   EXTERNAL INTEGRATIONS                           │
├──────────┬──────────┬───────────┬──────────────────────────────┤
│   Labs   │Pharmacies│Clearing-  │ Insurance                     │
│ (HL7 v2) │(NCPDP)   │ houses    │ Payers                        │
└──────────┴──────────┴───────────┴──────────────────────────────┘
```

### Multi-Tenant Architecture

Neuraline uses a **shared database, shared schema** multi-tenant model:
- Every table includes a `tenant_id` column
- Row-Level Security (RLS) policies enforce data isolation
- Tenant context is extracted from JWT tokens
- Connection pooling via PgBouncer

### Key Design Principles
- **API-First Design**: All functionality exposed via versioned REST APIs
- **FHIR R4 Compliance**: Native FHIR resource endpoints alongside internal APIs
- **Event-Driven**: Services communicate via events for loose coupling
- **CQRS Pattern**: Separate read/write models for high-throughput modules
- **Circuit Breaker**: Resilience patterns for external service calls

---

## 2. Database Schema Design

### Core Schema (PostgreSQL)

```sql
-- ============================================================
-- TENANT & ORGANIZATION
-- ============================================================

CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    logo_url TEXT,
    address JSONB,
    phone VARCHAR(20),
    email VARCHAR(255),
    subscription_tier VARCHAR(50) DEFAULT 'basic',
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USERS & AUTHENTICATION
-- ============================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin','doctor','nurse','receptionist','billing_staff','patient')),
    phone VARCHAR(20),
    avatar_url TEXT,
    specialization VARCHAR(100),
    department_id UUID REFERENCES departments(id),
    license_number VARCHAR(50),
    npi_number VARCHAR(10),
    mfa_enabled BOOLEAN DEFAULT false,
    mfa_secret VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(tenant_id, email)
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(tenant_id, role);

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    refresh_token TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant_time ON audit_logs(tenant_id, created_at DESC);

-- ============================================================
-- PATIENTS
-- ============================================================

CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    mrn VARCHAR(20) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    address JSONB,
    emergency_contact JSONB,
    blood_type VARCHAR(5),
    status VARCHAR(20) DEFAULT 'active',
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(tenant_id, mrn)
);

CREATE INDEX idx_patients_tenant ON patients(tenant_id);
CREATE INDEX idx_patients_name ON patients(tenant_id, last_name, first_name);
CREATE INDEX idx_patients_dob ON patients(tenant_id, date_of_birth);

CREATE TABLE insurance_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    provider_name VARCHAR(255) NOT NULL,
    policy_number VARCHAR(50) NOT NULL,
    group_number VARCHAR(50),
    subscriber_name VARCHAR(255),
    subscriber_relation VARCHAR(50),
    effective_date DATE NOT NULL,
    expiration_date DATE,
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE allergies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    allergen VARCHAR(255) NOT NULL,
    reaction VARCHAR(255),
    severity VARCHAR(20) CHECK (severity IN ('mild','moderate','severe','life-threatening')),
    status VARCHAR(20) DEFAULT 'active',
    onset_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE medical_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    condition_name VARCHAR(255) NOT NULL,
    icd_code VARCHAR(10),
    status VARCHAR(20) DEFAULT 'active',
    diagnosed_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE patient_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50),
    file_size BIGINT,
    s3_key TEXT NOT NULL,
    category VARCHAR(50),
    uploaded_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- APPOINTMENTS
-- ============================================================

CREATE TABLE appointment_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(100) NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    color VARCHAR(7),
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE provider_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    provider_id UUID NOT NULL REFERENCES users(id),
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    slot_duration INTEGER DEFAULT 30,
    is_available BOOLEAN DEFAULT true
);

CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    provider_id UUID NOT NULL REFERENCES users(id),
    appointment_type_id UUID REFERENCES appointment_types(id),
    status VARCHAR(20) DEFAULT 'scheduled',
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    reason TEXT,
    notes TEXT,
    is_telehealth BOOLEAN DEFAULT false,
    meeting_link TEXT,
    check_in_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT
);

CREATE INDEX idx_appointments_provider_time ON appointments(tenant_id, provider_id, start_time);
CREATE INDEX idx_appointments_patient ON appointments(tenant_id, patient_id);
CREATE INDEX idx_appointments_status ON appointments(tenant_id, status, start_time);

-- ============================================================
-- CLINICAL / ENCOUNTERS
-- ============================================================

CREATE TABLE encounters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    provider_id UUID NOT NULL REFERENCES users(id),
    appointment_id UUID REFERENCES appointments(id),
    encounter_type VARCHAR(30) DEFAULT 'office_visit',
    status VARCHAR(20) DEFAULT 'planned',
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE soap_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encounter_id UUID NOT NULL REFERENCES encounters(id),
    subjective TEXT,
    objective TEXT,
    assessment TEXT,
    plan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE vitals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    encounter_id UUID REFERENCES encounters(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    bp_systolic INTEGER,
    bp_diastolic INTEGER,
    heart_rate INTEGER,
    temperature DECIMAL(4,1),
    respiratory_rate INTEGER,
    oxygen_saturation DECIMAL(4,1),
    weight DECIMAL(5,1),
    height DECIMAL(5,1),
    bmi DECIMAL(4,1),
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    recorded_by UUID REFERENCES users(id)
);

CREATE TABLE diagnoses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    encounter_id UUID NOT NULL REFERENCES encounters(id),
    icd_code VARCHAR(10) NOT NULL,
    description TEXT NOT NULL,
    diagnosis_type VARCHAR(20) DEFAULT 'primary',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE treatment_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    encounter_id UUID NOT NULL REFERENCES encounters(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    description TEXT,
    goals JSONB DEFAULT '[]',
    interventions JSONB DEFAULT '[]',
    follow_up_date DATE,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE clinical_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50),
    template_data JSONB NOT NULL,
    created_by UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRESCRIPTIONS
-- ============================================================

CREATE TABLE prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    provider_id UUID NOT NULL REFERENCES users(id),
    encounter_id UUID REFERENCES encounters(id),
    status VARCHAR(20) DEFAULT 'draft',
    prescribed_date TIMESTAMPTZ DEFAULT NOW(),
    pharmacy VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE prescription_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prescription_id UUID NOT NULL REFERENCES prescriptions(id),
    medication_name VARCHAR(255) NOT NULL,
    rxnorm_code VARCHAR(20),
    dosage VARCHAR(100) NOT NULL,
    frequency VARCHAR(100) NOT NULL,
    route VARCHAR(50) DEFAULT 'oral',
    duration VARCHAR(50),
    quantity INTEGER,
    refills INTEGER DEFAULT 0,
    instructions TEXT
);

CREATE TABLE refill_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    prescription_id UUID NOT NULL REFERENCES prescriptions(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    status VARCHAR(20) DEFAULT 'pending',
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    notes TEXT
);

-- ============================================================
-- LABORATORY & DIAGNOSTICS
-- ============================================================

CREATE TABLE lab_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    provider_id UUID NOT NULL REFERENCES users(id),
    encounter_id UUID REFERENCES encounters(id),
    status VARCHAR(20) DEFAULT 'ordered',
    priority VARCHAR(20) DEFAULT 'routine',
    ordered_date TIMESTAMPTZ DEFAULT NOW(),
    completed_date TIMESTAMPTZ,
    notes TEXT,
    fasting_required BOOLEAN DEFAULT false
);

CREATE TABLE lab_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_order_id UUID NOT NULL REFERENCES lab_orders(id),
    test_name VARCHAR(255) NOT NULL,
    test_code VARCHAR(20),
    category VARCHAR(50),
    result VARCHAR(100),
    reference_range VARCHAR(100),
    unit VARCHAR(30),
    status VARCHAR(20) DEFAULT 'pending',
    abnormal_flag VARCHAR(20),
    completed_at TIMESTAMPTZ
);

CREATE TABLE imaging_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    provider_id UUID NOT NULL REFERENCES users(id),
    imaging_type VARCHAR(50) NOT NULL,
    body_part VARCHAR(100),
    status VARCHAR(20) DEFAULT 'ordered',
    findings TEXT,
    ordered_date TIMESTAMPTZ DEFAULT NOW(),
    completed_date TIMESTAMPTZ
);

-- ============================================================
-- BILLING & REVENUE CYCLE
-- ============================================================

CREATE TABLE claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    encounter_id UUID REFERENCES encounters(id),
    provider_id UUID NOT NULL REFERENCES users(id),
    insurance_id UUID REFERENCES insurance_policies(id),
    claim_number VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'draft',
    total_amount DECIMAL(10,2) NOT NULL,
    approved_amount DECIMAL(10,2),
    paid_amount DECIMAL(10,2),
    patient_responsibility DECIMAL(10,2),
    service_date DATE NOT NULL,
    submitted_date TIMESTAMPTZ,
    diagnosis_codes JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_claims_tenant_status ON claims(tenant_id, status);
CREATE INDEX idx_claims_patient ON claims(tenant_id, patient_id);

CREATE TABLE claim_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id UUID NOT NULL REFERENCES claims(id),
    cpt_code VARCHAR(10) NOT NULL,
    description TEXT,
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    modifiers JSONB DEFAULT '[]'
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    claim_id UUID REFERENCES claims(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50),
    reference_number VARCHAR(100),
    payment_date TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

CREATE TABLE insurance_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    insurance_id UUID NOT NULL REFERENCES insurance_policies(id),
    verification_status VARCHAR(20),
    eligibility_data JSONB,
    verified_at TIMESTAMPTZ DEFAULT NOW(),
    verified_by UUID REFERENCES users(id)
);

-- ============================================================
-- MESSAGING & NOTIFICATIONS
-- ============================================================

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    sender_id UUID NOT NULL REFERENCES users(id),
    recipient_id UUID NOT NULL REFERENCES users(id),
    subject VARCHAR(255),
    body TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    priority VARCHAR(20) DEFAULT 'normal',
    parent_id UUID REFERENCES messages(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT false,
    action_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_patients ON patients
    USING (tenant_id = current_setting('app.current_tenant')::UUID);

CREATE POLICY tenant_isolation_appointments ON appointments
    USING (tenant_id = current_setting('app.current_tenant')::UUID);
```

---

## 3. Microservices Breakdown

| Service | Responsibilities | Owned Tables | Key Events |
|---------|-----------------|--------------|------------|
| **Auth Service** | Authentication, authorization, MFA, session management | users, sessions, audit_logs | UserLoggedIn, UserCreated, MFAEnabled |
| **Patient Service** | Patient CRUD, demographics, insurance, allergies, documents | patients, insurance_policies, allergies, medical_history, patient_documents | PatientCreated, PatientUpdated, DocumentUploaded |
| **Appointment Service** | Scheduling, provider availability, reminders | appointments, provider_schedules, appointment_types | AppointmentCreated, AppointmentCancelled, CheckedIn |
| **Clinical Service** | Encounters, SOAP notes, vitals, diagnoses, treatment plans | encounters, soap_notes, vitals, diagnoses, treatment_plans, clinical_templates | EncounterStarted, EncounterCompleted, DiagnosisAdded |
| **Prescription Service** | E-prescribing, medication management, refills | prescriptions, prescription_items, refill_requests | PrescriptionCreated, RefillRequested, RefillApproved |
| **Laboratory Service** | Lab orders, results, imaging | lab_orders, lab_tests, imaging_reports | LabOrdered, ResultsReady, AbnormalResult |
| **Billing Service** | Claims, payments, CPT/ICD management, insurance verification | claims, claim_items, payments, insurance_verifications | ClaimSubmitted, PaymentReceived, ClaimDenied |
| **Notification Service** | Email, SMS, push, in-app notifications | notifications, messages | NotificationSent, MessageRead |
| **Telemedicine Service** | Video calls, chat, file sharing | telemedicine_sessions | SessionStarted, SessionEnded |
| **Analytics Service** | Reports, dashboards, data aggregation | analytics_cache (materialized views) | ReportGenerated |
| **FHIR Gateway** | FHIR R4 resource translation, interoperability | None (reads from other services) | FHIRResourceAccessed |
| **AI Service** | Medical scribe, SOAP generation, coding suggestions | ai_sessions, ai_outputs | SOAPGenerated, CodingSuggested |

---

## 4. FHIR R4 Resource Mapping

### Internal to FHIR Mapping

| Internal Model | FHIR R4 Resource | Key Mappings |
|---------------|------------------|--------------|
| Patient | Patient | name, telecom, address, birthDate, gender |
| User (doctor) | Practitioner | name, identifier (NPI), qualification |
| Encounter | Encounter | status, class, type, subject, participant, period |
| Vitals | Observation | code (LOINC), value, effectiveDateTime |
| Diagnosis | Condition | code (ICD-10), subject, clinicalStatus |
| Prescription | MedicationRequest | medication (RxNorm), subject, dosageInstruction |
| Lab Order | ServiceRequest | code, subject, requester, priority |
| Lab Result | DiagnosticReport | code, result (Observation references), status |
| Claim | Claim | type, patient, provider, diagnosis, item |
| Allergy | AllergyIntolerance | code, patient, criticality, reaction |

### Example FHIR Patient Resource

```json
{
  "resourceType": "Patient",
  "id": "pat-001",
  "meta": {
    "profile": ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"]
  },
  "identifier": [{
    "system": "https://neuraline.health/mrn",
    "value": "MRN-001"
  }],
  "name": [{
    "use": "official",
    "family": "Martinez",
    "given": ["John"]
  }],
  "telecom": [
    { "system": "phone", "value": "(415) 555-0101", "use": "mobile" },
    { "system": "email", "value": "john.martinez@email.com" }
  ],
  "gender": "male",
  "birthDate": "1975-03-15",
  "address": [{
    "use": "home",
    "line": ["123 Oak Street"],
    "city": "San Francisco",
    "state": "CA",
    "postalCode": "94102"
  }]
}
```

### Example FHIR MedicationRequest

```json
{
  "resourceType": "MedicationRequest",
  "id": "rx-001",
  "status": "active",
  "intent": "order",
  "medicationCodeableConcept": {
    "coding": [{
      "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
      "code": "860975",
      "display": "Metformin 500mg"
    }]
  },
  "subject": { "reference": "Patient/pat-001" },
  "authoredOn": "2024-01-15",
  "requester": { "reference": "Practitioner/usr-001" },
  "dosageInstruction": [{
    "text": "Take 500mg twice daily with meals",
    "timing": { "repeat": { "frequency": 2, "period": 1, "periodUnit": "d" } },
    "route": { "coding": [{ "system": "http://snomed.info/sct", "code": "26643006", "display": "Oral" }] },
    "doseAndRate": [{ "doseQuantity": { "value": 500, "unit": "mg" } }]
  }],
  "dispenseRequest": {
    "numberOfRepeatsAllowed": 3,
    "quantity": { "value": 60, "unit": "tablets" }
  }
}
```

---

## 5. API Design Structure

### Base URL
```
https://api.neuraline.health/api/v1
```

### Authentication Endpoints
```
POST   /auth/login                    # Login with credentials
POST   /auth/register                 # Register tenant + admin
POST   /auth/refresh                  # Refresh JWT token
POST   /auth/mfa/enable               # Enable MFA
POST   /auth/mfa/verify               # Verify MFA code
POST   /auth/logout                   # Logout
POST   /auth/forgot-password          # Send password reset email
POST   /auth/reset-password           # Reset password with token
```

### Patient Endpoints
```
GET    /patients                      # List patients (paginated, searchable)
POST   /patients                      # Create patient
GET    /patients/:id                  # Get patient by ID
PATCH  /patients/:id                  # Update patient
DELETE /patients/:id                  # Soft delete patient
GET    /patients/:id/encounters       # Get patient encounters
GET    /patients/:id/prescriptions    # Get patient prescriptions
GET    /patients/:id/lab-orders       # Get patient lab orders
POST   /patients/:id/documents       # Upload document
GET    /patients/:id/documents       # List documents
```

### Appointment Endpoints
```
GET    /appointments                  # List appointments (filtered)
POST   /appointments                  # Create appointment
GET    /appointments/:id              # Get appointment
PATCH  /appointments/:id              # Update appointment
DELETE /appointments/:id              # Cancel appointment
POST   /appointments/:id/check-in    # Check in patient
GET    /providers/:id/schedule        # Get provider schedule
GET    /providers/:id/availability    # Get available slots
```

### Clinical Endpoints
```
GET    /encounters                    # List encounters
POST   /encounters                    # Create encounter
GET    /encounters/:id                # Get encounter with details
PATCH  /encounters/:id                # Update encounter
POST   /encounters/:id/soap-notes    # Create/update SOAP note
POST   /encounters/:id/vitals        # Record vitals
POST   /encounters/:id/diagnoses     # Add diagnosis
POST   /encounters/:id/complete      # Sign & complete encounter
GET    /clinical-templates            # List templates
```

### Prescription Endpoints
```
GET    /prescriptions                 # List prescriptions
POST   /prescriptions                 # Create prescription
GET    /prescriptions/:id             # Get prescription
PATCH  /prescriptions/:id             # Update prescription
POST   /prescriptions/:id/send       # Send to pharmacy
GET    /refill-requests               # List refill requests
PATCH  /refill-requests/:id           # Approve/deny refill
```

### Laboratory Endpoints
```
GET    /lab-orders                    # List lab orders
POST   /lab-orders                    # Create lab order
GET    /lab-orders/:id                # Get lab order with results
PATCH  /lab-orders/:id/results       # Update results
GET    /imaging-reports               # List imaging reports
POST   /imaging-reports               # Create imaging report
```

### Billing Endpoints
```
GET    /claims                        # List claims
POST   /claims                        # Create claim
GET    /claims/:id                    # Get claim details
PATCH  /claims/:id                    # Update claim
POST   /claims/:id/submit            # Submit to payer
POST   /claims/:id/appeal            # Appeal denied claim
GET    /payments                      # List payments
POST   /payments                      # Record payment
```

### FHIR R4 Endpoints
```
GET    /fhir/metadata                 # Capability statement
GET    /fhir/Patient/:id              # Get FHIR Patient
GET    /fhir/Patient?name=...         # Search FHIR Patients
GET    /fhir/Encounter/:id            # Get FHIR Encounter
GET    /fhir/MedicationRequest/:id    # Get FHIR MedicationRequest
GET    /fhir/DiagnosticReport/:id     # Get FHIR DiagnosticReport
GET    /fhir/Claim/:id                # Get FHIR Claim
```

### Standard Response Format
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ]
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## 6. Folder Structure

### React Frontend
```
frontend/
├── public/
│   ├── logo.png
│   └── favicon.ico
├── src/
│   ├── assets/          # Images, fonts, static files
│   ├── components/      # Shared/reusable components
│   │   ├── common/      # Buttons, modals, loaders
│   │   ├── charts/      # Chart components
│   │   └── forms/       # Form components
│   ├── data/            # Mock data
│   ├── hooks/           # Custom React hooks
│   ├── layouts/         # MainLayout, AuthLayout
│   ├── pages/           # Page components by module
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── patients/
│   │   ├── appointments/
│   │   ├── clinical/
│   │   ├── prescriptions/
│   │   ├── laboratory/
│   │   ├── billing/
│   │   ├── telemedicine/
│   │   ├── reports/
│   │   ├── settings/
│   │   ├── portal/
│   │   └── landing/
│   ├── routes/          # Route configuration
│   ├── services/        # API service layer
│   ├── store/           # Zustand state management
│   ├── styles/          # Global styles, theme
│   ├── types/           # TypeScript interfaces
│   ├── utils/           # Utility functions
│   ├── App.tsx
│   └── main.tsx
├── vercel.json
├── package.json
└── tsconfig.json
```

### NestJS Backend
```
backend/
├── src/
│   ├── common/
│   │   ├── entities/         # Base entity
│   │   ├── interceptors/     # Audit, Tenant
│   │   ├── filters/          # Exception filters
│   │   ├── guards/           # Auth guards
│   │   ├── decorators/       # Custom decorators
│   │   ├── pipes/            # Validation pipes
│   │   └── dto/              # Shared DTOs
│   ├── config/               # Database, Redis, etc.
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── strategies/
│   │   │   ├── guards/
│   │   │   └── decorators/
│   │   ├── patients/
│   │   │   ├── patients.module.ts
│   │   │   ├── patients.controller.ts
│   │   │   ├── patients.service.ts
│   │   │   ├── entities/
│   │   │   └── dto/
│   │   ├── appointments/
│   │   ├── clinical/
│   │   ├── prescriptions/
│   │   ├── laboratory/
│   │   ├── billing/
│   │   ├── notifications/
│   │   ├── telemedicine/
│   │   ├── reports/
│   │   ├── fhir/
│   │   └── ai/
│   ├── app.module.ts
│   └── main.ts
├── test/
├── migrations/
├── Dockerfile
├── package.json
└── tsconfig.json
```

---

## 7. Development Roadmap

### Phase 1: MVP (Months 1-3)
- User authentication (JWT + MFA)
- Role-based access control
- Patient registration & management
- Basic appointment scheduling
- Clinical documentation (SOAP notes)
- Basic vitals recording
- Audit logging
- Landing page & dashboard

### Phase 2: Core Features (Months 4-6)
- E-Prescription module
- Laboratory orders & results
- Basic billing & claims
- Patient portal (view records)
- Provider schedule management
- Document upload/management
- Notification system (email/in-app)

### Phase 3: Advanced Features (Months 7-9)
- Telemedicine (video/chat)
- AI medical scribe & SOAP generation
- ICD-10/CPT coding suggestions
- Advanced billing & insurance verification
- Reports & analytics dashboards
- FHIR R4 API endpoints
- Mobile-responsive optimization

### Phase 4: Enterprise (Months 10-12)
- HL7 v2 integration
- Clearinghouse connectivity
- Multi-facility support
- Advanced AI features (voice-to-text)
- Native mobile app (React Native)
- Custom reporting engine
- API marketplace for third-party integrations
- SOC 2 Type II certification

---

## 8. Team Size, Timeline & Infrastructure Costs

### Recommended Team (12-15 people)

| Role | Count | Responsibilities |
|------|-------|-----------------|
| Engineering Manager | 1 | Technical leadership, architecture decisions |
| Senior Full-Stack Developers | 3 | Core module development |
| Mid-Level Full-Stack Developers | 3 | Feature development, bug fixes |
| Frontend Developer (React) | 1 | UI/UX implementation |
| DevOps Engineer | 1 | CI/CD, infrastructure, monitoring |
| QA Engineer | 1 | Testing, quality assurance |
| UI/UX Designer | 1 | Design system, user research |
| Product Manager | 1 | Requirements, roadmap, stakeholders |
| Healthcare/Compliance Specialist | 1 | HIPAA, regulatory compliance |

### Timeline
- **Month 1-3**: MVP with core auth, patients, appointments, clinical docs
- **Month 4-6**: Prescriptions, labs, billing, patient portal
- **Month 7-9**: Telemedicine, AI, analytics, FHIR
- **Month 10-12**: Enterprise features, compliance certifications

### AWS Infrastructure Costs (Monthly)

| Environment | Components | Monthly Cost |
|-------------|-----------|--------------|
| **Development** | 2x t3.medium EC2, RDS t3.medium, ElastiCache t3.small, S3 | ~$500 |
| **Staging** | 2x t3.large EC2, RDS r5.large, ElastiCache r5.large, S3, OpenSearch t3.medium | ~$2,000 |
| **Production (Small)** | EKS (3x m5.xlarge), RDS r5.xlarge (Multi-AZ), ElastiCache r5.large (cluster), S3, CloudFront, OpenSearch (3-node), ALB, WAF | ~$8,000-12,000 |
| **Production (Scale)** | EKS (10+ nodes), RDS r5.2xlarge (Multi-AZ + read replicas), ElastiCache cluster, OpenSearch (5-node), CloudFront, WAF, Shield | ~$25,000-50,000 |

---

## 9. Scaling Recommendations for 10,000+ Providers

### Database Scaling
- **Read Replicas**: Deploy 2-3 PostgreSQL read replicas for read-heavy operations (reports, searches)
- **Connection Pooling**: PgBouncer with 500+ connection pool
- **Partitioning**: Time-based partitioning on audit_logs, appointments, encounters
- **Tenant Sharding**: For 10K+ tenants, implement database-per-tenant or shard-per-region

### Application Scaling
- **Kubernetes (EKS)**: Auto-scaling pods per microservice based on CPU/memory
- **Horizontal Scaling**: Stateless services behind ALB with 3+ replicas each
- **Queue Workers**: Dedicated worker nodes for async processing (billing, notifications, AI)

### Caching Strategy
- **Redis Cluster**: 3-node cluster with automatic failover
- **Cache Layers**:
  - L1: In-memory (per-pod) for hot data (user sessions, permissions)
  - L2: Redis for shared data (patient demographics, provider schedules)
  - L3: CDN for static assets (CloudFront)
- **Cache Invalidation**: Event-driven invalidation via pub/sub

### Search Optimization
- **OpenSearch Cluster**: 3 data nodes + 2 master nodes
- **Index Strategy**: Separate indices per tenant for large tenants, shared index with routing for smaller ones
- **Bulk Indexing**: Async indexing via message queue

### CDN & Edge
- **CloudFront**: Global edge distribution for static assets
- **Edge Functions**: Lambda@Edge for geo-routing and A/B testing

### Observability
- **Metrics**: Prometheus + Grafana for application and infrastructure metrics
- **Logging**: ELK Stack (OpenSearch) with structured JSON logging
- **Tracing**: AWS X-Ray or Jaeger for distributed tracing
- **Alerting**: PagerDuty integration for critical alerts
- **SLA Monitoring**: 99.9% uptime target with synthetic monitoring

---

## 10. Security & HIPAA Compliance

### Encryption
- **At Rest**: AES-256 encryption for all databases (RDS encryption), S3 SSE-KMS
- **In Transit**: TLS 1.3 for all communications, certificate pinning for mobile
- **Application Level**: PHI fields encrypted with tenant-specific keys

### Access Controls
- **RBAC**: Role-based access with granular permissions
- **MFA**: TOTP-based multi-factor authentication
- **Session Management**: JWT (15-min access, 7-day refresh), concurrent session limits
- **IP Whitelisting**: Optional per-tenant IP restrictions

### Audit & Monitoring
- **Comprehensive Audit Trail**: Every data access logged with user, action, resource, timestamp, IP
- **Immutable Logs**: Audit logs stored in append-only format, replicated to S3
- **Real-time Monitoring**: Suspicious activity detection and alerting
- **Access Reports**: Monthly access review reports per HIPAA requirements

### HIPAA Checklist
- [x] Business Associate Agreements (BAA) with all vendors
- [x] Data encryption at rest and in transit
- [x] Access controls and authentication
- [x] Audit logging and monitoring
- [x] Data backup and disaster recovery
- [x] Incident response plan
- [x] Employee training program
- [x] Risk assessment documentation
- [x] PHI minimum necessary standard
- [x] Patient rights (access, amendment, accounting of disclosures)

### Backup & Disaster Recovery
- **RTO**: 4 hours (Recovery Time Objective)
- **RPO**: 1 hour (Recovery Point Objective)
- **Strategy**: Automated daily snapshots, continuous WAL archiving, cross-region replication
- **DR Site**: Warm standby in secondary AWS region
- **Testing**: Quarterly DR drills

---

*Document Version: 1.0 | Last Updated: June 2025 | Neuraline EMR Platform*
