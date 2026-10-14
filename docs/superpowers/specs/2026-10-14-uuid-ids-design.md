# UUID-IDs, DB-Integrität, Migrationen und optimistisches Erstellen — Design

Datum: 2026-10-14 · Status: freigegeben

## Ziel

Alle Entitäten (User, Bit, Packet, Dependency) bekommen UUIDv7 statt fortlaufender Integer-IDs. Hauptnutzen: Der Client kann IDs selbst erzeugen, neue Bits und Pfeile erscheinen sofort auf dem Canvas. Im selben Zug: echte Fremdschlüssel und Indizes, eine initiale TypeORM-Migration als Baseline für Produktion und typisierter Zugriff auf den eingeloggten User.

Rahmen: Breaking Changes sind erlaubt, in Produktion läuft noch nichts. Bestehende Dev-Daten werden verworfen (DB neu anlegen, neu registrieren).

Erfolgskriterien:
- `npm run lint`, `type-check`, `test`, `format` grün.
- Eine leere Datenbank lässt sich allein über die Migration aufbauen; `migration:check` meldet keine Abweichung zu den Entities.
- Ein neues Bit erscheint ohne Wartezeit und lässt sich sofort ziehen, verknüpfen und löschen — ohne Fehler und ohne Zurückspringen.

Nicht-Ziele: Transaktionen für mehrstufige Packet-Operationen, Enums für `status`/`priority`, optimistisches Bilden von Packets.

## 1. ID-Format und -Vergabe

- **UUIDv7** (RFC 9562): 48-bit-Millisekunden-Zeitstempel vorne, Rest zufällig. Später erzeugte IDs sind auch als String größer — das ersetzt den bisherigen Tie-Break `a.id - b.id` bei gleicher Step-Reihenfolge.
- Generator `uuidv7()` je einmal in `backend/src/common/uuid.ts` und `frontend/src/helpers/uuid.ts` (je ~15 Zeilen, `crypto.getRandomValues`), keine neue Abhängigkeit.
- Beim Erstellen (Bit, Packet, Dependency) darf der Client `id` mitschicken (`@IsUUID('7')`, optional). Fehlt sie, vergibt der Server eine.
- Neue Zeilen werden **immer per `insert`** angelegt (`common/insert-with-id.ts`), nie per `save`: `save` mit vorhandener ID wäre ein UPDATE — auch auf Zeilen anderer User. Unique-Verletzung (Postgres `23505`) → **409 Conflict**.
- `UpdateBitDto` erbt nicht mehr das `id`-Feld (`OmitType`).
- Pfad-Parameter: `ParseUUIDPipe`. Referenzen im Body (`bitIds`, `packetId`, `fromId`, `toId`): `@IsUUID()`. Ungültige Werte → 400 statt Postgres-Fehler/500.

## 2. Schema

| Tabelle | Änderungen |
|---|---|
| `users` | `id uuid` PK |
| `bit` | `id uuid` PK; `user` → `userId uuid` FK → `users` ON DELETE CASCADE; `packetId uuid NULL` FK → `packet` ON DELETE SET NULL; Spalte `workspace` entfällt; Index auf `userId`, `packetId` |
| `packet` | `id uuid` PK; `user` → `userId uuid` FK → `users` ON DELETE CASCADE; Index auf `userId` |
| `dependency` | `id uuid` PK; `userId uuid` FK → `users` ON DELETE CASCADE; `fromId`/`toId uuid`; UNIQUE (`userId`, `fromType`, `fromId`, `toType`, `toId`) |

Die Enden einer Dependency bleiben ohne Fremdschlüssel (polymorph: Bit *oder* Packet). Das Aufräumen beim Löschen bleibt in `BitService.remove` und `PacketService.dissolve`.

Relationen werden als `@ManyToOne` + `@JoinColumn` neben der expliziten ID-Spalte modelliert (`owner`, `packet`), Typ `Relation<…>` gegen ESM-Zirkularitätsprobleme. Services arbeiten weiter nur mit den ID-Spalten.

## 3. Auth

- JWT-Payload `{ sub: string (UUID), email }`, Typ `JwtPayload`.
- `JwtAuthGuard` lehnt Tokens ab, deren `sub` keine UUID ist (alte Sessions) → 401 → Frontend landet beim Login.
- `@CurrentUserId()`-Param-Decorator ersetzt `(req as any).user.sub as number` in allen Controllern.

