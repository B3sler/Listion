# Taskbar-Werkzeuge: Flow & Filter — Design

Datum: 2026-10-14 · Status: abgestimmt · Branch: `feat/taskbar-tools`

## Ziel

Die Taskbar oben bekommt die ersten Werkzeuge für den Canvas:

1. **Flow**: beliebige Bits und Stapel mit einem Lasso einkreisen. Sie werden als benannter, dezent getönter Rahmen dargestellt.
2. **Filter**: zeigt nur Bits, die zu Workflow-Zustand, Priorität oder Fälligkeit passen. Der Rest wird abgedunkelt.

Erfolgskriterien:

- Ein Flow entsteht mit einer einzigen Lasso-Geste. Danach lässt er sich benennen, umfärben, verschieben und auflösen, ohne ein Panel zu öffnen.
- Mit zwei Klicks im Filter sieht man „was kann jetzt losgehen“ (Ready) oder „was ist heute fällig“.
- Das bestehende Taskbar-Design bleibt unverändert: Reiter, Farben, Schatten, geschwungene Ecken und das Logo exakt mittig.

Nicht-Ziele (v1): verschachtelte Flows, ein Element in mehreren Flows, Pfeile von oder zu Flows, Flow-Fortschritt im HUD, Filter nach Status oder Titel, Mehrfachauswahl im Auswählen-Modus.

## Begriffe

- **Werkzeug-Modus**: `select` (Standard) oder `flow`. Der Filter ist kein Modus, sondern ein Popover.
- **Flow**: benannte Gruppe aus losen Bits und Stapeln, mit Farbe. Ein loses Bit oder ein Stapel gehört zu höchstens einem Flow. Bits in einem Stapel gehören über den Stapel dazu.
- **Mitglied**: loses Bit oder Stapel mit `flowId`.

## Taskbar

- `LTaskbar.vue` behält Struktur und Klassen. Das sind die beiden Eck-SVGs, der mittlere Reiter `flex-[0.7] … rounded-b-2xl bg-taskbar shadow-lg` und das Logo-`<img>`.
- Der Inhalt des Reiters wird ein dreispaltiges Raster (`1fr auto 1fr`):
  - links die Werkzeug-Buttons **Auswählen** (Lucide `MousePointer2`) und **Flow** (Lucide `Lasso`)
  - in der Mitte das Logo, unverändert
  - rechts **Filter** (Lucide `ListFilter`)
- Button-Farbe folgt dem Kontrast des Logos:
  - Hell-Modus: dunkler Reiter, helle Icons
  - Dunkel-Modus: heller Reiter, dunkle Icons
- Buttons sind 32 px groß mit 10 px Radius.
- Das aktive Werkzeug bekommt eine dezente Pille: Icon-Farbe mit 16 % Deckkraft als Hintergrund.
- Der Filter-Button zeigt einen Zähler (Badge, Brand-Farbe), wenn Filter aktiv sind. Ist das Popover offen, wird er wie aktiv dargestellt.
- Tastatur, nur wenn kein Eingabefeld fokussiert ist:
  - `V` → Auswählen
  - `F` → Flow
  - `Esc` → zurück zu Auswählen und Popover schließen
- Barrierefreiheit:
  - Buttons haben `aria-label`, Werkzeug-Buttons zusätzlich `aria-pressed`.
  - Der Filter-Button hat `aria-expanded`.
  - `title` zeigt Name und Kürzel, z. B. „Flow (F)“.

## Flow-Werkzeug

- Im Modus `flow` wird der Canvas-Cursor zum Fadenkreuz.
- Ein Links-Drag auf freier Fläche oder über Elementen zeichnet ein freies Lasso. Die Linie ist gestrichelt, Farbe `#a5b4fc`, 1,5 px, und folgt dem Pointer 1:1. Gezeichnet wird in Canvas-Koordinaten.
- Mausrad-Pan, Pinch und Shift- oder Mittelklick-Pan funktionieren weiter. Bits, Stapel und Pfeile reagieren im Flow-Modus nicht auf Drag.
- Beim Loslassen wird das Lasso als geschlossenes Polygon ausgewertet. Mitglied wird:
  - jedes lose Bit, dessen Kapsel-Mittelpunkt im Polygon liegt
  - jeder Stapel, dessen Rechteck-Mittelpunkt im Polygon liegt
