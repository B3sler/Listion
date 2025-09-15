# Listion 🗒️

A modern, workspace-based Todo app with visual sizing, drag & drop, and timeline-style planning.

## Overview 🧭

Listion is a modern task management application that goes beyond simple lists. It focuses on flow and clarity through visual task sizing, intuitive drag & drop, and timeline-style planning for projects.

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

- Node.js 20+ (LTS recommended)
- npm 10+

## Quickstart 🚀

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

The full API surface is documented in Swagger; endpoints may evolve while the project is in active development.

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

We welcome contributions. Please read CONTRIBUTING.md for branching, commits, and local checks. Conventional Commits are enforced via commitlint; run once to enable hooks:

```bash
npm run setup-hooks
```

## Security 🔐

Report vulnerabilities privately as described in SECURITY.md. Do not open public issues for security reports.

## License 📄

Proprietary. All rights reserved. This repository is not open for public use.


by @B3sler
