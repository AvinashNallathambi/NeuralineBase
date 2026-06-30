# Neuraline EMR - Development Guide

## Architecture
- **Frontend**: React + Vite + Ant Design (port 5173 default)
- **Backend**: NestJS + TypeORM + PostgreSQL (port 4000 default)
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
- Set `DB_SYNCHRONIZE=true` for development (auto-creates tables)
- Boolean env vars must be compared as strings (ConfigService returns strings)

## Backend Modules
- **Implemented**: Auth, Patients, FHIR, Superbill, ProviderAvailability, AI, Workflow
- **Stubs (empty)**: Appointments, Billing, Clinical, Laboratory, Notifications, Prescriptions, Reports, Telemedicine, Users
- AuthService uses in-memory dev user (no UsersService/DB persistence yet)

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

# Test login
curl -s http://localhost:4000/api/v1/auth/login -X POST \
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
