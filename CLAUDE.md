# CLAUDE.md — Listion

## Project Overview

**Listion** is a workspace-based Todo application with visual task sizing, drag & drop, and timeline-style planning. Monorepo with npm workspaces. Maintained by @B3sler.

## Tech Stack

### Frontend
- Vue 3 + Composition API (`<script setup>`)
- TypeScript (strict)
- Vite + Tailwind CSS 4.x
- Pinia (state), Vue Router, lucide-vue-next
- Vitest + @vue/test-utils

### Backend
- NestJS + TypeScript (strict)
- TypeORM + PostgreSQL 15
- JWT authentication via httpOnly cookies
- Swagger/OpenAPI (`/api/docs`)
- Jest + ts-jest

### Tooling
- ESLint 9 (flat config), Prettier
- commitlint + simple-git-hooks (Conventional Commits enforced)
- npm workspaces (not yarn/pnpm)
- Node 20+

## Project Structure

```
listion/
├── frontend/src/
│   ├── components/   # Reusable components (L prefix, e.g. LMenu)
│   ├── views/        # Page components (L prefix)
│   ├── layout/       # LMenu, LTaskbar
│   ├── composables/  # useTheme, etc.
│   ├── stores/       # Pinia stores
│   ├── router/       # Vue Router
│   └── helpers/      # API client (api.ts)
├── backend/src/
│   ├── modules/      # Feature modules: bit/, user/
│   ├── dto/          # DTOs (create-bit.dto.ts, update-bit.dto.ts)
│   ├── app.module.ts
│   └── main.ts
├── docker-compose.yml       # Development
├── docker-compose.prod.yml  # Production
└── package.json             # Workspace root
```

## Docker Setup

### Development (with hot-reload)
```bash
docker compose down
npm install          # host install required after new dependencies
docker compose up -d --build
```

Hot-reload works via bind-mount + polling (Vite: `usePolling: true`, ts-node-dev: `--poll`).

After adding new npm packages always run `npm install` on the host before restarting containers.

### Production
```bash
docker compose -f docker-compose.prod.yml up -d
```

Requires `.env` with real secrets (see below). `synchronize` is disabled in production.

## Environment Variables

All required. No insecure fallbacks in code. Use `.env.example` as template.

```env
DB_PASS=...
DB_HOST=localhost
DB_PORT=5432
DB_USER=listion_user
DB_NAME=listion
JWT_SECRET=...          # min. 256-bit random (openssl rand -hex 32)
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
PORT=3000
```

## Coding Conventions

### General
- Strict TypeScript — avoid `any`
- Components: `L` prefix, PascalCase `.vue` (e.g. `LBitCard.vue`)
- Backend files: kebab-case filenames, PascalCase classes
- Tests: `*.test.ts` / `*.spec.ts`

### Vue 3 Frontend
- Always `<script setup lang="ts">`
- Props: `defineProps<Props>()`
- Emits: `defineEmits<{ eventName: [payload] }>()`
- Global state via Pinia stores
- API calls via `import { api } from '@/helpers/api'`

### NestJS Backend
- Every module: controller → service → entity
- DTOs for all request bodies
- Swagger decorators on all endpoints (`@ApiTags`, `@ApiOperation`, `@ApiResponse`)
- Proper HTTP status codes

## Security Patterns (enforced)

- **All `/api/bit/*` endpoints require `@UseGuards(JwtAuthGuard)`** — applied at controller level
- **userId always from JWT** (`req.user.sub`), never accepted from request body
- **Ownership check on every bit operation** — service filters by `{ id, user: userId }`
- **Auth endpoints** rate-limited to 10 req/min via `@Throttle`
- **Global rate limit**: 60 req/min (ThrottlerGuard as APP_GUARD)
- **Helmet** active in `main.ts` for security headers
- `synchronize: true` only in non-production
- bcrypt rounds: 12

## API

- Base URL (dev): `http://localhost:3000/api`
- Swagger UI: `http://localhost:3000/api/docs`
- Auth: JWT in httpOnly cookie (`access_token`)
- RESTful, plural nouns, kebab-case paths

### Auth Endpoints
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET  /api/auth/me` — requires auth
- `POST /api/auth/logout`

## Commit Guidelines

Conventional Commits, enforced by commitlint:

```
feat(frontend): add drag and drop for tasks
fix(backend): correct ownership check in bit service
refactor(docker): simplify dev setup
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`

## Quality Checks

```bash
npm run lint         # ESLint all workspaces
npm run type-check   # TypeScript across workspaces
npm test             # Jest + Vitest
npm run format       # Prettier check
```

Run before every commit.

## Key Notes for Claude

- Do **not** commit automatically — the user commits manually
- Do not add fallback values for secrets (`JWT_SECRET`, `DB_PASS`) — fail fast is intentional
- When adding a new API endpoint, always add `@UseGuards(JwtAuthGuard)` unless it's explicitly public (login/register)
- User ID must always come from the JWT payload (`req.user.sub`), never from the request body
- `docker-compose.prod.yml` uses the full multi-stage Dockerfile — no `.prod` Dockerfiles exist
- Frontend dev port: 5173, Backend dev port: 3000, Postgres: 5432
