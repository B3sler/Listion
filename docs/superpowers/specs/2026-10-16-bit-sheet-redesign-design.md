# Bit-Sheet: Erfassen und Bearbeiten neu gedacht — Design

Datum: 2026-10-16 · Status: abgestimmt · Branch: `feat/bit-sheet`

## Ziel

Das Panel zum Erstellen und Bearbeiten von Bits wird neu gebaut. Es fährt weiter von links herein,
wird aber schneller beim Erfassen, reicher beim Bearbeiten und fühlt sich nach den
Apple-Design-Prinzipien an (`.claude/skills/apple-design`). Dazu kommen neue Bit-Eigenschaften:
Aufwand, Wiederholung, Snooze und Fokuszeit.

Erfolgskriterien:

- Zehn Bits in Folge lassen sich nur mit der Tastatur anlegen. Datum, Priorität, Farbe, Aufwand und
  Wiederholung stehen direkt im Titel, ohne ein Feld anzufassen.
- Jede Änderung an einem Bit ist sofort auf dem Canvas sichtbar. Es gibt keinen Speichern-Button,
  und jede Panel-Aktion inklusive Löschen ist per Strg+Z oder Toast umkehrbar.
- Der Aufwand eines Bits ist auf dem Canvas an seiner Höhe ablesbar.
- Das Panel lässt sich mit der Hand wegwischen: 1:1-Tracking, Momentum, Gummiband, jederzeit
  unterbrechbar.

Nicht-Ziele (v1):

- globales Undo für Canvas-Gesten (Verschieben, Stacken, Flows, Pfeile zeichnen)
- Uhrzeiten an Fälligkeit oder Snooze (nur Kalendertage)
- Pomodoro-Intervalle
- Checklisten bzw. Teilschritte
- eigene Wiederholungsregeln jenseits der vier Varianten
- UI-Übersetzung (die Oberfläche bleibt Englisch)

## Begriffe

- **Sheet**: das neue Panel `LBitSheet`, links angedockt, volle Höhe.
- **Capture-Ansicht**: Eingabezeile zum schnellen Anlegen, darüber die in dieser Sitzung angelegten
  Bits.
- **Detail-Ansicht**: ein einzelnes Bit mit allen Eigenschaften.
- **Serie**: die Bits, die während einer geöffneten Capture-Ansicht angelegt werden.
- **Token**: ein erkannter Teil der Smart-Eingabe, etwa `morgen` oder `!!`.
- **Aufwand** (`size`): S, M, L oder XL.
- **Gesnoozt**: `snoozedUntil` liegt nach dem heutigen lokalen Tag.

## Sheet: Hülle und Bewegung

- `LBitSheet.vue` ersetzt `LBitPanel.vue`. `LCreateBitModal.vue` ist ungenutzt und wird gelöscht.
- Breite 320 px, volle Höhe, links angedockt, rechts abgerundet (22 px). Material `material--thick`
  wie bisher.
- **Kein Scrim.** Der Canvas bleibt bedienbar, das Sheet ist eine parallele Ebene.
- **Farb-Tint:** Der Kopfbereich bekommt einen Verlauf in der Bitfarbe (8 % → 0 %). In der
  Capture-Ansicht ist das die Farbe des nächsten Bits.
- **Ansichten:**
  - Capture öffnet sich per Doppelklick auf den Canvas oder über „Create Bit“ im Kontextmenü.
  - Detail öffnet sich per Klick auf eine Capsule, per Strg+Enter in Capture oder per Klick auf eine
    Zeile der Serie.
  - Ein Chevron „‹ New Bits“ in der Detail-Ansicht führt zurück zu Capture, solange die Serie nicht
    leer ist.
  - Ein Klick auf eine andere Capsule bei offenem Sheet wechselt per Cross-Fade (150 ms) zu diesem
    Bit. Das Sheet bleibt dabei stehen.
- **Öffnen und Schließen** laufen auf demselben Weg nach links (`translateX(-100% → 0)`). Gesteuert
  wird das über die vorhandene `Spring`-Klasse aus `helpers/motion.ts` mit `SPRING_DEFAULT`, nicht
  über eine CSS-Transition, damit jede Bewegung unterbrechbar ist. Die `<Transition name="sheet">`
  in `LWorkspace` fällt weg.
- **Wisch-Geste** (`useSheetGesture.ts`):
  - **Start:** Pointer-down auf dem Kopfbereich oder auf freier Sheet-Fläche. Nicht auf
    Eingabefeldern, Buttons, Chips oder Listen-Zeilen.
  - **Erkennung:** Erst nach 6 px horizontaler Bewegung, die größer als die vertikale ist, gilt es
    als Geste. Sonst bleibt es ein Klick bzw. Scrollen.
  - **Nach links** folgt das Sheet dem Pointer 1:1 und berücksichtigt die Greifposition. **Nach
    rechts** über 0 hinaus gibt es Gummiband-Widerstand (`rubberband`, Dimension = Sheet-Breite).
  - **Loslassen:** Ausgewertet wird `x + project(vx)`. Liegt das unter −40 % der Breite, oder ist
    `vx < −500 px/s`, schließt das Sheet, sonst federt es zurück. Die Release-Geschwindigkeit geht
    an die Spring. Beim Schließen wird `SPRING_MOMENTUM` verwendet, wenn `|vx| > 500`.
  - **Unterbrechen:** Ein Pointer-down auf das schließende oder öffnende Sheet greift es an der
    aktuellen Bildschirmposition, ohne Sprung.
  - Die Entscheidung „zu oder zurück“ ist eine reine Funktion `decideSheetRelease(x, vx, width)`.
