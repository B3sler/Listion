# Copilot Instructions for Listion

This document provides GitHub Copilot with context about the Listion project to help with better code suggestions and
assistance.

## Project Overview

**Listion** is a modern, workspace-based Todo application with visual task sizing, drag & drop functionality, and
timeline-style planning. The project is in active development and uses a monorepo structure with npm workspaces.

## Tech Stack

### Frontend

- **Framework**: Vue 3 with Composition API
- **Language**: TypeScript (strict mode)
- **Build Tool**: Vite
- **State Management**: Pinia
- **Routing**: Vue Router
- **Styling**: Tailwind CSS 4.x with PostCSS
- **Testing**: Vitest with @vue/test-utils
- **Icons**: lucide-vue-next

### Backend

- **Framework**: NestJS
- **Language**: TypeScript (strict mode)
- **ORM**: TypeORM
- **Database**: PostgreSQL 15
- **Authentication**: JWT with Passport
- **API Documentation**: Swagger/OpenAPI
- **Testing**: Jest with ts-jest

### Development Tools

- **Linting**: ESLint 9+ (flat config)
- **Formatting**: Prettier
- **Commit Hooks**: simple-git-hooks with commitlint
- **Monorepo**: npm workspaces
- **Database**: Docker Compose for PostgreSQL

## Project Structure

```
listion/
├── frontend/              # Vue 3 application
│   ├── src/
│   │   ├── components/    # Reusable Vue components (L prefix)
│   │   ├── views/         # Page components (L prefix)
│   │   ├── layout/        # Layout components (LMenu, LTaskbar)
│   │   ├── composables/   # Vue composables (useTheme)
│   │   ├── stores/        # Pinia stores
│   │   ├── router/        # Vue Router configuration
│   │   ├── helpers/       # Utility functions (API client)
│   │   └── assets/        # Static assets (CSS)
│   └── public/            # Public assets (logos, SVGs)
├── backend/               # NestJS API
│   └── src/
│       ├── modules/       # Feature modules (bit, user)
│       ├── dto/           # Data Transfer Objects
│       ├── app.module.ts  # Root module
│       └── main.ts        # Application entry point
└── package.json           # Workspace root configuration
```

## Coding Conventions

### General

- **Naming**: Use descriptive names; components use "L" prefix (e.g., `LMenu`, `LContextMenu`)
- **TypeScript**: Use strict mode; avoid `any` types
- **Imports**: Use absolute imports where configured
- **File naming**:
  - Frontend components: PascalCase with `.vue` extension
  - Backend files: kebab-case for entities/services, PascalCase for classes
  - Tests: `*.test.ts` or `*.spec.ts`

### Vue 3 (Frontend)

- Use Composition API with `<script setup>` syntax
- Define props with `defineProps<T>()` using TypeScript types
- Use `ref()` and `reactive()` for state management
- Emit events with `defineEmits<T>()`
- Use Pinia stores for global state
- Components should be self-contained and reusable
- Use Tailwind CSS classes for styling

**Example Component Structure:**

```vue

<script setup lang="ts">
  import { ref } from 'vue'

  interface Props {
    title: string
    count?: number
  }

  const props = defineProps<Props>()
  const emit = defineEmits<{
    update: [value: number]
  }>()

  const localState = ref(0)
</script>

<template>
  <div class="container">
    <h1>{{ title }}</h1>
  </div>
</template>
```

### NestJS (Backend)

- Use dependency injection throughout
- Follow NestJS module structure (controller, service, entity)
- Use DTOs for request/response validation
- Use TypeORM decorators for entities
- Document endpoints with Swagger decorators
- Use proper HTTP status codes
- Implement proper error handling

**Example Service Structure:**

```typescript
import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

@Injectable()
export class ExampleService {
  constructor(
    @InjectRepository(Entity)
    private readonly repository: Repository<Entity>,
  ) {
  }
}
```

## API Standards

### Endpoints

- Base URL (dev): `http://localhost:3000/api`
- Use RESTful conventions (GET, POST, PUT, PATCH, DELETE)
- Use plural nouns for resources (`/api/bits`, `/api/users`)
- Use kebab-case for URL paths

### Authentication

