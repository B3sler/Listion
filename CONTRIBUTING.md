# Contributing Guide

Thanks for your interest in improving Listion. Please follow these guidelines to keep contributions smooth and consistent.

## Branching and commits
- Create feature branches; do not commit directly to `main`.
- Use Conventional Commits (e.g., `feat:`, `fix:`, `chore:`, `docs:`, `ci:`, `refactor:`).
- Enable commit hooks once locally:
  ```bash
  npm run setup-hooks
  ```

## Local setup
- Requirements: Node.js 20+ and npm 10+
- Install dependencies at the repo root:
  ```bash
  npm install
  ```

## Develop
- Run frontend and backend together:
  ```bash
  npm run dev
  ```
- Run individually:
  ```bash
  # Frontend (Vite)
  npm run --workspace frontend dev

  # Backend (NestJS)
  npm run --workspace backend dev
  ```

## Pre-submit checklist
Run these before pushing or opening a PR:
```bash
npm run lint
npm run type-check
npm test
```

Workspace-specific commands:
```bash
# Frontend
npm run --workspace frontend test       # run once
npm run --workspace frontend test:unit  # watch
npm run --workspace frontend type-check
npm run --workspace frontend build

# Backend
npm run --workspace backend test
npm run --workspace backend test:watch
npm run --workspace backend type-check
npm run --workspace backend build
```

## Code style
- ESLint and Prettier are enforced in each workspace.
- Use the provided scripts:
  ```bash
  npm run format           # run formatter across workspaces
  npm run --workspace frontend lint
  npm run --workspace backend lint
  ```
- The repo uses TypeScript strict settings.

## Pull requests
- Keep PRs focused and reasonably small.
- Provide a clear description, screenshots for UI changes, and tests where applicable.
- Link related issues.
- Ensure CI checks pass (lint, type-check, tests).

## Security
- Do not commit secrets or credentials. Use local `.env` files and GitHub Secrets.
- If you accidentally commit a secret, revoke/rotate it immediately and contact the maintainers.

## Questions
Open a discussion or reach the maintainers via support@listion.app.
