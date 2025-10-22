<img src="../frontend/public/listion/listion_written_light.svg" alt="Listion Backend" height="120" />

# Listion Backend

The backend of Listion is built with NestJS and provides a modern API for task management and workspace features.

## Features ✨

- REST API for tasks, users, and workspaces
- JWT authentication
- Swagger/OpenAPI documentation
- Project structure ready for future collaboration

## Tech Stack 🛠️

- NestJS (TypeScript)
- Swagger/OpenAPI
- Jest for testing
- ESLint, Prettier

## Requirements ⚙️

- Node.js 20+
- npm 10+

## Quickstart 🚀

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## Scripts 🔧

- `npm run dev` – Dev server (http://localhost:3000)
- `npm run build` – Build for production
- `npm test` – Unit tests with Jest
- `npm run lint` – Linting
- `npm run type-check` – TypeScript type checking

## Example Endpoints

- `GET /api/ping` → { ok: true, app: APP_NAME }
- `GET /api/hello` → { message: 'Hello from Backend' }

## Environment Variables

- `APP_NAME` (Default: Listion)
- `PORT` (Default: 3000)

```bash
cp .env.example .env
npm install
npm run dev
```

## API Documentation 📚

Listion Backend provides interactive API documentation via Swagger/OpenAPI. After starting the development server, the
documentation is available at:

- [http://localhost:3000/api](http://localhost:3000/api)

Here you can test all endpoints and view their data structures.

---

For more information and the full project, see the [root README](../README.md)
