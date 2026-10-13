# Bit & Packet Flow — Design

Datum: 2026-10-13 · Status: abgestimmt, erste Version · Branch: `feat/bit-packet-flow`

## Ziel

Bits und Packets werden neu gedacht, damit man auf dem Canvas Aufgabenflows modellieren kann.

Probleme heute (vom Nutzer genannt):

1. Der Flow ist schwer lesbar: Reihenfolge und „was ist als Nächstes dran“ sind nicht auf einen Blick erkennbar.
2. Verbinden ist umständlich: Kante-an-Kante-Snappen an 8 Achteck-Seiten ist fummelig.
3. Das Achteck wirkt überladen; der Look soll ruhig und klar sein (Apple-Design, wie der Rest der App).

Erfolgskriterien für die erste Version:

- Ein Flow aus mehreren Schritten lässt sich in wenigen Gesten bauen (Kapseln stapeln, Pfeile ziehen).
- Reihenfolge, „ready“ und „blocked“ sind ohne Hovern ablesbar.
- Bestehende Funktionen bleiben grob erhalten: Bits anlegen/bearbeiten/löschen, Status, Farbe, Priorität, Datum, Notizen, Fortschritt je Packet, Zyklen-Erkennung, Packets-HUD, Hervorheben.

Nicht-Ziele (v1): Mehrfachauswahl, Undo, Auto-Layout ganzer Flows, Packets in Packets, Migration alter Daten.

## Begriffe

- **Bit**: eine Aufgabe. Erscheint als **Kapsel**.
- **Packet**: ein **Stapel** aus mindestens 2 Bits in fester Reihenfolge. Der Stapel *ist* das Packet.
- **Lose Kapsel**: ein Bit ohne Packet, frei auf dem Canvas.
- **Dependency (Pfeil)**: „Ziel wartet auf Quelle“. Quelle und Ziel sind jeweils ein Bit oder ein Packet.

## Look & Bedienung

### Kapsel (Bit)

- Höhe 32 px, voll abgerundet, Glas-Material; links ein Status-Punkt (○ offen, ◐ in Arbeit, ✓ erledigt) in der Bit-Farbe, daneben der Titel (eine Zeile, max. 240 px, Ellipse).
- **Antippen** wählt die Kapsel aus; sie klappt per Spring auf und zeigt eine zweite Zeile mit Datum · Priorität · Anzahl Notiz-Zeilen. Tippen auf den Canvas hebt die Auswahl auf.
- **Doppelklick** (oder Enter bei Auswahl) öffnet das bestehende Detail-Panel `LBitPanel` (Bearbeiten, Löschen).
- Zustände: *ready* = grüner Ring; *blocked* = 55 % Deckkraft + Schloss-Icon; *in Zyklus* = orangefarbener Ring.
- Ziehen: 1:1 mit Pointer Capture, Anheben beim Drücken, Momentum beim Loslassen (bestehende Helfer aus `helpers/motion.ts`).

### Stapel (Packet)

- Glas-Gruppe (Radius 20 px, Innenabstand 8 px).
- **Kopf**: Name (Doppelklick = umbenennen, inline), rechts „erledigt / gesamt“, darunter ein 3-px-Fortschrittsbalken.
- **Schritte**: nummeriert (1, 2, 3 …), Kapseln untereinander mit 4 px Abstand.
- Den Stapel verschiebt man am **Kopf**; alle Schritte bewegen sich mit.

### Snappen (Stapel bilden und ändern)

Beim Ziehen einer Kapsel wird laufend ein **Snap-Ziel** bestimmt:

| Situation | Ziel | Hinweis |
|---|---|---|
| Pointer über einem Stapel (Bounding Box + 16 px) | Einfügen an Index *i*, berechnet aus der Pointer-Höhe relativ zu den Schritt-Zeilen | leuchtende Einfügelinie zwischen den Schritten |
| Pointer innerhalb 24 px unter/über einer losen Kapsel | Neues Packet aus beiden (gezogene Kapsel darunter bzw. darüber) | Ziel-Kapsel leuchtet, Einfügelinie |
| sonst | kein Ziel | — |

Beim Loslassen:

- **Ziel Stapel**: Kapsel wird an Index *i* eingereiht (auch Umsortieren innerhalb desselben Stapels).
- **Ziel lose Kapsel**: neues Packet mit beiden Bits, Position = Position der Ziel-Kapsel, Name „Packet N“.
- **Kein Ziel**: Kapsel wird lose an der Ablageposition. Kam sie aus einem Stapel, verlässt sie ihn.
- Ein Packet hat immer mindestens 2 Bits. Fällt es auf 1 Bit, **löst es sich auf**: Das verbleibende Bit wird eine lose Kapsel an seiner bisherigen Bildschirmposition, das Packet wird gelöscht (inkl. seiner Pfeile).

Animationen: Schritte weichen per Spring aus, wenn eine Kapsel über einem Stapel schwebt; die abgelegte Kapsel federt in ihre Zeile (kritisch gedämpft, nach Wurf leicht nachfedernd).

### Pfeile (Dependencies)

