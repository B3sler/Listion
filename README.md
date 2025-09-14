# Listion

- Monorepo mit Workspaces: `frontend/` (Vite + Vue 3) und `backend/` (NestJS)
- Gemeinsame Root-Skripte (npm workspaces):
  - `npm run dev` startet Frontend und Backend parallel
  - `npm run build` baut alle Pakete
  - `npm run lint` / `npm run type-check` / `npm run test` laufen in allen Paketen

Backend-API:
- GET /api/ping → { ok: true, app: APP_NAME }
- GET /api/hello → { message: 'Hello from Backend' }

Hinweise:
- Dev-Proxy ist in `frontend/vite.config.ts` für `/api` → http://localhost:3000 konfiguriert.
- `.env.example` im Backend vorhanden, bei Bedarf zu `.env` kopieren.