- **Schließen** außerdem über × oben rechts und Esc. Esc schließt zuerst eine offene Chip-Auswahl
  und erst beim zweiten Druck das Sheet.
- **Reduced Motion:** Statt Slide und Spring blendet das Sheet in 200 ms über. Die Wisch-Geste
  bleibt aktiv, schließt dann aber per Überblendung.
- **Reduced Transparency / mehr Kontrast:** massiver Hintergrund ohne Blur, klar abgesetzter Rand.

## Capture-Ansicht: schnell erfassen

```
┌ New Bits ────────────────────── × ┐
│ ✓ Steuer abgeben     📅 Fr  ⚑ !!  │
│ ✓ Belege scannen                  │
│ ┃Erklärung senden morgen !!! #rot │
│  [📅 Sa 17.] [⚑ High] [▭ M] [● Rot]│
│ ↵ next   ⌃↵ details   esc done    │
└───────────────────────────────────┘
```

### Smart-Eingabe (`helpers/quickEntry.ts`)

`parseQuickEntry(text: string, now: Date): QuickEntry` ist eine reine Funktion. Sie liefert:

```ts
interface QuickEntry {
  title: string; // ohne erkannte Tokens, getrimmt, Mehrfach-Leerzeichen zusammengezogen
  dueDate?: string; // lokaler Kalendertag YYYY-MM-DD
  priority?: 1 | 2 | 3;
  color?: string; // Hex aus der Palette
  size?: 1 | 2 | 3 | 4;
  recurrence?: Recurrence;
  tokens: { start: number; end: number; kind: TokenKind }[];
}
```

Erkannt wird Groß- und Kleinschreibung unabhängig, auf Deutsch und Englisch:

| Art          | Muster                                                                                                                                                                                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Datum        | `heute`/`today`, `morgen`/`tomorrow`, `übermorgen`, Wochentage kurz und lang (`mo`/`montag`/`mon`/`monday` …, immer das nächste Vorkommen **nach** heute), `nächste woche`/`next week` (nächster Montag), `in N tagen`/`in N days`, `in N wochen`/`in N weeks`, `D.M.`, `D.M.YYYY`, `YYYY-MM-DD` |
| Priorität    | `!` → 1, `!!` → 2, `!!!` → 3 (alleinstehend)                                                                                                                                                                                                                                                     |
| Farbe        | `#<name>` mit DE- oder EN-Namen aus der Palette                                                                                                                                                                                                                                                  |
| Aufwand      | `~s`, `~m`, `~l`, `~xl`                                                                                                                                                                                                                                                                          |
| Wiederholung | `täglich`/`daily`/`jeden tag`/`every day`, `werktags`/`weekdays`, `wöchentlich`/`weekly`, `monatlich`/`monthly`, `jeden <wochentag>`/`every <weekday>` (= weekly, Fälligkeit nächster passender Tag)                                                                                             |

Regeln:

- **Sonderzeichen-Tokens** (`!`, `#`, `~`) gelten an jeder Wortgrenze.
- **Wort-Tokens** (Datum, Wiederholung) gelten nur im **letzten Abschnitt** der Eingabe. Der Parser
  liest vom Ende her Token für Token und hört beim ersten Wort auf, das kein Token ist. So bleiben
  „Mail an Fr. Müller“ und „Morgen-Routine planen“ Text.
- Ein Token mit unmöglichem Datum (`31.2.`) ist kein Token.
- Stehen zwei Tokens derselben Art im Text, gilt das letzte.
- Ein Titel, der nach dem Entfernen der Tokens leer ist, ist ungültig. Enter tut dann nichts.
- Ein **ignoriertes Token** („Als Text behalten“, siehe unten) wird über einen Parameter
  `literal: Set<number>` (Start-Index) übersprungen.

`LQuickEntryInput.vue` legt hinter das transparente `<input>` eine gespiegelte Ebene mit gleicher
Schrift, in der die Token-Bereiche farbig hinterlegt sind. Der Cursor bleibt nativ.

### Chips für das nächste Bit

- Unter der Eingabe stehen die Chips Fällig, Priorität, Aufwand und Farbe. Sie sind live mit den
  erkannten Tokens befüllt.
- Ein Tap auf einen Chip ohne Token öffnet dieselbe Inline-Auswahl wie in der Detail-Ansicht. Das
  explizit gewählte Ergebnis gilt, solange es kein Token derselben Art gibt.
- Ein Tap auf einen Chip mit Token bietet „Keep as text“ (das Token wird literal) und „Clear“ (das
  Token wird aus dem Text entfernt).

### Tastatur und Serie

