# Beitragende Richtlinien

Danke für deinen Beitrag! Bitte beachte:

- Verwende ein Feature-Branch (keine direkten Commits auf main).
- Konventionelle Commits sind empfohlen (feat:, fix:, chore:, docs:, ci:, refactor:).
- Führe lokal aus:
  - `npm ci` im Repo-Root
  - `npm run lint` und `npm run type-check`
  - `npm test`
- Halte PRs klein, mit klarer Beschreibung und Tests.

## Entwicklungs-Workflow
- Frontend: `npm run --workspace frontend dev`
- Backend: `npm run --workspace backend dev`

## Code-Stil
- EditorConfig und Prettier sind verbindlich.
- ESLint-Regeln der jeweiligen Pakete befolgen.

## Security
- Keine Secrets in Commits. Nutze .env.local/.env und GitHub Secrets.