- Beim Hover erscheint rechts an einer Kapsel bzw. am Stapel-Kopf ein kleiner runder **Griff**.
- Vom Griff ziehen → eine Linie folgt dem Pointer. Ablegen auf einer Kapsel = Ziel Bit; Ablegen auf einem Stapel-Kopf oder -Rahmen = Ziel Packet.
- Ungültig (wird nicht angelegt, Linie federt zurück): Quelle = Ziel; exakt gleiche Dependency existiert; Bit → eigenes Packet; Packet → eigenes Bit.
- Darstellung: Bézier von rechter Kante der Quelle zur linken Kante des Ziels, Pfeilspitze am Ziel. Gestrichelt grau = Quelle noch nicht fertig; durchgezogen grün = Quelle fertig; orange = Teil eines Zyklus.
- Pfeil antippen = auswählen; ein ✕-Knopf in der Mitte löscht ihn (wie heute).

### Packets-HUD

- Bleibt unten rechts als Übersicht: je Packet Name, „erledigt / gesamt“, Fortschrittsbalken, Chips (blocked / ready / active / Zyklus).
- Antippen einer Karte **zoomt per Spring zum Stapel** (`animateView`) und hebt ihn hervor (andere Elemente gedimmt). Erneut antippen hebt die Hervorhebung auf.
- Umbenennen passiert am Stapel-Kopf; der Name kommt aus der DB (der bisherige localStorage-Key `listion-packet-names` entfällt).

### Unverändert

`LTaskbar`, `LMenu`, Kontextmenü „Create Bit“ (legt eine lose Kapsel an der Klickposition an), `LBitPanel` (Inhalt), Canvas-Pan/Zoom, Zoom-Controls.

## Flow-Status (Regeln)

Für Status und Zyklen wird ein gerichteter Graph gebaut. Jedes Bit ist ein Knoten. Jedes Packet hat zwei Knoten: `packet:in` (Tor) und `packet:out` (fertig).

Kanten:

- Stapel-Reihenfolge: `bit[i] → bit[i+1]`
- `packet:in → bit[0]` (das Tor gibt den ersten Schritt frei)
- `bit[k] → packet:out` für jeden Schritt *k* (Packet ist fertig, wenn alle Schritte fertig sind)
- Dependency Quelle → Ziel: Quelle Bit = `bit`, Quelle Packet = `packet:out`; Ziel Bit = `bit`, Ziel Packet = `packet:in`

Definitionen:

- `done(bit)` ⇔ `status === 2`. `done(packet:out)` ⇔ alle Bits des Packets done. `done(packet:in)` ⇔ alle Vorgänger von `packet:in` done.
- **Voraussetzungen** eines Bits = alle direkten Vorgänger im Graphen.
- `blocked` ⇔ Bit nicht done und mindestens eine Voraussetzung nicht done.
- `ready` ⇔ Bit nicht done, mindestens eine Voraussetzung, alle Voraussetzungen done.
- Bits ohne Voraussetzungen und erledigte Bits haben keinen Workflow-Zustand (neutral).
- **Zyklen**: Kanten, die per DFS als Rückkanten erkannt werden. Dependencies auf einem Zyklus werden orange markiert; das HUD zeigt einen Zyklus-Chip.

Diese Logik lebt als reine Funktionen in `useFlowState` und ist vollständig unit-getestet.

## Datenmodell

### `packet` (neu)

| Feld | Typ | Hinweis |
|---|---|---|
| id | int PK | |
| user | int | Owner aus JWT |
| name | varchar(60) | Default „Packet N“ |
| x, y | int | linke obere Ecke des Stapels (Canvas-Koordinaten) |
| createdAt | timestamp | |

### `bit` (erweitert)

| Feld | Typ | Hinweis |
|---|---|---|
| packetId | int, nullable | `null` = lose Kapsel |
| order | int, default 0 | Position im Stapel (0-basiert); bei losen Bits ohne Bedeutung |
| x, y | int (bestehend) | nur für lose Bits relevant: linke obere Ecke der Kapsel |

### `dependency` (neu, ersetzt `bit_connection`)

| Feld | Typ | Hinweis |
|---|---|---|
| id | int PK | |
| userId | int | Owner aus JWT |
| fromType / toType | varchar(6): `bit` \| `packet` | |
| fromId / toId | int | |
| createdAt | timestamp | |

Die Entity `BitConnection`, `ConnectionService/Controller`, `create-connection.dto.ts` und der Frontend-`connectionStore` werden entfernt. Altdaten werden verworfen: `synchronize` legt die neuen Tabellen an; die verwaiste Tabelle `bit_connection` bleibt in der lokalen DB liegen und kann mit `DROP TABLE bit_connection;` entfernt werden (oder Volume neu anlegen).

## API

Alle Endpunkte: `@UseGuards(JwtAuthGuard)` auf Controller-Ebene, userId aus `req.user.sub`, Owner-Filter bei jeder Operation, DTOs mit class-validator, Swagger-Decorators.

### Packets

