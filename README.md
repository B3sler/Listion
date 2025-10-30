<img src="frontend/public/listion/listion_written_light.svg" alt="Listion" width="auto" height="150" />

# Listion

A modern, workspace-based Todo app with visual sizing, drag & drop, and timeline-style planning.

## Overview 🧭

Listion is a modern task management application that goes beyond simple lists. It focuses on flow
and clarity through visual task sizing, intuitive drag & drop, and timeline-style planning for
projects.

## Key features ✨

- Drag & drop for tasks and groups
- Visual task sizing for quick effort estimation
- Timeline-style planning and basic dependency links
- Smart filters (status, priority, tags)
- Workspace-ready structure for future collaboration

Note: This repository is under active development. Some features are planned or in progress.

## Tech stack 🛠️

- Frontend: Vue 3, TypeScript, Vite, Pinia, Vue Router
- Backend: NestJS (TypeScript) with Swagger/OpenAPI
- Monorepo: npm workspaces (frontend, backend)
- Quality: ESLint, Prettier, TypeScript strict
- Tests: Vitest (frontend), Jest (backend)

## Requirements ⚙️

### Local Development
- Node.js 20+ (LTS recommended)
- npm 10+

### Docker Setup (Recommended)
- Docker 20.10+
- Docker Compose 2.0+

## Getting Started

You can run Listion in two ways:

### Option 1: Docker (Recommended) 🐳

Run the complete application stack with Docker. See [DOCKER.md](DOCKER.md) for detailed instructions.

**Quick Start (Easiest):**
```bash
# Clone the repository
git clone https://github.com/B3sler/Listion.git
cd Listion

# Run the quick start script - it handles everything automatically
./docker-start.sh
```

**Manual Start:**
```bash
# Clone and setup
git clone https://github.com/B3sler/Listion.git
cd Listion

# Install dependencies
npm install

# Start all services (database, backend, frontend)
docker compose up -d
```

Access the application:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000/api
- **Swagger UI**: http://localhost:3000/api/docs

### Option 2: Local Development 🔧

For local development without Docker (database still runs in Docker):

```bash
# Clone and install
git clone https://github.com/B3sler/Listion.git
cd Listion
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Start PostgreSQL database only
docker-compose up -d postgres

# Run frontend and backend (in separate terminals or use npm run dev)
npm run dev
```

## Database setup 🗄️

### With Docker Compose (Both Options)

The application uses PostgreSQL as its database. Default credentials are configured automatically:

```bash
# Start the PostgreSQL database only
docker compose up -d postgres

# Check if the database is running
docker compose ps

# Stop the database
docker compose down

# Stop and remove all data
docker compose down -v
```

The database will be available at `localhost:5432` with these default credentials:
- Database: `listion`
- User: `listion_user`
- Password: `changeme`

To customize, create a `.env` file (copied from `.env.example`) with your preferred values.

## Quickstart 🚀

For local development (Option 2):

```bash
# Clone and install
git clone https://github.com/B3sler/Listion.git
cd Listion
npm install

# Run frontend and backend together
npm run dev
```

### Run individually 🔧

```bash
# Frontend (Vite dev server)
npm run --workspace frontend dev

# Backend (NestJS dev)
npm run --workspace backend dev
```

## Docker Commands 🐳

See [DOCKER.md](DOCKER.md) for comprehensive Docker documentation.

```bash
# Quick start (handles everything)
./docker-start.sh

# Or manual start
npm install
docker compose up -d

# Stop services
docker compose down

# View logs
docker compose logs -f

# Rebuild after changes
docker compose build
```

## Common tasks 🧰

```bash
# Build all workspaces
npm run build

# Lint all workspaces
npm run lint

# Type-check all workspaces
npm run type-check

# Test all workspaces (CI mode)
npm test
```

### Frontend specifics 🖥️

```bash
# Unit tests
npm run --workspace frontend test       # run once
npm run --workspace frontend test:unit  # watch mode

# Type-check and build
npm run --workspace frontend type-check
npm run --workspace frontend build
```

### Backend specifics 🗄️

```bash
# Unit tests
npm run --workspace backend test
npm run --workspace backend test:watch

# Type-check and build
npm run --workspace backend type-check
npm run --workspace backend build
```

## API docs 📚

- Base URL (dev): http://localhost:3000/api
- Swagger UI (dev): http://localhost:3000/api/docs

The full API surface is documented in Swagger; endpoints may evolve while the project is in active
development.

## Configuration ⚙️

Create local environment files as needed:

- Frontend (.env.local)
  - VITE_API_BASE_URL=http://localhost:3000/api
- Backend (.env)
  - PORT=3000
  - NODE_ENV=development

Keep secrets out of version control; use .env files and GitHub secrets.

## Project structure 🗂️

```
listion/
├── frontend/                 # Vue 3 app (Vite, TypeScript)
├── backend/                  # NestJS API (TypeScript)
├── package.json              # npm workspaces root
└── README.md
```

## Contributing 🤝

We welcome contributions. Please read CONTRIBUTING.md for branching, commits, and local checks.
Conventional Commits are enforced via commitlint; run once to enable hooks:

```bash
npm run setup-hooks
```

## Security 🔐

Report vulnerabilities privately as described in SECURITY.md. Do not open public issues for security
reports.

## License 📄

Proprietary. All rights reserved. This repository is not open for public use.

---

```
by @B3sler
```