- **Enter:** Das Bit wird angelegt (optimistisch über `bitStore.createBit`). Feld, Tokens und Chips
  werden zurückgesetzt, **nur die Farbe bleibt** für das nächste Bit erhalten. Die neue Zeile
  erscheint oben in der Serienliste.
- **Strg+Enter** (bzw. ⌘+Enter): anlegen und zur Detail-Ansicht dieses Bits wechseln.
- **Esc** schließt das Sheet. Ein leeres Enter tut nichts.
- **Strg+Z außerhalb des Textfelds** nimmt das zuletzt angelegte Bit zurück (siehe Undo).

### Platzierung und Geister-Capsule

- `useCapturePlacement.ts` bestimmt den Slot. Der erste Slot ist der Klickpunkt, zentriert wie heute
  (`x − CAPSULE_W/2`, `y − h/2`). Jeder weitere liegt 12 px unter der Unterkante des vorherigen.
- Überlappt ein Slot ein vorhandenes Bit- oder Stack-Rechteck (mit 8 px Abstand), rutscht er unter
  dieses Rechteck. Das wird wiederholt, bis der Slot frei ist.
- Liegt der Klickpunkt in einem Flow-Frame, bekommen alle Bits der Serie diese `flowId` (`flowAt`,
  wie heute).
- `LGhostCapsule.vue` zeigt am aktuellen Slot den bereinigten Titel (oder den Platzhalter „New
  Bit“): halbtransparent (45 %), gestrichelter Rand, Farbe und Höhe passend zum gewählten Aufwand.
  Die Höhe federt bei einer Aufwandsänderung mit.
- **Bei Enter** materialisiert sich die Geister-Capsule: Die echte Capsule erscheint am selben Ort
  mit Deckkraft 0,45 → 1 und Skalierung 0,96 → 1 (`SPRING_DEFAULT`). Die Geister-Capsule gleitet per
  Spring zum nächsten Slot.
- Liegt der Slot hinter dem Sheet (Bildschirm-x < 320 px + 24 px) oder außerhalb des Viewports,
  schwenkt der Canvas per Spring so, dass der Slot 48 px rechts neben dem Sheet sichtbar ist.

## Detail-Ansicht

```
┌─────────────────────────────────── × ┐
│ ◯  Steuer abgeben                    │
│ [● Open | In Progress | Done ]       │
│ 📅 Fr 20.   ⚑ High   ▭ L   ● Rot     │
│ ↻ —         ☾ —                      │
│ Notizen …                            │
│ ⏱ FOKUS        1 h 20 von ~3 h  [▶]  │
│ ⇢ WARTET AUF   Belege scannen     ›  │
│ ⇠ BLOCKIERT    Erklärung senden   ›  │
│ Erstellt 14. Okt          🗑 Löschen │
└──────────────────────────────────────┘
```

- **Titel:** großes, rahmenloses, mehrzeiliges Feld (1,25 rem, 650, Tracking −0,015 em), maximal 500
  Zeichen (wie das DTO). Beim Öffnen liegt der Fokus hier, der Cursor steht am Ende.
- **Status:** `LSegmented` mit _Open / In Progress / Done_. Die Auswahl-Pille gleitet per Spring.
  Auf Done greift die Wiederholungslogik.
- **Eigenschafts-Chips** (`LPropertyChip`):
  - Gesetzte Werte sind kräftig, leere gedämpft mit Icon.
  - Ein Tap klappt die Auswahl inline darunter auf, immer nur eine gleichzeitig. Die Höhe animiert
    per Spring.
  - Jeder Chip hat ein × zum Leeren.

| Chip           | Auswahl                                                                                                                                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 📅 Fällig      | Schnellwahl _Today, Tomorrow, Next week, None_ plus `LMiniCalendar` (Wochenstart Montag, heute umrandet, Auswahl in Bitfarbe, Monatswechsel gleitet horizontal). Überfällig, also vor heute und nicht erledigt, färbt den Chip rot. |
| ⚑ Priorität    | `LSegmented` _— / ! / !! / !!!_                                                                                                                                                                                                     |
| ▭ Aufwand      | `LSegmented` _S / M / L / XL_, darunter der Richtwert (S ≈ 30 min, M ≈ 1 h, L ≈ 3 h, XL ≈ 6 h)                                                                                                                                      |
| ● Farbe        | 6×2-Raster der 12 Palettenfarben. Hat das Bit eine Farbe außerhalb der Palette, steht sie als 13. Feld davor.                                                                                                                       |
| ↻ Wiederholung | _Daily, Weekdays, Weekly, Monthly, None_. Ohne Fälligkeit wird das nächste passende Datum ab heute gesetzt. Gesetzt zeigt der Chip „↻ Weekly · 12×“ (Zähler nur ab 1).                                                              |
| ☾ Später       | _Tomorrow, Weekend (nächster Sa), Next week (nächster Mo), Pick date…_. Gesetzt zeigt der Chip „☾ until Mo 21.“, × weckt sofort (`snoozedUntil = null`).                                                                            |

- **Notizen:** rahmenloses Textfeld, wächst bis 12 Zeilen mit, danach scrollt es. Maximal 10 000
  Zeichen.