## 4. Migrationen

- `backend/src/data-source.ts`: DataSource-Konfiguration für die TypeORM-CLI (gleiche Entities, Env-Variablen).
- `backend/src/migrations/<timestamp>-Init.ts`: initiale Migration, **aus den Entities generiert** gegen eine leere Datenbank.
- `app.module.ts`: Migrationen explizit importiert (kein Glob), `migrationsRun: true` in Produktion. Dev behält `synchronize: true`.
- npm-Skripte im Backend: `migration:generate`, `migration:run`, `migration:check` (CLI auf dem kompilierten `dist`).
- DOCKER.md: handgeschriebenes Upgrade-SQL entfällt; stattdessen Migrations-Workflow und Dev-DB-Reset (`docker compose down -v`). CLAUDE.md entsprechend.

## 5. Frontend-Typen

- Alle IDs `string`: `Bit`, `Packet`, `Dependency`, `NodeRef`, `PacketCard.key`, `DependencyItem.id`, Funktionssignaturen in Stores/Composables/Komponenten.
- `Bit.workspace` entfällt.
- Tie-Break bei gleicher `order`: String-Vergleich der IDs (`useFlowLayout`, `useFlowState`).
- `Number(...)` auf IDs entfällt (`useFlowState.done`, `useFlowGestures` liest `data-node-id`) — TypeScript findet diese Stellen nicht, sie lieferten still `NaN`.

## 6. Optimistisches Erstellen

- **Bits** (`bitStore.createBit`) und **Dependencies** (`dependencyStore.createDependency`): ID per `uuidv7()` erzeugen, Eintrag sofort in den Store, dann POST mit `id`.
  - Erfolg: Server-Antwort wird eingemischt, aber Felder, die lokal *seit dem Erstellen* geändert wurden, bleiben lokal (kein Zurückspringen eines bereits verschobenen Bits). Liefert der Server bei einer Dependency eine andere ID (bestehender Pfeil), ersetzt diese den lokalen Eintrag.
  - Fehler: Eintrag wird entfernt, Fehler weitergeworfen (der bestehende `guarded`-Reload stellt den Server-Stand her).
- **Pending-Registry** (`frontend/src/stores/pendingCreates.ts`): `track(id, promise)` und `whenCreated(...ids)`. Jeder Request, der eine noch nicht bestätigte ID benutzt, wartet vorher darauf: `updateBit`/`deleteBit` (eigene ID und Ziel-`packetId`), `createPacket`/`setBits` (`bitIds`), `createDependency` (beide Enden), `deleteDependency`. Schlägt das Erstellen fehl, schlägt auch der wartende Request fehl.
- **Packets** schicken ihre ID mit, bleiben aber nicht-optimistisch (nach dem Bilden lädt das Layout ohnehin neu).

## 7. Tests und Verifikation

Backend (Vitest, TDD):
- `uuidv7`: Format/Version, Zeitstempel-Sortierung.
- `FakeRepository`: String-IDs, `insert` wirft bei doppelter ID einen `QueryFailedError` mit Code `23505`.
- `insertWithId`: 409 bei vergebener ID, überschreibt nie.
- Services: bestehende Specs auf String-IDs; Client-ID wird übernommen; fremde vergebene ID → 409 ohne Änderung der fremden Zeile.
- Guard: numerischer `sub` → 401.
- DTO-Validierung: `id` nur v7, Referenzen nur UUIDs, `UpdateBitDto` entfernt `id`.

Frontend (Vitest):
- Bestehende Tests auf String-IDs.
- Store: Bit erscheint vor der Server-Antwort; Rollback bei Fehler; Update auf ein pending Bit wartet auf das POST; lokale Änderung während des POST bleibt erhalten.
- Dependency: optimistisch, Rollback, Ersetzen durch Server-ID.

Abschluss: `lint`, `type-check`, `test`, `format`; Migration gegen frische DB + `migration:check`; Smoke-Test im Browser (registrieren, Bit erstellen und sofort ziehen, Packet bilden, Pfeil ziehen, löschen).

## Follow-ups

- Transaktionen für `PacketService.create`/`setBits`/`dissolve` und `BitService.remove`.
