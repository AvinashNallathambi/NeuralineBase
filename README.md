<div align="center">

# Neuraline EMR

<img src="docs/assets/neuraline-logo.png" alt="Neuraline EMR Logo" width="200" />

**Next-Generation Electronic Medical Records Platform**

An AI-powered, cloud-native EMR system designed for modern healthcare workflows — built for speed, interoperability, and clinical intelligence.

[![CI/CD](https://github.com/your-org/neuraline/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/neuraline/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

---

## Tech Stack

| Layer          | Technology                              |
| -------------- | --------------------------------------- |
| **Frontend**   | React 18, TypeScript, Vite, TailwindCSS |
| **Backend**    | NestJS, TypeScript, TypeORM             |
| **Database**   | PostgreSQL 15                           |
| **Cache**      | Redis 7                                 |
| **Search**     | OpenSearch 2.x                          |
| **Auth**       | JWT + RBAC                              |
| **CI/CD**      | GitHub Actions, Docker, Vercel          |
| **Monitoring** | OpenSearch Dashboards                   |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20.x
- [npm](https://www.npmjs.com/) >= 10.x
- [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/) (for containerised development)
- [Git](https://git-scm.com/)

### Clone the Repository

```bash
git clone https://github.com/your-org/neuraline.git
cd neuraline
```

### Install Dependencies

```bash
# Install all workspace dependencies from the root
npm install
```

### Environment Variables

Copy the example environment files and update values as needed:

```bash
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
```

### Run in Development Mode

```bash
# Start both frontend and backend concurrently
npm run dev

# Or start them individually
npm run dev:frontend   # React app on http://localhost:3000
npm run dev:backend    # NestJS API on http://localhost:4000
```

---

## Docker Setup

Spin up the entire stack (frontend, backend, Postgres, Redis, OpenSearch) with a single command:

```bash
# Build and start all services
docker compose up --build

# Run in detached mode
docker compose up -d --build

# Stop all services
docker compose down

# Stop and remove volumes (clean slate)
docker compose down -v
```

### Service URLs

| Service                | URL                          |
| ---------------------- | ---------------------------- |
| Frontend               | http://localhost:3000         |
| API Gateway            | http://localhost:4000         |
| PostgreSQL             | localhost:5432                |
| Redis                  | localhost:6379                |
| OpenSearch             | http://localhost:9200         |
| OpenSearch Dashboards  | http://localhost:5601         |

---

## Project Structure

```
neuraline/
├── frontend/                   # React + Vite frontend
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   ├── pages/              # Page-level components
│   │   ├── hooks/              # Custom React hooks
│   │   ├── services/           # API client & services
│   │   ├── store/              # State management
│   │   ├── types/              # TypeScript type definitions
│   │   └── utils/              # Utility functions
│   ├── Dockerfile
│   ├── nginx.conf
│   └── vercel.json
├── backend/                    # NestJS API server
│   ├── src/
│   │   ├── modules/            # Feature modules
│   │   ├── common/             # Shared guards, pipes, filters
│   │   ├── config/             # Configuration module
│   │   └── main.ts             # Application entry point
│   └── Dockerfile
├── .github/workflows/          # CI/CD pipelines
├── docker-compose.yml          # Local development orchestration
├── package.json                # Root workspace configuration
└── README.md
```

---

## Core Modules

- **Patient Management** — Demographics, medical history, insurance
- **Clinical Documentation** — SOAP notes, assessments, plans with AI-assisted drafting
- **Scheduling** — Appointment booking, provider calendars, waitlists
- **Orders & Results** — Lab orders, imaging, referrals, result tracking
- **Prescriptions (eRx)** — Electronic prescribing with drug-interaction checks
- **Billing & Claims** — CPT/ICD coding, claim submission, ERA processing
- **Analytics & Reporting** — Clinical dashboards, population health metrics
- **FHIR Interoperability** — HL7 FHIR R4 API for data exchange
- **Role-Based Access Control** — Granular permissions per user role
- **Audit Logging** — HIPAA-compliant audit trail for all data access

---

## Contributing

We welcome contributions! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'feat: add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

Please ensure:
- All tests pass (`npm test`)
- Linting passes (`npm run lint`)
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/)

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

Built with care for healthcare professionals.

</div>