- Mindestens ein Treffer:
  - Der Flow wird angelegt, Name „Flow N“, Standardfarbe Indigo.
  - Danach wechselt der Modus zurück zu `select`.
  - Treffer, die schon in einem anderen Flow waren, wechseln in den neuen. Bleibt der alte leer, wird er gelöscht.
- Kein Treffer, oder das Lasso ist kürzer als 10 px Pfad: Nichts passiert, der Modus bleibt `flow`.
- `Esc` während des Ziehens bricht ab.

## Flow auf dem Canvas

### Darstellung (Stufe „dezent“)

- Der Rahmen ist das umschließende Rechteck aller Mitglieder, mit 24 px Innenabstand rundum und oben zusätzlich 8 px für das Namensschild. Der Radius ist 22 px.
- Linie: 1 px, Flow-Farbe mit 28 % Deckkraft.
- Füllung: Flow-Farbe mit 4,5 % Deckkraft.
- Der Rahmen liegt unter Pfeilen, Stapeln und Kapseln und über dem Canvas-Hintergrund.
- Das **Namensschild** sitzt auf der oberen Rahmenlinie, 20 px vom linken Rand:
  - 11,5 px, Gewicht 600
  - Text in der Flow-Farbe gemischt mit `--text1`, Deckkraft 85 %
  - Hintergrund in Canvas-Farbe (`--surface1`), damit die Linie hinter dem Text unterbrochen ist
- Der Rahmen bewegt sich und wächst mit, live auch während ein Mitglied gezogen wird. Gleiche Spring-Transition wie bei Stapeln.

### Farben

Sechs dezente Farben: Indigo `#818cf8` (Standard), Grün `#34d399`, Bernstein `#fbbf24`, Pink `#f472b6`, Himmelblau `#38bdf8`, Grau `#a3a3a3`.

### Bedienung

- **Klick auf den Namen** öffnet ein Inline-Eingabefeld (max. 60 Zeichen). Enter oder Blur speichert, Esc bricht ab, ein leerer Name wird verworfen.
- **Hover über den Namen** (oder Fokus) blendet darüber eine kleine Material-Leiste ein:
  - die sechs Farbtupfer; die aktive Farbe hat einen Ring
  - ein Knopf **„Flow auflösen“** (Lucide `Ungroup`): Der Flow wird gelöscht, die Mitglieder bleiben an ihrem Platz.
  - Die Leiste bleibt offen, solange der Pointer über Name oder Leiste ist, plus 200 ms Nachlauf.
- **Ziehen der freien Rahmenfläche** im Modus `select`, also ein Pointer auf dem Rahmen, nicht auf einem Element:
  - verschiebt alle Mitglieder gemeinsam, 1:1, mit Momentum beim Loslassen (wie bei Stapeln)
  - gespeichert werden die neuen Positionen der losen Bits und der Stapel
- **Mitgliedschaft per Ziehen** im Modus `select`:
  - Ein loses Bit, das außerhalb des Rahmens seines Flows abgelegt wird, verlässt den Flow. Maßgeblich ist der Kapsel-Mittelpunkt.
  - Ein loses Bit oder ein Stapel, dessen Mittelpunkt beim Ablegen in einem Flow-Rahmen liegt, tritt diesem Flow bei. Bei Überlappung gewinnt der zuletzt angelegte Flow.
  - Gemessen wird gegen den Rahmen vor dem Drag, sonst würde der Rahmen dem gezogenen Mitglied hinterherwachsen.
  - Für Stapel gilt dasselbe beim Ablegen nach einem Kopf-Drag.
  - Ein Snap-Drop in einen Stapel ändert keine Flow-Mitgliedschaft direkt. Das Bit gehört danach über den Stapel dazu.
- Zieht man ein Bit aus einem Stapel heraus, verhält es sich nach der Ablage wie ein loses Bit (siehe oben).
- **Ein leerer Flow** (kein Mitglied mehr) wird serverseitig gelöscht.

## Filter-Werkzeug