- **Fokus** (`LFocusSection`): siehe unten.
- **Abhängigkeiten** (`LDependencyList`), nur sichtbar, wenn es welche gibt:
  - **Wartet auf** sind eingehende Pfeile (`toType = 'bit'`, `toId = bit.id`), **Blockiert** sind
    ausgehende.
  - Jede Zeile zeigt Status-Punkt und Titel, bei Packets das Stack-Icon und den Namen.
  - **Hover** hebt den Pfeil im `LDependencyLayer` hervor (gleicher Zustand wie
    `selectedDependencyId`).
  - **Klick** auf ein Bit schwenkt den Canvas dorthin und wechselt das Sheet zu diesem Bit. Bei
    einem Packet wird der Stack fokussiert (vorhandene Fokus-Logik aus dem HUD).
  - **×** entfernt den Pfeil (umkehrbar).
- **Footer:** links „Created 14 Oct“ und darunter der Save-Status, rechts „Delete“. Delete löscht
  sofort und verzögert mit Undo-Toast, ohne die bisherige Zwei-Klick-Bestätigung, denn Undo ersetzt
  die Bestätigung.

### Abhaken-Geste (`LHoldToComplete`)

- Der ◯ vor dem Titel.
- **Gedrückt halten (600 ms):** Ein Ring füllt sich linear. Ist er voll, springt der Haken mit
  `SPRING_MOMENTUM` ein, `navigator.vibrate?.(10)` feuert im selben Frame, und die Capsule auf dem
  Canvas skaliert 1,04 → 1. Nach 350 ms schließt das Sheet, und ein Toast erscheint: „Done · Undo“,
  bei Wiederholung „↻ Next: Mo 21. · Undo“.
- **Früh loslassen:** Der Ring federt per Spring auf 0 zurück.
- **Kurzer Klick (< 200 ms):** Ein Tooltip „Hold to complete“ erscheint für 1,5 s.
- **Tastatur:** Leertaste oder Enter auf dem fokussierten ◯ hakt sofort ab.
- **Ist das Bit schon erledigt,** öffnet ein normaler Klick es wieder (Status 0), ohne Halten.
- Reduced Motion: Die Ringfüllung bleibt (sie ist Information), das Überschwingen und die
  Capsule-Skalierung entfallen.

### Fokus-Timer (`stores/focusStore.ts`, `LFocusSection`, `LFocusPill`)

- **Es läuft höchstens ein Timer.** Der Zustand `{ bitId, startedAt }` liegt in `localStorage` unter
  `listion.focus` (in try/catch) und wird beim Laden des Workspace wiederhergestellt.
- **▶ startet.** Läuft schon ein Timer für ein anderes Bit, wird er zuerst gestoppt und
  gutgeschrieben.
- **Anzeige laufend:** „12:04“ in gleichbreiten Ziffern (`font-variant-numeric: tabular-nums`), ab
  einer Stunde „1:12:04“. Darunter der Balken „1 h 20 of ~3 h“: `focusSeconds` plus laufende Zeit
  gegen den Richtwert. Ohne Aufwand gibt es keinen Balken, nur die Summe. Über 100 % wird der Balken
  in der Warnfarbe gefüllt.
- **■ stoppt** und ruft `bitStore.addFocus(id, seconds)` auf. Dabei wird optimistisch lokal addiert,
  dann `POST /api/bit/:id/focus` gesendet. Unter 5 s wird nichts gebucht.
- **Schlägt der POST fehl,** landen die Sekunden in `listion.focus.pending` (Map `bitId → seconds`)
  und werden beim nächsten Workspace-Laden oder beim nächsten Stopp nachgereicht.
- **Läuft länger als 12 h:** Beim Stopp wird auf 12 h gekappt (vergessener Timer).
- **Wird das Bit gelöscht,** endet der Timer ohne Buchung.
- **`LFocusPill`** in der Taskbar, nur sichtbar, wenn ein Timer läuft: „● <Titel, gekürzt> 12:04 ■“.
  Ein Klick öffnet das Bit, ■ stoppt.
- **Capsule mit laufendem Timer:** Ring in der Bitfarbe, der in 2,4 s zwischen 40 % und 80 %
  Deckkraft pulsiert. Bei Reduced Motion ist er statisch mit 70 %.

## Daten und Backend

### Neue Spalten an `Bit`

| Spalte           | Typ                     | Default | Validierung (Create/Update)                                                                       |
| ---------------- | ----------------------- | ------- | ------------------------------------------------------------------------------------------------- |
| `size`           | `smallint`, nullable    | `null`  | `@IsInt @Min(1) @Max(4)`, Update erlaubt `null`                                                   |
| `recurrence`     | `varchar(16)`, nullable | `null`  | `@IsIn(['daily','weekdays','weekly','monthly'])`, Update erlaubt `null`                           |
| `completedCount` | `int`                   | `0`     | `@IsInt @Min(0)`, nur im Update-DTO                                                               |
| `snoozedUntil`   | `date`, nullable        | `null`  | `@IsDateString` im Format `YYYY-MM-DD` (`@Matches(/^\d{4}-\d{2}-\d{2}$/)`), Update erlaubt `null` |
| `focusSeconds`   | `int`                   | `0`     | **in keinem DTO** (`whitelist: true` entfernt es)                                                 |

