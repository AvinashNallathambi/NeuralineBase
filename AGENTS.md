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
- **Implemented**: Auth, Patients, FHIR, Superbill, ProviderAvailability, AI
- **Stubs (empty)**: Appointments, Billing, Clinical, Laboratory, Notifications, Prescriptions, Reports, Telemedicine, Users
- AuthService uses in-memory dev user (no UsersService/DB persistence yet)

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