- JWT-based authentication with cookies
- Protected routes use `JwtAuthGuard`
- Auth endpoints: `/api/auth/login`, `/api/auth/register`

### Response Format

- Return consistent JSON responses
- Use proper HTTP status codes (200, 201, 400, 401, 404, 500)
- Include error messages in responses

## Database

### Schema Management

- Use TypeORM entities to define schema
- Use migrations for schema changes
- Database runs in Docker (PostgreSQL 15)
- Connection configured via environment variables

### Entity Conventions

- Use decorators: `@Entity()`, `@Column()`, `@PrimaryGeneratedColumn()`
- Define relationships: `@ManyToOne()`, `@OneToMany()`, `@ManyToMany()`
- Use proper column types

## Environment Variables

### Backend (.env)

```env
PORT=3000
NODE_ENV=development
DATABASE_HOST=localhost
DATABASE_PORT=5432
POSTGRES_DB=listion_db
POSTGRES_USER=listion_user
POSTGRES_PASSWORD=your_password
JWT_SECRET=your_jwt_secret
```

### Frontend (.env.local)

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

## Development Workflow

### Setup

```bash
# Install dependencies
npm install

# Setup git hooks
npm run setup-hooks

# Start database
docker-compose up -d
```

### Development

```bash
# Run both frontend and backend
npm run dev

# Run individually
npm run --workspace frontend dev
npm run --workspace backend dev
```

### Quality Checks

```bash
# Run all checks before committing
npm run lint          # ESLint all workspaces
npm run type-check    # TypeScript type checking
npm test              # Run all tests
npm run format        # Check formatting
```

### Testing

- Frontend: Vitest for unit and component tests
- Backend: Jest for unit and integration tests
- Write tests for new features
- Test files alongside source files or in `__tests__` directory

## Commit Guidelines

- **Use Conventional Commits**: `type(scope): description`
- **Types**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`
- **Examples**:
  - `feat(frontend): add drag and drop for tasks`
  - `fix(backend): correct user authentication flow`
  - `docs: update API documentation`

Commits are validated by commitlint via git hooks.

## Key Features to Consider

### Current Features

- Task management with visual sizing
- Drag & drop functionality
- User authentication (JWT)
- Workspace structure
- Context menu component
- Theme management (light/dark)

### Planned Features (in progress)

- Timeline-style planning
- Task dependencies
- Smart filters (status, priority, tags)
- Collaboration features

## Common Patterns

### Frontend API Calls

```typescript
// Use the API helper from helpers/api.ts
import { api } from '@/helpers/api'

// Example usage
const response = await api.get('/bits')
const newBit = await api.post('/bits', data)
```

### State Management

```typescript
// Use Pinia stores
import { defineStore } from 'pinia'

export const useExampleStore = defineStore('example', () => {
  const state = ref(initialValue)

  function action() {
    // logic
  }

  return { state, action }
})
```

### Route Guards

```typescript
// Frontend: Use navigation guards in router
router.beforeEach((to, from, next) => {
  // Check authentication, etc.
})
```

### Backend Guards

```typescript
// Use NestJS guards
@UseGuards(JwtAuthGuard)
@Controller('protected')
export class ProtectedController {
}
```

## Important Notes

- **Node Version**: Use Node.js 20+ (LTS recommended)
- **Package Manager**: Use npm (not yarn or pnpm)
- **Browser Support**: Modern browsers with ES6+ support
- **License**: Proprietary - all rights reserved
- **Security**: Report vulnerabilities privately (see SECURITY.md)

## Resources

- **API Documentation**: http://localhost:3000/api/docs (Swagger UI in dev mode)
- **Frontend**: http://localhost:5173 (Vite dev server)
- **Backend**: http://localhost:3000
- **Database**: PostgreSQL on localhost:5432

## Contact

Project maintained by @B3sler

---

When suggesting code or answering questions:

1. Follow the established patterns and conventions above
2. Use TypeScript strictly - avoid `any` types
3. Consider the monorepo structure when suggesting imports
4. Suggest proper error handling and validation
5. Include relevant tests for new features
6. Follow Vue 3 Composition API best practices
7. Use NestJS dependency injection properly
8. Consider security implications (auth, validation, sanitization)