- Für Updates, die auf `null` zurücksetzen, bekommen `size`, `recurrence` und `snoozedUntil` im
  `UpdateBitDto` eigene Felder mit `@ValidateIf(v => v !== null)`, nach dem Muster von `packetId`
  und `flowId`.
- Die Migration wird nach DOCKER.md → „Database schema and migrations“ generiert und in
  `backend/src/data-source.ts` registriert.

### Fokus-Endpoint

- `POST /api/bit/:id/focus`, Body `AddFocusDto { seconds: number }` mit
  `@IsInt @Min(1) @Max(86400)`.
- `BitService.addFocus(id, userId, seconds)`:
  - Zuerst `findOne(id, userId)`, wirft 404 bei fremdem oder unbekanntem Bit.
  - Dann `repository.increment({ id, userId }, 'focusSeconds', seconds)`.
  - Antwortet mit dem aktualisierten Bit.
- Controller-Ebene wie gehabt: `JwtAuthGuard`, Throttle 300/min. Swagger: `@ApiOperation`,
  `@ApiResponse` 201/400/404.

### Lokale Kalendertage (`helpers/localDate.ts`)

- `toDateKey(d: Date): string` gibt den lokalen Tag als `YYYY-MM-DD` zurück.
  `fromDateKey(key): Date` gibt lokal 12:00 zurück. Dazu gibt es `todayKey(now)` und `compareKeys`.
- **Fälligkeit** wird weiter als `timestamp` gespeichert, aber immer als lokaler Tag um 12:00
  gesendet. So verschiebt kein Zeitzonen-Offset den Tag. Angezeigt und verglichen wird
  ausschließlich über `toDateKey`. Das ersetzt `toISOString().split('T')[0]` aus dem alten Panel.
- **`snoozedUntil`** ist ein reiner Tages-String.

### Wiederholung (`helpers/recurrence.ts`)

- `nextDue(dueKey: string, rule: Recurrence, todayKey: string): string`:
  - `daily`: +1 Tag
  - `weekdays`: nächster Mo–Fr
  - `weekly`: +7 Tage
  - `monthly`: gleicher Tag im Folgemonat. Gibt es den Tag dort nicht, wird der letzte Tag des
    Monats genommen (31.1. → 29.2.2028 → 29.3.2028). Ein ursprünglicher Monatstag wird in v1 nicht
    gespeichert; das leichte Abdriften nach kurzen Monaten ist bewusst in Kauf genommen.
  - Die Regel wird angewendet, bis das Ergebnis **nach** `todayKey` liegt (Aufholen ohne Lawine).
- **Abhaken eines wiederkehrenden Bits** (egal ob über die Geste, das Segmented Control oder den
  Haken auf der Capsule) ist **ein** Update:
  `{ status: 0, dueDate: nextDue(...), completedCount: completedCount + 1 }`.
  - Die Capsule zeigt dabei 800 ms den erledigten Zustand und rollt dann sichtbar auf „offen“
    zurück.
  - Ohne Fälligkeit gilt `todayKey` als Ausgangspunkt.
- Berechnet wird bewusst im Client, weil nur der Browser die lokale Zeitzone kennt.

### Snooze

- Ein Bit gilt als gesnoozt, wenn `snoozedUntil > todayKey`. Das wird in einem `computed` neu
  bewertet, das um Mitternacht lokal einmal neu läuft (Timer auf den nächsten Tageswechsel).
- Es gibt keinen Server-Job. Ein abgelaufenes `snoozedUntil` bleibt stehen und ist wirkungslos.
- Abhaken oder Status ändern lässt `snoozedUntil` unberührt.

### Palette (`helpers/palette.ts`)

Zwölf benannte Farben, jeweils mit `hex`, `en` und `de`:

| en     | de      | hex       |
| ------ | ------- | --------- |
| red    | rot     | `#ef4444` |
| orange | orange  | `#f97316` |
| yellow | gelb    | `#eab308` |
| lime   | limette | `#84cc16` |
| green  | grün    | `#22c55e` |
| teal   | türkis  | `#14b8a6` |
| cyan   | cyan    | `#06b6d4` |
| blue   | blau    | `#3b82f6` |
| indigo | indigo  | `#6366f1` |
| violet | violett | `#8b5cf6` |
| pink   | pink    | `#ec4899` |
| gray   | grau    | `#64748b` |

Standardfarbe bleibt Indigo. Bestehende Bits mit anderen Hex-Werten bleiben unverändert.

## Canvas

### Höhe nach Aufwand

| `size`         | Höhe  | Inhalt                                                                                                   |
| -------------- | ----- | -------------------------------------------------------------------------------------------------------- |
| `null` / 1 (S) | 32 px | Titelzeile wie heute                                                                                     |
| 2 (M)          | 44 px | plus Meta-Zeile (11 px, `text2`): Fälligkeit, ↻, ⏱ Fokuszeit, ☾ Snooze-Datum, jeweils nur wenn vorhanden |
| 3 (L)          | 64 px | plus 1 Zeile Notiz-Vorschau (`line-clamp: 1`)                                                            |
| 4 (XL)         | 84 px | plus 2 Zeilen Notiz-Vorschau                                                                             |

