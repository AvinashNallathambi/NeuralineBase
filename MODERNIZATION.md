# Neuraline EMR — Modernization Report & Roadmap

> Generated from a full-stack audit of the frontend, backend, and DevOps infrastructure.
> No code was changed to produce this report.

---

## Table of Contents

1. [Current State Summary](#1-current-state-summary)
2. [Audit Scorecard](#2-audit-scorecard)
3. [Frontend Findings](#3-frontend-findings)
4. [Backend Findings](#4-backend-findings)
5. [DevOps & Infrastructure Findings](#5-devops--infrastructure-findings)
6. [Modernization Roadmap (Phased)](#6-modernization-roadmap-phased)
7. [Technology Recommendations](#7-technology-recommendations)
8. [Estimated Effort](#8-estimated-effort)

---

## 1. Current State Summary

| Dimension | Details |
|-----------|---------|
| **Frontend** | React 18, Vite 5, Ant Design 6, Zustand 5, 59 routes, 36 service files |
| **Backend** | NestJS 10, TypeORM 0.3, PostgreSQL 15, Redis 7, 31 modules, 26 migrations, 57 DTOs |
| **AI** | Multi-provider (Ollama, OpenRouter, Groq, OpenAI) with vision + streaming |
| **Real-time** | Socket.io WebSocket gateway for telemedicine |
| **Infra** | Docker (dev), AWS EC2 + RDS + ElastiCache (prod), Terraform IaC, GitHub Actions CI/CD |
| **Security** | JWT + Passport + MFA (partial), bcrypt, AES-256-GCM encryption, Helmet, rate limiting |
| **Tests** | 7 backend spec files, 2 E2E files, 1 frontend test file — minimal coverage |

---

## 2. Audit Scorecard

| Category | Score | Status |
|----------|-------|--------|
| **Frontend: Data Fetching** | 5/10 | React Query installed but unused; manual axios + useState everywhere |
| **Frontend: State Management** | 8/10 | Zustand well-structured; HIPAA-compliant (no persistence); 1013-line monolith |
| **Frontend: Routing** | 9/10 | 59 lazy-loaded routes with stale-chunk recovery; no error boundaries |
| **Frontend: Type Safety** | 8/10 | 885 lines of types; manually maintained; no end-to-end type safety |
| **Frontend: Testing** | 2/10 | 1 test file for 60+ pages; Vitest configured but unused |
| **Frontend: Error Handling** | 0/10 | No ErrorBoundary component; no Sentry; no fallback UI |
| **Frontend: Accessibility** | 2/10 | No ARIA labels; no semantic HTML; Ant Design provides baseline |
| **Backend: Module Coverage** | 9/10 | 31 fully-implemented modules; no stubs |
| **Backend: Security** | 8/10 | Helmet, rate limiting, encryption, audit logging; MFA incomplete |
| **Backend: Testing** | 3/10 | 7 spec files for 31 modules; no coverage thresholds |
| **Backend: Caching** | 4/10 | Redis used for queues + rate limiting only; no app-level caching |
| **Backend: AI** | 7/10 | 4 providers, vision, streaming; no vector embeddings/RAG |
| **DevOps: CI/CD** | 8/10 | 6-stage pipeline; security audit non-blocking; no SAST |
| **DevOps: Deployment** | 8/10 | Zero-downtime PM2; no blue-green; no auto-rollback |
| **DevOps: Terraform** | 7/10 | HIPAA-ready; no multi-AZ; no ALB; no CloudWatch |
| **DevOps: Monitoring** | 3/10 | Health checks only; no APM, no error tracking, no alerting |
| **DevOps: Security Scanning** | 2/10 | npm audit only (non-blocking); no CodeQL, Dependabot, Trivy |
| **DevOps: Testing Infra** | 4/10 | Jest + Vitest configured; coverage critically low |

**Overall Score: 5.4/10** — Solid foundation, significant gaps in testing, monitoring, and error handling.

---

## 3. Frontend Findings

### 3.1 Data Fetching — Biggest Opportunity

**Current**: Every page uses `useEffect(() => fetchX(), [])` + manual `loading`/`error` state in Zustand stores. 36 service files all follow this pattern.

**Problem**: No caching, no deduplication, no automatic retry, no background refetch, no optimistic updates. The `Promise.all` bug we just fixed (where one failed call blocked all data) is a direct consequence.

**Key Finding**: `@tanstack/react-query` v5 is **already installed** (`^5.100.14`) but **not used anywhere**.

**Recommendation**: Migrate to TanStack Query. This single change eliminates ~60% of store boilerplate and prevents the class of bugs we've been fixing.

### 3.2 State Management

**Current**: Single `dataStore.ts` file (1,013 lines) with 9 stores + 3,481 lines of mock data in `mockData.ts`.

**Issues**:
- Monolithic file — hard to navigate, merge conflicts
- 24 mock data arrays still imported as fallbacks
- Duplicated loading/error logic in every store

**Recommendation**: Split into per-domain store files. Remove mock data fallbacks once API is stable.

### 3.3 Error Boundaries

**Current**: Zero error boundaries. Any uncaught render error = white screen.

**Recommendation**: Add `ErrorBoundary` component wrapping all routes. Integrate Sentry for production error tracking.

### 3.4 Security Concerns in Frontend

**`bcryptjs` and `jsonwebtoken` are in `frontend/package.json`** — these are backend-only crypto libraries. The frontend should never hash passwords or sign JWTs. Remove them.

### 3.5 Type Mismatch

`@types/react-router-dom` is v5.3.3 but `react-router-dom` is v7.16.0. This is a breaking version mismatch that can cause runtime errors.

### 3.6 Testing

1 test file (`PatientInsuranceManager.test.tsx`) for 59 pages and 36 services. Vitest is configured but essentially unused.

### 3.7 Accessibility

No ARIA attributes, no semantic HTML, no keyboard navigation management. Ant Design provides baseline a11y, but custom components need work for WCAG 2.1 AA compliance (required for healthcare).

---

## 4. Backend Findings

### 4.1 Architecture — Strong

31 fully-implemented NestJS modules with proper separation of concerns. 57 DTOs with class-validator decorators. Global ValidationPipe with `whitelist` + `forbidNonWhitelisted`. Swagger/OpenAPI at `/api/docs`.

### 4.2 Authentication — Good but Incomplete

- JWT + Passport + RSA-OAEP password encryption in transit
- Redis-backed token blacklist (cross-instance revocation)
- Account lockout (5 attempts / 15 min)
- **MFA is partially implemented** — TOTP secret generation works but verification is a TODO (line 313 of auth.service.ts)

### 4.3 Security — HIPAA-Conscious

- AES-256-GCM encryption at rest
- Helmet security headers
- Rate limiting (Redis-backed, per-endpoint overrides)
- HIPAA audit logging (immutable, 6-year retention)
- **Gaps**: No file type validation on uploads, no virus scanning, in-memory file storage (should be S3)

### 4.4 AI Integration — Advanced

4 LLM providers (Ollama, OpenRouter, Groq, OpenAI) with:
- Text generation + chat with streaming
- Vision (insurance card OCR, document analysis)
- Fallback model retry on 429s
- AssemblyAI transcription integration

**Missing**: No vector embeddings, no RAG, no semantic search. This is the biggest AI gap.

### 4.5 Caching — Underutilized

Redis is used for:
- Token blacklist
- Rate limiting
- Bull job queues

Redis is NOT used for:
- Application-level caching (patient demographics, code lookups, payer data)
- Session storage
- Query result caching

### 4.6 Testing — Critical Gap

7 unit test files + 2 E2E files for 31 modules. No coverage thresholds. Critical paths (auth, billing, FHIR, AI) are largely untested.

### 4.7 Logging

NestJS built-in `Logger` only. No structured JSON logging (Winston/Pino). No log aggregation. For HIPAA compliance, structured audit-ready logging is essential.

---

## 5. DevOps & Infrastructure Findings

### 5.1 Docker — Good

Multi-stage builds for both frontend (Node → Nginx) and backend (Node → non-root user). 6 services in docker-compose with health checks and volumes.

### 5.2 CI/CD — Solid Foundation

6-stage pipeline: lint → unit tests → E2E → build → security audit → gate. Deploy waits for CI to pass, then SSH into EC2 and runs deploy.sh with health checks.

**Gaps**:
- `npm audit` is `continue-on-error: true` — vulnerabilities don't block deploy
- No SAST (CodeQL, Semgrep)
- No container image scanning (Trivy)
- No Dependabot
- No code coverage reporting

### 5.3 Deployment — Zero-Downtime but Fragile

PM2 graceful restart + Nginx reload = zero downtime. But:
- No blue-green deployment
- No automatic rollback
- No database backup before migration
- Single EC2 instance (no HA)

### 5.4 Terraform — HIPAA-Ready

VPC with private subnets for RDS/Redis, KMS encryption, security groups with least-privilege. Free-tier optimized.

**Gaps**: No multi-AZ RDS, no ALB, no CloudFront CDN, no CloudWatch alarms, no WAF.

### 5.5 Monitoring — Critical Gap

No Sentry, no Datadog, no Prometheus, no CloudWatch alarms, no OpenTelemetry. If the app breaks in production, you'll only know from user reports.

### 5.6 Pre-commit Hooks — Missing

Husky is installed but `.husky/pre-commit` doesn't exist. No lint-staged. Developers can commit unlinted, untested code.

---

## 6. Modernization Roadmap (Phased)

### Phase 1: Stability & Reliability (Weeks 1-2)

> Goal: Stop things from breaking silently

| # | Task | Impact | Effort |
|---|------|--------|--------|
| 1.1 | Add React ErrorBoundary wrapping all routes | Prevents white screen | S |
| 1.2 | Integrate Sentry (frontend + backend) | Production error tracking | S |
| 1.3 | Fix `@types/react-router-dom` version mismatch | Prevents type errors | S |
| 1.4 | Remove `bcryptjs` + `jsonwebtoken` from frontend | Security hygiene | S |
| 1.5 | Add `.husky/pre-commit` with lint-staged | Prevent bad commits | S |
| 1.6 | Make `npm audit` blocking in CI (high severity) | Catch vulnerabilities | S |
| 1.7 | Add database backup before migration in deploy.sh | Prevent data loss | S |
| 1.8 | Complete MFA TOTP verification (backend line 313) | HIPAA compliance | M |

### Phase 2: Data Layer Modernization (Weeks 3-4)

> Goal: Eliminate boilerplate, prevent data-fetching bugs

| # | Task | Impact | Effort |
|---|------|--------|--------|
| 2.1 | Set up TanStack Query provider + devtools | Foundation for migration | S |
| 2.2 | Migrate patient pages to `useQuery`/`useMutation` | Caching, dedup, retry | M |
| 2.3 | Migrate appointment pages to React Query | Caching, dedup, retry | M |
| 2.4 | Migrate billing/claims pages to React Query | Caching, dedup, retry | M |
| 2.5 | Migrate remaining pages to React Query | Full migration | L |
| 2.6 | Split `dataStore.ts` into per-domain files | Maintainability | M |
| 2.7 | Remove mock data fallbacks | Clean codebase | M |
| 2.8 | Add `Promise.allSettled` pattern everywhere | Prevent cascading failures | S |

### Phase 3: Testing & Quality (Weeks 5-6)

> Goal: Confidence to deploy without manual testing

| # | Task | Impact | Effort |
|---|------|--------|--------|
| 3.1 | Add frontend tests for auth flow (login, logout, token refresh) | Critical path coverage | M |
| 3.2 | Add frontend tests for patient CRUD | Core functionality | M |
| 3.3 | Add frontend tests for appointment scheduling | Core functionality | M |
| 3.4 | Add backend tests for auth module (login, MFA, lockout) | Security | M |
| 3.5 | Add backend tests for billing module (claims, invoices) | Revenue cycle | L |
| 3.6 | Set up Playwright E2E tests for critical workflows | End-to-end confidence | L |
| 3.7 | Add coverage thresholds (80% backend, 60% frontend) | Enforce quality | S |
| 3.8 | Add CodeQL + Dependabot in GitHub | Automated security | S |

### Phase 4: Performance & Scale (Weeks 7-8)

> Goal: Faster page loads, handle more users

| # | Task | Impact | Effort |
|---|------|--------|--------|
| 4.1 | Configure Vite manual chunks (vendor, antd, stripe) | Smaller initial bundle | S |
| 4.2 | Add rollup-plugin-visualizer for bundle analysis | Identify bloat | S |
| 4.3 | Add Redis caching for patient demographics, ICD/CPT lookups | Faster API responses | M |
| 4.4 | Add CloudFront CDN for static assets | Faster global load | M |
| 4.5 | Add Application Load Balancer + multi-AZ RDS | High availability | L |
| 4.6 | Implement PM2 cluster mode (2+ instances) | Use all CPU cores | S |
| 4.7 | Add CloudWatch alarms (CPU, memory, disk, RDS connections) | Proactive monitoring | M |

### Phase 5: AI & Advanced Features (Weeks 9-10)

> Goal: Modern AI capabilities for clinical decision support

| # | Task | Impact | Effort |
|---|------|--------|--------|
| 5.1 | Add pgvector extension to PostgreSQL | Vector storage | S |
| 5.2 | Implement embedding generation for clinical notes | Semantic search foundation | M |
| 5.3 | Build RAG pipeline for clinical guideline search | AI-powered clinical support | L |
| 5.4 | Add patient similarity search (diagnosis, demographics) | Population health | M |
| 5.5 | Implement AI-powered clinical decision support | Modern AI feature | L |
| 5.6 | Add OpenTelemetry distributed tracing | Request-level observability | M |

### Phase 6: Developer Experience (Weeks 11-12)

> Goal: Faster development, fewer bugs, better tooling

| # | Task | Impact | Effort |
|---|------|--------|--------|
| 6.1 | Generate frontend types from Swagger/OpenAPI | End-to-end type safety | M |
| 6.2 | Add Prettier config file + import sorting | Consistent code style | S |
| 6.3 | Add structured logging (Pino) with JSON output | Production observability | M |
| 6.4 | Add WebSocket for real-time notifications (not just telemedicine) | Live updates | L |
| 6.5 | Implement file storage in S3 with encryption | HIPAA-compliant uploads | M |
| 6.6 | Add file type validation + virus scanning (ClamAV) | Upload security | M |
| 6.7 | Add blue-green deployment with auto-rollback | Zero-risk deploys | L |
| 6.8 | Add accessibility audit + WCAG 2.1 AA compliance | Healthcare compliance | L |

---

## 7. Technology Recommendations

### Adopt (High Impact, Low Risk)

| Technology | Purpose | Why |
|------------|---------|-----|
| **TanStack Query v5** | Data fetching/caching | Already installed; eliminates 60% of store boilerplate |
| **Sentry** | Error tracking | Free tier; 5-minute setup; production visibility |
| **Pino** | Structured logging | JSON logs; fastest Node.js logger; HIPAA-friendly |
| **Playwright** | E2E testing | Cross-browser; better than Cypress for healthcare apps |
| **pgvector** | Vector embeddings | Runs in existing PostgreSQL; no new infra |
| **GitHub CodeQL** | SAST security scanning | Free for public repos; automated in GitHub Actions |
| **Dependabot** | Dependency updates | Free; automated PRs for security patches |
| **Trivy** | Container scanning | Free; scans Docker images for CVEs |
| **CloudWatch** | Infrastructure monitoring | AWS-native; free tier; alarms + dashboards |
| **OpenTelemetry** | Distributed tracing | Vendor-neutral; standard for observability |

### Consider (Medium Impact, Medium Risk)

| Technology | Purpose | Trade-off |
|------------|---------|-----------|
| **tRPC** | End-to-end type safety | Requires backend rewrite; not NestJS-native |
| **Tailwind CSS** | Utility-first styling | Big migration; conflicts with Ant Design |
| **Redis caching decorators** | App-level caching | NestJS CacheModule + Redis; moderate effort |
| **Socket.io (expanded)** | Real-time notifications | Already have infra; expand beyond telemedicine |
| **S3 file storage** | HIPAA-compliant uploads | Requires AWS SDK integration; moderate effort |
| **ALB + multi-AZ** | High availability | Increases AWS cost; requires Terraform changes |

### Avoid (Not Recommended for This Stack)

| Technology | Reason |
|------------|--------|
| **GraphQL** | NestJS is REST-first; adding GraphQL doubles the API surface |
| **Prisma** | Already invested in TypeORM; migration risk > benefit |
| **Next.js / SSR** | SPA is working well; SSR adds complexity without clear benefit for EMR |
| **Microservices** | Single NestJS app is fine at current scale; premature distribution |
| **Kubernetes** | Overkill for single EC2; use when you have 5+ services |

---

## 8. Estimated Effort

| Phase | Duration | Team Size | Key Outcome |
|-------|----------|-----------|-------------|
| Phase 1: Stability | 2 weeks | 1-2 devs | No more silent failures |
| Phase 2: Data Layer | 2 weeks | 1-2 devs | React Query migration |
| Phase 3: Testing | 2 weeks | 2 devs | 80% backend, 60% frontend coverage |
| Phase 4: Performance | 2 weeks | 1-2 devs | CDN, caching, HA |
| Phase 5: AI | 2 weeks | 1-2 devs | RAG, vector search |
| Phase 6: DX | 2 weeks | 1-2 devs | Type safety, structured logging, a11y |
| **Total** | **12 weeks** | **2 devs** | **Production-grade EMR** |

### Quick Wins (Can Do Today)

1. Remove `bcryptjs` + `jsonwebtoken` from `frontend/package.json`
2. Fix `@types/react-router-dom` to v7
3. Add `ErrorBoundary` component
4. Make `npm audit` blocking in CI
5. Add `.husky/pre-commit` with lint-staged
6. Add database backup step in `deploy.sh` before migration

---

## Appendix: Key File References

| File | Lines | Purpose |
|------|-------|---------|
| `frontend/src/store/dataStore.ts` | 1,013 | All Zustand stores (monolith) |
| `frontend/src/data/mockData.ts` | 3,481 | Mock data fallbacks |
| `frontend/src/types/index.ts` | 885 | Manual type definitions |
| `frontend/src/services/` | 36 files | API service layer |
| `frontend/src/routes/index.tsx` | 672 | All 59 routes |
| `backend/src/modules/` | 31 modules | Feature modules |
| `backend/src/migrations/` | 26 files | Database migrations |
| `backend/src/modules/ai/ai.service.ts` | 1,434 | AI provider integration |
| `backend/src/main.ts` | 162 | App bootstrap, middleware |
| `deploy/deploy.sh` | 124 | Production deployment |
| `deploy/terraform/main.tf` | 417 | AWS infrastructure |
| `.github/workflows/` | 2 files | CI + deploy pipelines |