- Klick auf den Filter-Button öffnet ein Popover unter dem Reiter, rechtsbündig zum Button.
  - Material wie die Menüs, Spring-Einblendung vom Button aus
  - ein erneuter Klick, Klick außerhalb oder `Esc` schließen es
- Drei Chip-Gruppen, Mehrfachauswahl:
  - **Workflow**: Ready, Blocked (aus `computeFlowState`)
  - **Priorität**: High, Medium, Low
  - **Fällig**:
    - Überfällig: `dueDate` vor heute 00:00
    - Heute: `dueDate` am heutigen Kalendertag
    - Diese Woche: `dueDate` von heute bis einschließlich Sonntag dieser Woche, Woche Montag bis Sonntag, lokale Zeit
- Ein Bit passt, wenn es in **jeder** Gruppe mit aktiver Auswahl mindestens eine gewählte Option erfüllt. Innerhalb einer Gruppe gilt ODER, zwischen Gruppen UND. Ohne aktive Auswahl passt jedes Bit.
- Nicht passende Bits werden abgedunkelt (`dimmed`, wie bei der HUD-Hervorhebung), nicht ausgeblendet.
  - In Stapeln dimmen nur die einzelnen Schritte, der Stapel selbst bleibt.
  - Ein Pfeil dimmt, wenn keines seiner Enden passt. Ein Packet-Ende passt, wenn mindestens ein Schritt passt.
  - Flow-Rahmen werden nicht gedimmt.
- Filter und HUD-Hervorhebung wirken zusammen: Abgedunkelt ist, was eines von beiden ausschließt.
- „Zurücksetzen“ im Popover leert alle Gruppen.
- Der Badge-Zähler entspricht der Zahl gewählter Optionen.
- Die Filterauswahl wird pro Browser in `localStorage` gespeichert (Schlüssel `listion-filter`). Lese- und Schreibfehler werden ignoriert.

## Datenmodell

### `flow` (neu)

| Feld | Typ | Hinweis |
|---|---|---|
| id | int PK | |
| user | int | Owner aus JWT |
| name | varchar(60) | Standard „Flow N“ |
| color | varchar(7) | `#rrggbb`, Standard `#818cf8` |
| createdAt | timestamp | |

### Erweiterungen

- `bit.flowId` int, nullable. Nur für lose Bits relevant; Bits in Stapeln haben `flowId = null`.
- `packet.flowId` int, nullable.

### Regeln (serverseitig)

1. Tritt ein Bit einem Stapel bei, wird sein `flowId` auf `null` gesetzt. Das gilt für `assign` in create/setBits und für `attachBit`. Das Bit gehört danach über den Stapel zum Flow.
2. Wird ein Stapel aufgelöst, bekommen die frei werdenden Bits den `flowId` des Stapels.
3. Nach jeder Änderung an einer Mitgliedschaft wird ein Flow ohne Mitglieder gelöscht. Mitglieder sind lose Bits und Stapel mit diesem `flowId`. Auslöser sind Flow anlegen, Bit oder Packet mit `flowId` aktualisieren, Bit oder Packet löschen und Stapel auflösen.
4. `flowId` muss ein Flow desselben Users sein, sonst `404`.

## API

Alle Endpunkte haben `@UseGuards(JwtAuthGuard)` auf Controller-Ebene und lesen userId aus `req.user.sub`. Jede Abfrage prüft den Owner. DTOs nutzen class-validator, alle Endpunkte haben Swagger-Doku und `@Throttle` mit 300/min wie die anderen CRUD-Controller.

- `GET /api/flow`: alle Flows des Users.
- `POST /api/flow` mit `{ name?, color?, bitIds: number[], packetIds: number[] }`:
  - mindestens 1 Mitglied insgesamt, sonst `400`
  - Bits in einem Stapel werden abgelehnt (`400`); das Frontend schickt nur lose Bits
  - legt den Flow an und setzt `flowId` aller Mitglieder; danach gilt Regel 3 für deren alte Flows