- In `useFlowLayout.ts` wird `capsuleHeight(expanded: boolean)` zu
  `capsuleHeight(bit: Pick<Bit, 'size'>)`. `CAPSULE_EXPANDED_EXTRA` und `expandedBitId` entfallen,
  weil sie heute immer `null` sind.
- `stackGeometry(heights: number[], gapIndex, gapHeight)` bekommt die Höhen pro Schritt. Die
  Einfügelücke ist so hoch wie das gezogene Bit plus `STEP_GAP`.
- Diese Stellen rechnen künftig mit der echten Höhe statt `CAPSULE_H`:
  - `useStackDrag`: Mitte, Reichweite, Lücke
  - `useFlowGestures`: Probe-Mittelpunkt
  - `useFlowActions`: Einfüge-Positionen
  - `LWorkspace`: Drag-Rect
- `anchor()` setzt die Pfeile weiter an der Mitte der Titelzeile an (`rect.y + CAPSULE_H/2`).
- Ändert sich der Aufwand, federt die Höhe der Capsule (Spring über `height`). Ein Stack ordnet
  seine Schritte per vorhandener `flow-item`-Transition neu.

### Zustände

- **Gesnoozt:** Deckkraft 35 %, bei S ☾ mit Datum hinter dem Titel, sonst in der Meta-Zeile. Das Bit
  bleibt ziehbar und anklickbar. `aria-label` ergänzt „snoozed until …“.
- **Wiederkehrend:** ↻ (Lucide `Repeat`, 11 px) hinter dem Titel.
- **Fokus läuft:** pulsierender Ring (siehe Fokus-Timer).
- **Geister-Capsule:** siehe Capture.

### Filter

- `FilterState` bekommt `hideSnoozed: boolean` (Default `false`). `LFilterPopover` zeigt dafür einen
  Schalter „Hide snoozed“, und `activeFilterCount` zählt ihn mit.
- Die bestehenden Filter dimmen nicht passende Bits weiter wie heute. `hideSnoozed` dimmt dagegen
  nicht, sondern **rendert gesnoozte Bits gar nicht**. Pfeile zu ihnen entfallen in der Darstellung.
  Bits in einem Packet bleiben im Stack sichtbar (blass), damit die Schrittfolge nicht springt.

## Live-Speichern (`composables/useBitEditor.ts`)

- `useBitEditor(bitId)` hält den Entwurf der offenen Detail-Ansicht und schreibt über
  `bitStore.updateBit`.
- **Chips, Segmented, Abhaken** speichern sofort. **Titel und Notizen** speichern 400 ms nach der
  letzten Eingabe. `flush()` speichert sofort und wird bei Blur, beim Schließen, beim Bit-Wechsel
  und auf `pagehide` aufgerufen.
- **Pro Bit ist höchstens ein `PUT` unterwegs.** Änderungen währenddessen werden in `pending`
  zusammengeführt (das letzte gewinnt je Feld) und nach der Antwort als ein Request gesendet.
- **Leerer Titel** wird nicht gesendet. Beim Blur wird der letzte gespeicherte Titel
  wiederhergestellt, und das Feld wackelt kurz (3 × 4 px, 240 ms; bei Reduced Motion nur roter
  Rand).
- **Save-Status im Footer:**
  - leer im Normalfall
  - „Saving…“, wenn ein Request länger als 500 ms läuft
  - „Couldn’t save · Retry“ bei einem Fehler. Retry sendet den aktuellen Entwurf erneut.
- **Fehlerverhalten des Stores:** `bitStore.updateBit` setzt bei einem Fehler heute den kompletten
  Vorher-Stand zurück. Das bleibt. Der Editor hält aber seinen Entwurf, damit Retry die Eingaben
  nicht verliert.

## Undo (`stores/historyStore.ts`)

- **Einträge** haben die Form `{ bitId, label, undo(): Promise<void>, redo(): Promise<void> }`. Es
  gibt höchstens 50 Einträge pro Sitzung (nur im Speicher). Eine neue Aktion leert den Redo-Stapel.
- **Tastatur** (in `LWorkspace`, `keydown` auf `window`):
  - Strg/⌘+Z → undo, Strg/⌘+Umschalt+Z → redo
  - **Nur, wenn kein editierbares Element fokussiert ist.** In Textfeldern gilt das native Text-Undo
    des Browsers, dessen Änderung live gespeichert wird.
  - Das funktioniert auch bei geschlossenem Sheet.
- **Arbeitsschritte:** Tipp-Änderungen an Titel oder Notizen bilden **einen** Eintrag. Der Schritt
  endet bei Blur oder nach 1,5 s Tipp-Pause.