- `GET /api/packet` → alle Packets des Users.
- `POST /api/packet` `{ name?, x, y, bitIds: number[] (≥ 2) }` → legt das Packet an und setzt für die Bits `packetId` + `order` in genau dieser Reihenfolge (Transaktion). Bits, die vorher in einem anderen Packet waren, werden dort entfernt (mit Auflösungsregel).
- `PUT /api/packet/:id` `{ name?, x?, y? }`.
- `PUT /api/packet/:id/bits` `{ bitIds: number[] (≥ 2) }` → setzt die Mitgliedschaft **genau** auf diese Bits in dieser Reihenfolge. Bisherige Mitglieder, die fehlen, werden lose (behalten x/y). Neu hinzukommende Bits verlassen ihr altes Packet (mit Auflösungsregel).
- `DELETE /api/packet/:id` → Bits werden lose, Dependencies von/zu diesem Packet werden gelöscht.

### Bits

- Bestehende Endpunkte bleiben. `PUT /api/bit/:id` akzeptiert zusätzlich `packetId: number | null`; `packetId: null` entfernt das Bit aus seinem Packet (mit Auflösungsregel).
- `DELETE /api/bit/:id` löscht zusätzlich alle Dependencies von/zu dem Bit; fällt sein Packet auf 1 Bit, wird es aufgelöst.

### Dependencies

- `GET /api/dependency` → alle des Users.
- `POST /api/dependency` `{ fromType, fromId, toType, toId }` → prüft Besitz beider Enden und die Ungültig-Regeln (gleich, Duplikat, Bit ↔ eigenes Packet). Existiert die gleiche Dependency schon, wird sie zurückgegeben.
- `DELETE /api/dependency/:id`.

### Auflösungsregel (serverseitig)

Nach jeder Operation, die die Mitgliedschaft ändert, gilt: Ein Packet mit weniger als 2 Bits wird gelöscht; ein verbleibendes Bit wird lose; Dependencies von/zu dem Packet werden gelöscht. Der Client lädt nach strukturellen Änderungen (Packet anlegen/auflösen, Bit löschen, Mitgliedschaft ändern) `bits`, `packets` und `dependencies` neu und setzt danach die Bildschirmpositionen frei gewordener Bits per `PUT /api/bit/:id { x, y }`.

## Frontend-Struktur

| Einheit | Aufgabe |
|---|---|
| `components/LBitCapsule.vue` | Darstellung einer Kapsel (lose oder im Stapel), Auswahl/Aufklappen, Griff für Pfeile, meldet Drag-Gesten nach oben |
| `components/LPacketStack.vue` | Stapel mit Kopf, Fortschritt, Schritten, Einfügelinie, Umbenennen; verschiebbar am Kopf |
| `components/LDependencyLayer.vue` | SVG-Ebene: Pfeile, Pfeil-Vorschau beim Ziehen, Auswahl/Löschen |
| `components/LPacketsHud.vue` | angepasst: Daten aus `packetStore`, Antippen zoomt zum Stapel |
| `composables/useFlowState.ts` | reine Funktionen: Graph bauen, ready/blocked, Zyklen, Packet-Fortschritt |
| `composables/useStackDrag.ts` | reine Funktionen: Snap-Ziel und Einfüge-Index aus Pointer-Position und Layout |
| `composables/useFlowLayout.ts` | Layout-Konstanten und Positionen (Kapsel-/Stapelmaße, Anker für Pfeile) |
| `stores/packetStore.ts`, `stores/dependencyStore.ts` | API-Zugriff; `connectionStore` entfällt |
| `views/LWorkspace.vue` | orchestriert nur noch: Canvas, Stores laden, Gesten an Stores weitergeben; Achteck-/Seiten-Logik entfällt |

`LBit.vue` wird durch `LBitCapsule.vue` ersetzt.

## Fehlerbehandlung

- Schlägt eine API-Operation fehl, lädt der Client den Stand neu vom Server (Bits, Packets, Dependencies) und die Darstellung federt zurück; Fehler werden geloggt (`console.error`, wie heute).
- Der Server lehnt ungültige Dependencies mit `400` ab und unbekannte/fremde IDs mit `404`/`400` (keine Information über fremde Daten).

## Tests

- **Frontend (Vitest)**: `useFlowState` (linearer Stapel, Packet → Packet, Bit → Packet, Packet → Bit, Zyklus, Auflösung zu neutral bei done), `useStackDrag` (Einfüge-Index oben/mitte/unten, Snap auf lose Kapsel, kein Ziel), Smoke-Test `LWorkspace` bleibt grün.
- **Backend (Vitest)**: Packet anlegen mit Reihenfolge, `PUT bits` (Umsortieren, Entfernen, Übernehmen aus anderem Packet), Auflösungsregel, Löschen räumt Dependencies auf, Owner-Checks, Ungültig-Regeln für Dependencies, DTO-Validierung.
- Manuell im Browser: Stapel bauen, umsortieren, herausziehen bis Auflösung, Pfeile in allen vier Kombinationen, HUD-Sprung.

## Offene Punkte für spätere Versionen

Mehrfachauswahl und Gruppen-Drag, Undo, Tastatur-Bedienung für Stapel/Pfeile, Pfeil-Routing um Hindernisse, Einklappen von Stapeln.