- `PUT /api/flow/:id` mit `{ name?, color? }`.
- `DELETE /api/flow/:id`: setzt `flowId` aller Mitglieder auf `null` und löscht den Flow.
- `PUT /api/bit/:id` akzeptiert zusätzlich `flowId: number | null`. Ein Bit in einem Stapel mit `flowId ≠ null` gibt `400`.
- `PUT /api/packet/:id` akzeptiert zusätzlich `flowId: number | null`.

## Frontend-Struktur

| Einheit | Aufgabe |
|---|---|
| `stores/toolStore.ts` | aktives Werkzeug (`select`/`flow`), Filter-Popover offen, Filterauswahl inkl. localStorage |
| `stores/flowStore.ts` | API-Zugriff für Flows |
| `composables/useFlowGroups.ts` | reine Funktionen: Rahmen je Flow aus dem Layout, Punkt-in-Polygon, Lasso-Treffer, Flow unter einem Punkt |
| `composables/useFilter.ts` | reine Funktion: passt ein Bit zur Filterauswahl (inkl. Fälligkeits-Logik mit injizierbarem „heute“) |
| `components/LFlowFrame.vue` | Rahmen, Namensschild mit Inline-Umbenennen, Hover-Leiste (Farben, Auflösen), meldet Drag-Start auf der freien Fläche |
| `components/LFilterPopover.vue` | Chip-Gruppen, Zurücksetzen |
| `components/LLassoOverlay.vue` | zeichnet die Lasso-Spur |
| `layout/LTaskbar.vue` | Werkzeug-Buttons links/rechts, Logo unverändert in der Mitte |
| `composables/useFlowGestures.ts` | erweitert um Lasso-Geste und Flow-Rahmen-Drag |
| `composables/useFlowActions.ts` | erweitert um Flow anlegen, umbenennen, umfärben, auflösen, verschieben und Mitgliedschaft nach Drops |
| `views/LWorkspace.vue` | bindet Werkzeug-Modus, Lasso, Rahmen, Filter-Dimmen und Kürzel ein |

## Fehlerbehandlung

Wie bisher: Schlägt eine API-Operation fehl, lädt der Client Bits, Packets, Dependencies und Flows atomar neu und loggt den Fehler. Ungültige Eingaben lehnt der Server mit `400` ab, fremde oder unbekannte IDs mit `404`.

## Tests

- **Backend (Vitest, FakeRepository)**:
  - Flow anlegen inkl. Umzug aus einem alten Flow und Löschen des alten leeren Flows
  - Bit in einem Stapel wird abgelehnt
  - `PUT flowId` setzen und entfernen; der leere Flow wird gelöscht
  - ein Bit, das einem Stapel beitritt, verliert `flowId`
  - beim Auflösen eines Stapels erben die Bits den `flowId`
  - DELETE behält die Mitglieder
  - Owner-Checks, DTO-Validierung (Farbe `#rrggbb`, Name 1–60)
- **Frontend (Vitest)**:
  - `useFlowGroups`: Rahmen-Geometrie, Punkt-in-Polygon (konvex und konkav), Lasso-Treffer für Bit und Stapel, Flow unter einem Punkt, bei Überlappung der jüngste
  - `useFilter`: jede Gruppe, ODER innerhalb und UND zwischen Gruppen, Fälligkeitsgrenzen mit festem „heute“
  - `toolStore`: Kürzel-Logik, localStorage robust gegen Fehler
  - Komponenten: Taskbar (Buttons, `aria-pressed`, Badge), LFlowFrame (Umbenennen, Farbwahl, Auflösen), LFilterPopover (Chips, Zurücksetzen)
  - Gesten (Lasso erzeugt Flow-Callback, Rahmen-Drag)
  - Workspace-Smoke-Test
- **Manuell im Browser**:
  - Lasso um zwei Bits und einen Stapel → Flow
  - umbenennen, umfärben
  - Rahmen ziehen; Bit herausziehen, Bit hineinziehen
  - Stapel im Flow auflösen
  - Filter Ready, High, Heute
  - Hell- und Dunkel-Modus, Kürzel V/F/Esc

## Offene Punkte für später

- Pfeile auf Flows
- Flow-Fortschritt und eine Liste der Flows im HUD
- Mehrfachauswahl im Auswählen-Modus
- Filter nach Status oder Text
- Lasso auf Touch mit zwei Fingern zum Abbrechen