| Aktion                                         | Undo                                                                      | Redo                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------- |
| Feldänderung (Chip, Segmented, Titel, Notizen) | alte Werte per Update                                                     | neue Werte per Update                             |
| Abhaken, auch über die Capsule                 | alten `status`, bei Wiederholung auch `dueDate` und `completedCount`      | erneut abhaken mit denselben Werten               |
| Anlegen in der Serie                           | das Bit löschen (sofort, ohne Toast)                                      | mit derselben ID und denselben Werten neu anlegen |
| Pfeil im Sheet entfernen                       | mit **derselben ID** neu anlegen (`createDependency` mit vorgegebener ID) | erneut entfernen                                  |
| Löschen                                        | verzögert, siehe unten                                                    | erneut löschen                                    |
| Fokuszeit buchen                               | **nicht umkehrbar** (atomares Hochzählen), kein Eintrag                   | —                                                 |

- **Panels und Undo:** Betrifft ein Undo das gerade offene Bit, aktualisiert sich die Detail-Ansicht
  sofort. Betrifft es ein gelöschtes Bit, das gerade offen war, bleibt das Sheet zu.

### Verzögertes Löschen

- `bitStore` bekommt `hiddenIds: Set<string>`. Versteckte Bits fallen aus `computeLayout`, Filter,
  HUD und Pfeil-Darstellung heraus.
- **Löschen** fügt die ID zu `hiddenIds` hinzu, beendet einen laufenden Fokus-Timer für das Bit und
  zeigt den Toast „Bit deleted · Undo“.
- **Commit** passiert, wenn der Toast abläuft (6 s, Hover pausiert), wenn ein neuer Toast ihn
  ersetzt oder auf `pagehide`. Dann läuft das bestehende `actions.deleteBit(id, layout)` inklusive
  Auflösen kleiner Packets. Auf `pagehide` geht stattdessen ein
  `fetch(…, { method: 'DELETE', keepalive: true, credentials: 'include' })` raus.
- **Undo** im Zeitfenster entfernt die ID aus `hiddenIds`. Es gibt keinen Request, und ID, Position,
  Packet, Flow und Pfeile sind unverändert.
- **Nach dem Commit** wird der History-Eintrag gelöscht. Ein späteres Strg+Z springt zum nächsten
  Eintrag.
- **Schlägt der Commit fehl,** wird die ID aus `hiddenIds` entfernt, und der Toast zeigt „Couldn’t
  delete“ (ohne Undo-Knopf).

### Toast (`LUndoToast.vue`)

- Unten mittig, 24 px über dem unteren Rand, Glasfläche (`material--regular`), Pill-Form.
- Rein: von unten mit 12 px und Deckkraft per `SPRING_DEFAULT`, raus auf demselben Weg.
- Inhalt: Text und Knopf „Undo“. Es ist immer nur ein Toast sichtbar.
- `role="status"`, `aria-live="polite"`. Der Toast stiehlt keinen Fokus, sein „Undo“-Knopf ist per
  Tab erreichbar.

## Barrierefreiheit

- Sheet: `role="dialog"`, `aria-label` „New Bits“ bzw. „Bit: <Titel>“, nicht modal
  (`aria-modal="false"`).
- `LSegmented`: `role="radiogroup"`, Segmente `role="radio"` mit `aria-checked`. Pfeiltasten
  wechseln, Roving-Tabindex.
- Chips: `button` mit `aria-expanded` und `aria-controls`. Die Inline-Auswahl ist per Tab
  erreichbar, Esc schließt sie und gibt den Fokus an den Chip zurück.
- `LMiniCalendar`: `role="grid"`, Pfeiltasten bewegen um einen Tag oder eine Woche, Bild↑/Bild↓
  wechseln den Monat, Enter wählt.
- `LHoldToComplete`: `button` mit `aria-label` „Hold to complete“ bzw. „Mark as open“. Leertaste und
  Enter sofort.
- Sichtbarer Fokus-Ring (`:focus-visible`) auf allen Bedienelementen in der Brand-Farbe.
- Schrift und Abstände in `rem`, damit größere Systemschrift das Layout nicht bricht.

## Dateien

Neu (Frontend):

- `helpers/quickEntry.ts`, `helpers/recurrence.ts`, `helpers/localDate.ts`, `helpers/palette.ts`
- `composables/useSheetGesture.ts`, `composables/useBitEditor.ts`,
  `composables/useCapturePlacement.ts`
- `stores/historyStore.ts`, `stores/focusStore.ts`
- `components/sheet/LBitSheet.vue`, `LCaptureView.vue`, `LBitDetailView.vue`,
  `LQuickEntryInput.vue`, `LPropertyChip.vue`, `LSegmented.vue`, `LMiniCalendar.vue`,
  `LHoldToComplete.vue`, `LFocusSection.vue`, `LDependencyList.vue`
- `components/LGhostCapsule.vue`, `components/LUndoToast.vue`, `components/LFocusPill.vue`

Gelöscht: `components/LBitPanel.vue`, `components/LCreateBitModal.vue`

Geändert (Frontend):

- `components/LBitCapsule.vue`
- `composables/useFlowLayout.ts`, `useStackDrag.ts`, `useFlowGestures.ts`, `useFlowActions.ts`,
  `useFilter.ts`
- `stores/bitStore.ts` (neue Felder, `hiddenIds`, `addFocus`), `stores/toolStore.ts`
  (`hideSnoozed`), `stores/dependencyStore.ts` (Anlegen mit vorgegebener ID)
- `components/LFilterPopover.vue`, `layout/LTaskbar.vue`, `views/LWorkspace.vue`

Backend:

- `modules/bit/bit.entity.ts`, `bit.controller.ts`, `bit.service.ts`
- `dto/create-bit.dto.ts`, `dto/update-bit.dto.ts`, neu `dto/add-focus.dto.ts`
- neue Migration in `backend/src/migrations/`, registriert in `data-source.ts`

## Tests

Testgetrieben, Vitest im Frontend, Jest im Backend.

- **`quickEntry`:** Tabelle mit DE- und EN-Fällen für jede Token-Art.
  - Wochentag heute → nächste Woche.
  - Fehlalarme: „Mail an Fr. Müller“, „Morgen-Routine planen“, „Meeting heute vorbereiten“ (heute
    steht nicht am Ende).
  - Mehrere Tokens, letztes gewinnt, `literal`-Ausnahme, unmögliche Daten, leerer Resttitel,
    Token-Positionen.
- **`recurrence`:** jede Regel; Monatsende (31.1. → 29.2. → 29.3. im Schaltjahr, 31.1. → 28.2.
  sonst), Werktage über Fr → Mo, Aufholen nach mehreren verpassten Terminen.
- **`localDate`:** Tageswechsel um Mitternacht, keine UTC-Verschiebung (Testlauf mit
  `TZ=Europe/Berlin` und `TZ=America/Los_Angeles`).
- **`useFlowLayout`:** variable Höhen im Stack, Lücke in Höhe des gezogenen Bits, Ankerpunkt
  unverändert.
- **`useCapturePlacement`:** freier Slot, Kollision mit Bit, mit Stack und mehrfach hintereinander.
- **`decideSheetRelease`:** langsam unter bzw. über der Schwelle, schneller Wurf nach links von weit
  rechts, Wurf nach rechts.
- **`useBitEditor`:** Debounce, ein Request gleichzeitig, Zusammenführen, Flush, leerer Titel, Retry
  nach Fehler.
- **`historyStore`:** Zusammenfassen von Tipp-Schritten, Redo verfällt, Grenze 50, Löschen mit Undo
  im Zeitfenster, Commit nach Ablauf, Commit-Fehler.
- **`focusStore`:** Start, Stopp, Umschalten auf ein anderes Bit, Wiederherstellen aus
  `localStorage`, unter 5 s, Kappung bei 12 h, Nachreichen bei Fehler.
- **Komponenten:**
  - `LHoldToComplete`: Halten, früh loslassen, kurzer Klick, Tastatur, mit Fake-Timern
  - `LSegmented`: Pfeiltasten und ARIA
  - `LMiniCalendar`: Wochenstart, Monatswechsel, Tastatur
  - `LUndoToast`: Hover pausiert, Ersetzen löst Commit aus
  - `LQuickEntryInput`: Hervorhebung deckt sich mit den Tokens
  - `LBitCapsule`: Höhen, Meta-Zeile, Snooze- und Wiederholungs-Darstellung
- **`LWorkspace`:** Serie mit drei Bits per Enter; Strg+Enter öffnet Detail; Löschen → Undo stellt
  das Bit unverändert wieder her; Strg+Z im Textfeld ruft die History nicht auf.
- **Backend:**
  - DTO-Validierung der neuen Felder inklusive `null` im Update
  - `focusSeconds` per `PUT` wird ignoriert
  - `addFocus` erhöht atomar und gibt 404 bei fremdem Bit
  - Swagger-Decorators vorhanden
- **Manuell im Browser:** Wisch-Geste mit Maus und Touch-Emulation, Unterbrechen mitten in der
  Bewegung, Reduced Motion, Hell und Dunkel, Serie bis über den Bildschirmrand (Canvas-Schwenk).

## Umsetzungsphasen

Nach jeder Phase laufen `npm run lint`, `npm run type-check` und `npm test` grün, und die App ist
benutzbar.

1. **Daten:** neue Spalten, DTOs, Fokus-Endpoint, Migration; Frontend-Typen, `localDate`, `palette`,
   `recurrence`
2. **Canvas:** variable Höhen in Layout-Engine und Gesten, Capsule mit Meta-Zeile, Snooze- und
   Wiederholungs-Darstellung
3. **Sheet und Detail-Ansicht:** Hülle mit Geste, Chips, Segmented, Mini-Kalender, Live-Speichern.
   Ersetzt `LBitPanel`. Die Capture-Ansicht gibt es hier schon in einfacher Form: normale
   Eingabezeile, Enter legt am Klickpunkt an, Strg+Enter öffnet Detail, noch ohne Smart-Eingabe,
   Serien-Platzierung und Geister-Capsule.
4. **Undo:** History, Toast, verzögertes Löschen
5. **Capture:** Smart-Eingabe, Serie, Platzierung, Geister-Capsule
6. **Momente:** Abhaken-Geste, Fokus-Timer mit Pill, Abhängigkeiten im Sheet, Filter „Hide snoozed“
