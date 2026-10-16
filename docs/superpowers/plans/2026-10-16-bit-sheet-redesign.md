# Bit-Sheet Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das Bit-Panel wird durch ein Sheet mit Capture- und Detail-Ansicht ersetzt. Dazu kommen
Smart-Eingabe, Live-Speichern mit Undo, Aufwand als Capsule-Höhe, Wiederholung, Snooze, Fokus-Timer
und eine Abhaken-Geste.

**Architektur:**

- **Reine Logik** liegt in Helfern ohne Vue: `quickEntry`, `recurrence`, `localDate`, `palette`,
  `bitMeta`.
- **Schreibzugriffe** auf Bits laufen über einen Composable `useBitCommands`. Er zeichnet
  Undo-Einträge im `historyStore` auf und nutzt eine Warteschlange pro Bit (`bitStore.queueUpdate`).
- **Das Sheet** (`LBitSheet`) wird über einen kleinen `sheetStore` gesteuert. Damit wächst
  `LWorkspace` nicht weiter an.
- **Abweichung von der Spec:** Die Regel „ein PUT gleichzeitig pro Bit“ sitzt nicht in
  `useBitEditor`, sondern in `bitStore.queueUpdate`. So gilt sie auch für Undo und Abhaken, nicht
  nur fürs Panel. Das Verhalten ist dasselbe.

**Tech Stack:** Vue 3 (`<script setup lang="ts">`), Pinia, Vitest + @vue/test-utils,
lucide-vue-next; NestJS + TypeORM, Tests mit Vitest und `FakeRepository`.

**Spec:** `docs/superpowers/specs/2026-10-16-bit-sheet-redesign-design.md`. Alle Werte (Höhen,
Zeiten, Schwellen, Texte) stammen von dort. Bei Widerspruch gilt die Spec, mit Ausnahme der oben
genannten Abweichung.

## Global Constraints

- **Branch:** `feat/bit-sheet`. Commits im Format `type(scope): summary` (Conventional Commits),
  kein `!` und kein BREAKING-Footer. Am Ende jedes Commits:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Testnamen** auf Deutsch, wie im bestehenden Code (`it('übernimmt …')`).
- **Vue:** immer `<script setup lang="ts">`, `defineProps<…>()`,
  `defineEmits<{ name: [payload] }>()`, Komponenten mit `L`-Präfix. Strict TS, kein `any`.
- **Backend:**
  - Controller → Service → Entity, DTO für jeden Body
  - `@UseGuards(JwtAuthGuard)` auf Controller-Ebene, userId nur über `@CurrentUserId()`
  - Ownership über `{ id, userId }`
  - Swagger: `@ApiOperation` und `@ApiResponse` auf jedem Endpoint
- **UI-Texte** bleiben Englisch. Die Smart-Eingabe versteht Deutsch und Englisch.
- **Bewegung:** Für Bewegung, die unterbrechbar sein muss, wird die vorhandene `Spring`-Klasse aus
  `helpers/motion.ts` genutzt, mit `SPRING_DEFAULT` bzw. `SPRING_MOMENTUM`. Jede Animation braucht
  einen `prefers-reduced-motion`-Zweig. `Spring.to` springt bei Reduced Motion schon selbst auf das
  Ziel.
- **`localStorage`:** Jeder Zugriff steht in try/catch und hat einen Fallback, der funktioniert.
- **Vor jedem Commit:** `npm run lint`, `npm run type-check`, `npm test` (im Repo-Root). Wird
  `backend/src` geändert, danach `docker compose restart backend`.

## Review Focus

1. **Englische Alltagswörter am Titelende** („Things to do“, „and so“, „ask mi“) dürfen nicht als
   Wochentag erkannt werden. Deutsche 2-Buchstaben-Kürzel (`mo di mi do fr sa so`) zählen deshalb
   nur mit Punkt (`fr.`). Der Test steht in Task 19.
2. **Abhaken eines wiederkehrenden Bits ohne Fälligkeit oder mit lange vergangener Fälligkeit** muss
   genau ein Datum nach heute liefern, nicht heute und nicht mehrere Sprünge daneben. Tests in Task
   5 und Task 17.
3. **Ein Bit wird gelöscht, während ein Fokus-Timer darauf läuft oder es im Sheet offen ist:** Der
   Timer endet ohne Buchung, das Sheet schließt, und Undo stellt beides nicht kaputt wieder her.
   Test in Task 17.
4. **Schnelles Tippen, während ein PUT läuft:** Kein Zeichen geht verloren, und die Server-Antwort
   des älteren Requests überschreibt den neueren lokalen Titel nicht. Tests in Task 13 und Task 14.
5. **Fälligkeit abends in einer Zeitzone westlich oder östlich von UTC:** Der angezeigte Tag
   entspricht dem gewählten Tag. Test in Task 4 (Testlauf mit `TZ`).

---

## Phase 1 — Daten

### Task 1: Neue Bit-Spalten und DTO-Validierung (Backend)

**Files:**

- Modify: `backend/src/modules/bit/bit.entity.ts`
- Modify: `backend/src/dto/create-bit.dto.ts`, `backend/src/dto/update-bit.dto.ts`
- Test: `backend/src/dto/validation.spec.ts`

**Interfaces:**

- Produces:
  - `export const RECURRENCES = ['daily', 'weekdays', 'weekly', 'monthly'] as const` und
    `export type Recurrence = (typeof RECURRENCES)[number]` in `create-bit.dto.ts`
  - Entity-Felder `size?: number | null`, `recurrence?: Recurrence | null`,
    `completedCount!: number`, `snoozedUntil?: string | null`, `focusSeconds!: number`

- [ ] **Step 1: Failing Tests in `validation.spec.ts` ergänzen** (neuer
      `describe('Bit-Sheet-Felder')`):

```ts
it("akzeptiert size, recurrence und snoozedUntil beim Erstellen", async () => {
  const bit = await validate(CreateBitDto, {
    title: "T",
    size: 3,
    recurrence: "weekdays",
    snoozedUntil: "2026-10-21",
  });
  expect(bit).toMatchObject({ size: 3, recurrence: "weekdays", snoozedUntil: "2026-10-21" });
});
it("lehnt ungültige Werte ab", async () => {
  for (const body of [
    { title: "T", size: 0 },
    { title: "T", size: 5 },
    { title: "T", recurrence: "yearly" },
    { title: "T", snoozedUntil: "21.10.2026" },
    { title: "T", snoozedUntil: "2026-10-21T00:00:00Z" },
  ])
    await expect(validate(CreateBitDto, body)).rejects.toBeInstanceOf(BadRequestException);
});
it("Update erlaubt null zum Zurücksetzen und completedCount, aber nie focusSeconds", async () => {
  const u = await validate(UpdateBitDto, {
    size: null,
    recurrence: null,
    snoozedUntil: null,
    completedCount: 4,
    focusSeconds: 9999,
  });
  expect(u).toEqual({ size: null, recurrence: null, snoozedUntil: null, completedCount: 4 });
  await expect(validate(UpdateBitDto, { completedCount: -1 })).rejects.toBeInstanceOf(
    BadRequestException,
  );
  const c = await validate(CreateBitDto, { title: "T", completedCount: 3, focusSeconds: 5 });
  expect(c).toEqual({ title: "T" });
});
```

- [ ] **Step 2:** `npm test --workspace backend -- validation` ausführen. Erwartet: FAIL, weil die
      Felder entfernt werden bzw. Werte nicht abgelehnt werden.
- [ ] **Step 3: Implementieren.**
  - **Entity:**
    - `size` als `smallint`, nullable
    - `recurrence` als `varchar(16)`, nullable
    - `completedCount` als `int`, default 0
    - `snoozedUntil` als `date`, nullable, TS-Typ `string | null`
    - `focusSeconds` als `int`, default 0
  - **`CreateBitDto`:**
    - `size`: `@IsOptional() @IsInt() @Min(1) @Max(4)`
    - `recurrence`: `@IsOptional() @IsIn(RECURRENCES)`
    - `snoozedUntil`: `@IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/)`
    - Jedes Feld mit `@ApiProperty({ required: false, nullable: true, … })`.
    - `@IsOptional` lässt `null` durch, so verhält sich class-validator. Ein eigenes `@ValidateIf`
      wie in der Spec ist deshalb nicht nötig.
  - **`UpdateBitDto`:** übernimmt die drei Felder über `PartialType`. Neu kommt `completedCount`
    hinzu: `@IsOptional() @IsInt() @Min(0)`.
  - **`focusSeconds`** steht in keinem DTO.
- [ ] **Step 4:** `npm test --workspace backend` ausführen. Erwartet: PASS, auch die bestehenden
      Tests.
- [ ] **Step 5: Commit** mit `feat(backend): add size, recurrence, snooze and focus columns to bits`

### Task 2: Fokus-Endpoint `POST /api/bit/:id/focus`

**Files:**

- Create: `backend/src/dto/add-focus.dto.ts`
- Modify: `backend/src/modules/bit/bit.service.ts`, `bit.controller.ts`
- Test: `backend/src/modules/bit/bit.service.spec.ts`, `backend/src/dto/validation.spec.ts`

**Interfaces:**

- Produces:
  - `AddFocusDto { seconds: number }`
  - `BitService.addFocus(id: string, userId: string, seconds: number): Promise<Bit>`
  - Route `POST /api/bit/:id/focus` → 201 mit Bit

- [ ] **Step 1: Failing Tests schreiben.**
  - Service:
    - `'addFocus addiert auf focusSeconds'`: zweimal `addFocus('b1','u5',60)` →
      `member('b1').focusSeconds === 120`
    - `'addFocus wirft 404 für ein fremdes Bit und ändert es nicht'`
  - DTO: `seconds` 0, 86401 und 1.5 werden abgelehnt, 1 und 86400 akzeptiert.
  - Falls `FakeRepository` noch kein `increment` hat, die Methode dort ergänzen
    (`backend/src/testing/fake-repository.ts`), mit einem Test in `fake-repository.spec.ts`.
  - In `setup()` den Default `focusSeconds: 0` setzen.
- [ ] **Step 2:** `npm test --workspace backend` ausführen. Erwartet: FAIL.
- [ ] **Step 3: Implementieren.**
  - `addFocus`: zuerst `findOne(id, userId)`, dann
    `bitRepository.increment({ id, userId }, 'focusSeconds', seconds)`, dann `findOne` zurückgeben.
  - Controller: `@Post(':id/focus')`,
    `@ApiOperation({ summary: 'Add tracked focus time to a bit' })`, `@ApiResponse` 201, 400 und
    404, `ParseUUIDPipe` auf der id.
- [ ] **Step 4:** `npm test --workspace backend` ausführen. Erwartet: PASS.
- [ ] **Step 5: Commit** mit `feat(backend): add focus time endpoint for bits`

### Task 3: Migration

**Files:**

- Create: `backend/src/migrations/<timestamp>-BitSheetFields.ts` (generiert)
- Modify: `backend/src/data-source.ts`

- [ ] **Step 1:** Die Befehle aus DOCKER.md → „Database schema and migrations“ ausführen, mit
      `<Name>` = `BitSheetFields`. Voraussetzung: `docker compose up -d` läuft. Danach
      `docker compose restart backend`, damit der Container den Stand aus Task 1 und 2 hat.
- [ ] **Step 2:** Die Migration prüfen. Sie darf nur die fünf `ADD COLUMN` enthalten (bzw. deren
      `DROP` in `down`).
- [ ] **Step 3:** Die Migration in `data-source.ts` in die explizite Liste eintragen.
      `migration:check` muss „No changes in database schema were found“ melden. Die
      Wegwerf-Datenbank danach droppen.
- [ ] **Step 4: Commit** mit `feat(backend): add migration for bit sheet fields`

### Task 4: Frontend-Typen, lokale Kalendertage, Palette, Bit-Metadaten

**Files:**

- Modify: `frontend/src/stores/bitStore.ts` (nur das `Bit`-Interface)
- Create: `frontend/src/helpers/localDate.ts`, `frontend/src/helpers/palette.ts`,
  `frontend/src/helpers/bitMeta.ts`, `frontend/src/composables/useToday.ts`
- Test: `frontend/src/helpers/localDate.test.ts`, `frontend/src/helpers/bitMeta.test.ts`

**Interfaces:**

- **Produces, `Bit`** bekommt neu:
  - `size?: 1 | 2 | 3 | 4 | null`
  - `recurrence?: Recurrence | null`
  - `completedCount?: number`
  - `snoozedUntil?: string | null`
  - `focusSeconds?: number`
  - Den Typ `Recurrence` exportiert `helpers/recurrence.ts` (Task 5). In diesem Task wird er vorab
    dort als reiner Typ angelegt.
- **`localDate.ts`:**
  - `toDateKey(d: Date | string): string` (lokal, `YYYY-MM-DD`)
  - `fromDateKey(key: string): Date` (lokal 12:00)
  - `todayKey(now?: Date): string`
  - `addDays(key: string, n: number): string`
  - `weekdayOf(key: string): number` (0 = Mo … 6 = So)
  - `formatDayShort(key: string, today: string): string`:
    - `'Today'`, `'Tomorrow'`, `'Yesterday'`
    - innerhalb ±6 Tagen `'Fri 20'` (en-GB, Wochentag kurz + Tag)
    - sonst `'20 Oct'`
  - `dueToApi(key: string | null): string | null` (ISO von `fromDateKey`)
- **`palette.ts`:**
  - `PALETTE: readonly { hex: string; en: string; de: string }[]` mit den 12 Einträgen und
    Hex-Werten aus der Spec-Tabelle, in Spec-Reihenfolge
  - `DEFAULT_COLOR = '#6366f1'`
  - `colorByName(name: string): string | undefined` (case-insensitiv, `en` oder `de`)
- **`bitMeta.ts`:**
  - `SIZE_HEIGHT: Record<0 | 1 | 2 | 3 | 4, number> = { 0: 32, 1: 32, 2: 44, 3: 64, 4: 84 }`
  - `SIZE_MINUTES = { 1: 30, 2: 60, 3: 180, 4: 360 }`
  - `SIZE_LABEL = { 1: 'S', 2: 'M', 3: 'L', 4: 'XL' }`
  - `isSnoozed(bit, today: string): boolean` (`snoozedUntil > today`)
  - `isOverdue(bit, today: string): boolean` (Fälligkeit < heute und `status !== 2`)
- **`useToday.ts`:** `useToday(): Readonly<Ref<string>>`. Ein Modul-Singleton mit `todayKey()`. Ein
  `setTimeout` auf die nächste lokale Mitternacht aktualisiert den Wert und plant den nächsten
  Wechsel.

- [ ] **Step 1: Failing Tests schreiben.**
  - `toDateKey(new Date(2026, 9, 16, 23, 30)) === '2026-10-16'`
  - `toDateKey(fromDateKey('2026-03-29')) === '2026-03-29'` (Tag der Zeitumstellung)
  - `addDays('2026-12-31', 1) === '2027-01-01'`
  - `formatDayShort` für heute, morgen, gestern, +3 und +10 Tage
  - `dueToApi('2026-10-20')` ergibt nach `toDateKey(new Date(result))` wieder `'2026-10-20'`
  - `isOverdue` false für erledigte Bits
  - `isSnoozed` false für den Tag selbst (`snoozedUntil === today`)
- [ ] **Step 2:** `npx vitest run src/helpers --root frontend` ausführen. Erwartet: FAIL.
- [ ] **Step 3:** Implementieren, ausschließlich mit lokalen `Date`-Gettern, nie
      `toISOString().split`.
- [ ] **Step 4:** Mit `TZ=America/Los_Angeles npx vitest run src/helpers/localDate --root frontend`
      und mit `TZ=Europe/Berlin …` ausführen. Erwartet: beide PASS.
- [ ] **Step 5: Commit** mit `feat(frontend): add local date, palette and bit meta helpers`

### Task 5: Wiederholung `nextDue` und `completionPatch`

**Files:**

- Create: `frontend/src/helpers/recurrence.ts`
- Test: `frontend/src/helpers/recurrence.test.ts`

**Interfaces:**

- Consumes: `addDays`, `weekdayOf`, `toDateKey`, `dueToApi` (Task 4)
- Produces:
  - `type Recurrence = 'daily' | 'weekdays' | 'weekly' | 'monthly'`
  - `RECURRENCE_LABEL: Record<Recurrence, string>` = `Daily`, `Weekdays`, `Weekly`, `Monthly`
  - `nextDue(dueKey: string, rule: Recurrence, today: string): string`
  - `firstDue(rule: Recurrence, today: string): string`: heute; bei `weekdays` am Wochenende der
    nächste Montag
  - `completionPatch(bit: Bit, today: string): Partial<Bit>`:
    - ohne `recurrence`: `{ status: 2 }`
    - sonst
      `{ status: 0, dueDate: dueToApi(nextDue(dueKey ?? today, rule, today)), completedCount: (bit.completedCount ?? 0) + 1 }`

- [ ] **Step 1: Failing Tests schreiben** (Tabelle `[due, rule, today, expected]`):
  - `daily`: `['2026-10-16','daily','2026-10-16','2026-10-17']`
  - Aufholen: `['2026-10-01','daily','2026-10-16','2026-10-17']`
  - `weekdays` Fr → Mo: `['2026-10-16','weekdays','2026-10-16','2026-10-19']`
  - `weekly`: `['2026-10-16','weekly','2026-10-16','2026-10-23']`
  - Weekly-Aufholen bleibt am Wochentag: `['2026-09-04','weekly','2026-10-16','2026-10-23']`
  - `monthly` Monatsende: `['2028-01-31','monthly','2028-01-31','2028-02-29']`,
    `['2028-02-29','monthly','2028-02-29','2028-03-29']`,
    `['2027-01-31','monthly','2027-01-31','2027-02-28']`
  - `completionPatch`:
    - ohne Regel → `{ status: 2 }`
    - mit Regel und ohne Fälligkeit: Ausgangspunkt heute, `completedCount` 0 → 1
  - `firstDue('weekdays','2026-10-17') === '2026-10-19'`
- [ ] **Step 2:** Tests ausführen. Erwartet: FAIL.
- [ ] **Step 3: Implementieren.**
  - Einen Schritt der Regel wiederholen, solange das Ergebnis `<= today` ist.
  - `monthly`: Monat +1, Tag = `min(Tag, letzter Tag des Zielmonats)`
- [ ] **Step 4:** Tests ausführen. Erwartet: PASS.
- [ ] **Step 5: Commit** mit `feat(frontend): add recurrence rules for repeating bits`

---

## Phase 2 — Canvas

### Task 6: Layout-Engine mit Höhe pro Bit

**Files:**

- Modify: `frontend/src/composables/useFlowLayout.ts`, `frontend/src/components/LPacketStack.vue`,
  `frontend/src/views/LWorkspace.vue` (Aufrufe von `computeLayout`)
- Test: `frontend/src/composables/useFlowLayout.test.ts`

**Interfaces:**

- Consumes: `SIZE_HEIGHT` (Task 4)
- Produces:
  - `capsuleHeight(bit: Pick<Bit, 'size'>): number` (= `SIZE_HEIGHT[bit.size ?? 0]`)
  - `stackGeometry(heights: number[], gapIndex: number | null, gapHeight?: number): { offsets: number[]; gapY: number | null; height: number }`.
    Default für `gapHeight` ist `INSERT_GAP`; die Lücke ist `gapHeight` hoch.
  - `computeLayout({ bits, packets })`: Der Parameter `expandedBitId` entfällt.
  - `CAPSULE_EXPANDED_EXTRA` und der `expanded`-Parameter entfallen. `CAPSULE_H = 32` bleibt die
    Titelzeilenhöhe, `anchor()` ändert sich nicht.

- [ ] **Step 1: Bestehende Tests anpassen und neue schreiben.**
  - `stackGeometry([32, 64, 44], null)` → `offsets [40, 76, 144]`, `height 196` (40 Header, 4
    Abstand, 8 Pad)
  - Lücke an Index 1 mit `gapHeight 68` → `offsets[1] === 40 + 32 + 4 + 68`
  - `computeLayout`: Ein Bit mit `size: 4` hat `h === 84`, ein Bit ohne `size` `h === 32`.
  - `anchor`: y bleibt `rect.y + 16`, auch bei `size: 4`.
- [ ] **Step 2:** `npx vitest run src/composables/useFlowLayout --root frontend` ausführen.
      Erwartet: FAIL.
- [ ] **Step 3: Implementieren.**
  - `LPacketStack` übergibt `members.map(capsuleHeight)` und die Höhe des gezogenen Bits als
    `gapHeight`. Dafür bekommt es ein neues optionales Prop `gapHeight?: number`, das `LWorkspace`
    aus dem gezogenen Bit füllt.
- [ ] **Step 4:** `npm test --workspace frontend` ausführen. Erwartet: PASS.
- [ ] **Step 5: Commit** mit
      `refactor(frontend): give each capsule its own height in the flow layout`

### Task 7: Gesten und Drops mit echten Höhen

**Files:**

- Modify: `frontend/src/composables/useStackDrag.ts`, `useFlowGestures.ts`, `useFlowActions.ts`,
  `frontend/src/views/LWorkspace.vue` (Drag-Rect in `liveLayout`)
- Test: `frontend/src/composables/useStackDrag.test.ts`, `useFlowActions.test.ts`

**Interfaces:**

- Consumes: `stackGeometry`, `capsuleHeight` (Task 6)
- Produces: `insertIndex(pointerY: number, stackTop: number, heights: number[]): number`. Der Index
  ist die Anzahl der Zeilen, deren Mitte (`stackTop + offsets[i] + heights[i]/2`) oberhalb von
  `pointerY` liegt.

- [ ] **Step 1: Failing Tests schreiben.**
  - `insertIndex` mit Höhen `[32, 84]`: Ein Pointer knapp über der Mitte der XL-Zeile ergibt 1,
    knapp darunter 2.
  - `findSnapTarget`: Ein Pair-Snap an einem XL-Bit greift noch bei `probe.y = r.y + 84 + 20`.
  - `dropBit` als Pair `above` an einem Bit mit Ziehling `size: 3`: Das neue Packet liegt bei
    `y = t.y - (64 + 4) - 40`.
- [ ] **Step 2:** Tests ausführen. Erwartet: FAIL.
- [ ] **Step 3: Implementieren.**
  - In `findSnapTarget`: `centerY = r.y + r.h / 2` und `reach = PAIR_SNAP_DISTANCE + r.h`. Die
    Stack-Variante ruft `insertIndex` mit den Höhen der Mitglieder ohne den Ziehling auf.
  - In `useFlowGestures`: `probe.y = y + rect.h / 2`.
  - In `useFlowActions` werden `CAPSULE_H` (Pair-Above, Freier-Drop-Mittelpunkt) durch die Höhe des
    gezogenen Bits ersetzt.
  - In `LWorkspace` bekommt das Drag-Rect `h: capsuleHeight(bit)`.
- [ ] **Step 4:** `npm test --workspace frontend` ausführen. Erwartet: PASS.
- [ ] **Step 5: Commit** mit `fix(frontend): snap and drop bits by their real height`

### Task 8: Capsule mit Meta-Zeile, Snooze, Wiederholung und Fokus-Ring

**Files:**

- Modify: `frontend/src/components/LBitCapsule.vue`
- Test: `frontend/src/components/flowComponents.test.ts`

**Interfaces:**

- Consumes: `capsuleHeight`, `isSnoozed`, `formatDayShort`, `toDateKey`, `useToday`
- Produces:
  - Prop `focusing?: boolean`. In Task 23 kommt der Wert aus dem `focusStore`, bis dahin nicht
    gesetzt.
  - Klassen `capsule--snoozed`, `capsule--focusing`, `capsule__meta`, `capsule__notes`,
    `capsule__repeat`
  - Methode `settle()` per `defineExpose`. Sie spielt die Skalierung 1,04 → 1 ab (`Spring`, damit
    bei Reduced Motion nichts skaliert) und wird in Task 22 genutzt.

- [ ] **Step 1: Failing Tests schreiben.**
  - `size: 2` → Höhe `44px` im Style, Meta-Zeile mit Fälligkeit `'Tomorrow'`
  - `size: 3` mit Notiz → `.capsule__notes` mit `line-clamp` 1
  - `size: 4` → 2
  - `size: 1` → keine Meta-Zeile
  - `snoozedUntil` nach heute → `capsule--snoozed`, und das `aria-label` enthält `'snoozed until'`
  - `recurrence: 'daily'` → `.capsule__repeat` vorhanden
- [ ] **Step 2:** Tests ausführen. Erwartet: FAIL.
- [ ] **Step 3: Implementieren.**
  - Die Höhe ist fest (`height`, nicht `min-height`), mit `transition: height` per CSS-Spring-Token.
    Das ist erlaubt, weil es keine Geste ist.
  - Meta-Zeile: 11 px, `text2`, Elemente getrennt mit `·`.
  - Gesnoozt: Deckkraft 0,35. Bei S steht `☾ <Datum>` hinter dem Titel, sonst in der Meta-Zeile.
  - `capsule--focusing`: Ring in `--c`, Animation über 2,4 s, Deckkraft 0,4 ↔ 0,8. Bei Reduced
    Motion statisch mit 0,7.
- [ ] **Step 4:** `npm test --workspace frontend` ausführen. Erwartet: PASS.
- [ ] **Step 5: Commit** mit `feat(frontend): show size, meta line, snooze and repeat on capsules`

---

## Phase 3 — Sheet und Detail-Ansicht

### Task 9: Sheet-Geste

**Files:**

- Create: `frontend/src/composables/useSheetGesture.ts`
- Test: `frontend/src/composables/useSheetGesture.test.ts`

**Interfaces:**

- Consumes: `Spring`, `VelocityTracker`, `project`, `rubberband`, `SPRING_DEFAULT`,
  `SPRING_MOMENTUM`, `prefersReducedMotion`
- Produces:
  - `SHEET_WIDTH = 320`
  - `decideSheetRelease(x: number, vx: number, width: number): 'close' | 'open'`: `'close'`, wenn
    `x + project(vx) < -0.4 * width` oder `vx < -500`
  - `useSheetGesture(opts: { onClosed: () => void }): { x: Ref<number>; open(): void; close(velocity?: number): void; onPointerDown(e: PointerEvent): void }`
    - `x` läuft von `-SHEET_WIDTH` (zu) bis 0 (offen).
    - `onPointerDown` ignoriert Ziele innerhalb von
      `input, textarea, button, [role="radio"], [data-no-swipe]`.
    - Die Achse wird erst nach 6 px festgelegt, horizontal nur, wenn `|dx| > |dy|`.
    - Nach rechts über 0 gilt `rubberband(dx, SHEET_WIDTH)`.
    - Beim Loslassen: `close(vx)` mit `SPRING_MOMENTUM`, wenn `|vx| > 500`, sonst `SPRING_DEFAULT`.
      Ein Pointer-down während einer Animation ruft `spring.stop()` auf und greift den aktuellen
      Wert.

- [ ] **Step 1: Failing Tests schreiben.**
  - `decideSheetRelease(-100, 0, 320) === 'open'`
  - `decideSheetRelease(-140, 0, 320) === 'close'`
  - `decideSheetRelease(-20, -600, 320) === 'close'`
  - `decideSheetRelease(-200, 800, 320) === 'open'`
  - Composable mit Fake-`requestAnimationFrame`: `open()` endet bei `x = 0`; `close()` endet bei
    `-320` und ruft `onClosed` genau einmal auf.
- [ ] **Step 2:** Tests ausführen. Erwartet: FAIL.
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** Tests ausführen. Erwartet: PASS.
- [ ] **Step 5: Commit** mit `feat(frontend): add interruptible swipe gesture for the bit sheet`

### Task 10: `LSegmented`

**Files:**

- Create: `frontend/src/components/sheet/LSegmented.vue`
- Test: `frontend/src/components/sheet/sheetControls.test.ts`

**Interfaces:**

- Produces: `<LSegmented generic="T extends string | number | null">`
  - Props
    `{ modelValue: T; options: { value: T; label: string; title?: string }[]; ariaLabel: string }`
  - Emits `update:modelValue: [value: T]`
  - `role="radiogroup"`, Segmente `role="radio"` mit `aria-checked` und Roving-Tabindex
  - ←/→ wählen mit Umlauf. Die Pille (`.segmented__pill`) bewegt sich per `transform` mit Spring.

- [ ] **Step 1: Failing Tests schreiben.**
  - Klick auf das zweite Segment → `update:modelValue` mit dessen Wert.
  - `ArrowRight` auf dem letzten Segment → erstes Segment.
  - Genau ein Segment hat `tabindex="0"`.
- [ ] **Step 2–4:** Tests ausführen und FAIL sehen, implementieren, Tests ausführen und PASS sehen.
- [ ] **Step 5: Commit** mit `feat(frontend): add segmented control`

### Task 11: `LMiniCalendar`

**Files:**

- Create: `frontend/src/components/sheet/LMiniCalendar.vue`
- Test: `frontend/src/components/sheet/sheetControls.test.ts`

**Interfaces:**

- Consumes: `localDate`-Helfer
- Produces:
  - Props `{ modelValue: string | null; today: string; accent: string }`
  - Emits `update:modelValue: [key: string]`
  - `role="grid"`, Woche ab Montag
  - Tage als `button` mit `data-key="YYYY-MM-DD"`, heute mit `aria-current="date"`, die Auswahl mit
    `aria-selected`
  - Tastatur: ←/→ ±1 Tag, ↑/↓ ±7 Tage, Bild↑/Bild↓ ±1 Monat, Enter wählt
  - Der Monatswechsel gleitet horizontal 24 px mit Überblendung, bei Reduced Motion nur
    Überblendung.

- [ ] **Step 1: Failing Tests schreiben.**
  - Oktober 2026 beginnt im Raster an Position 3 (Do), mit drei Leerzellen davor.
  - Klick auf `[data-key="2026-10-20"]` emittiert `'2026-10-20'`.
  - `PageDown` zeigt November.
  - Der Fokus auf dem 31.10. plus `ArrowRight` landet auf dem 1.11. und blättert um.
- [ ] **Step 2–4:** Tests ausführen und FAIL sehen, implementieren, Tests ausführen und PASS sehen.
- [ ] **Step 5: Commit** mit `feat(frontend): add mini calendar`

### Task 12: `LPropertyChip` und Picker

**Files:**

- Create: `frontend/src/components/sheet/LPropertyChip.vue`,
  `frontend/src/components/sheet/LDatePicker.vue`
- Test: `frontend/src/components/sheet/sheetControls.test.ts`

**Interfaces:**

- Produces:
  - **`LPropertyChip`**
    - Props
      `{ icon: Component; label: string; set: boolean; expanded: boolean; tone?: 'default' | 'danger' }`
    - Emits `toggle: []`, `clear: []`
    - Default-Slot für die Inline-Auswahl. Der Wrapper animiert die Höhe per Spring auf
      `scrollHeight` und hat `id` und `aria-controls`.
    - Esc in der Auswahl emittiert `toggle` und fokussiert den Chip. Das × ist nur sichtbar, wenn
      `set` gesetzt ist.
  - **`LDatePicker`**
    - Props
      `{ modelValue: string | null; today: string; accent: string; quick: { label: string; key: string | null }[] }`
    - Emits `update:modelValue: [key: string | null]`
    - Schnellwahl-Buttons über `LMiniCalendar`. Die Fälligkeit nutzt ihn mit _Today, Tomorrow, Next
      week, None_, Snooze mit _Tomorrow, Weekend, Next week_ (Pick date = Kalender).

- [ ] **Step 1: Failing Tests schreiben.**
  - Chip mit `expanded=false` rendert den Slot nicht. Klick emittiert `toggle`, das × emittiert
    `clear` (ohne `toggle`).
  - `tone="danger"` setzt die Klasse `chip--danger`.
  - `LDatePicker`: Die Schnellwahl `None` emittiert `null`.
- [ ] **Step 2–4:** Tests ausführen und FAIL sehen, implementieren, Tests ausführen und PASS sehen.
- [ ] **Step 5: Commit** mit `feat(frontend): add property chip and date picker`

### Task 13: Warteschlange pro Bit und `useBitCommands` (ohne Undo)

**Files:**

- Modify: `frontend/src/stores/bitStore.ts`
- Create: `frontend/src/composables/useBitCommands.ts`
- Test: `frontend/src/stores/flowStores.test.ts`, `frontend/src/composables/useBitCommands.test.ts`

**Interfaces:**

- Produces:
  - **`bitStore.queueUpdate(id: string, patch: Partial<Bit>): Promise<void>`**
    - Wendet den Patch sofort lokal an.
    - Läuft für das Bit schon ein PUT, wird der Patch in `pending` gemergt (das letzte gewinnt je
      Feld). Nach der Antwort geht genau ein PUT mit dem gesammelten Stand raus.
    - Das Promise erfüllt sich, wenn der PUT mit diesem Patch gespeichert ist.
    - Bei einem Fehler werden nur die Felder dieses Patches zurückgesetzt, und nur, wenn kein
      späterer Patch sie inzwischen geändert hat. Dann wird der Fehler geworfen.
  - **`useBitCommands(opts: { layout: () => FlowLayout }): BitCommands`**, per
    `provide(BIT_COMMANDS, …)` in `LWorkspace`:
    - `update(id, patch, meta?: { label?: string; coalesce?: 'title' | 'notes' }): Promise<void>`
    - `complete(id): Promise<{ rolledTo: string | null }>`
    - `reopen(id): Promise<void>`
    - `remove(id): void`
    - `create(fields: CreateFields, pos: { x: number; y: number }, flowId: string | null): Promise<Bit>`
    - `removeDependency(depId): Promise<void>`
  - `export const BIT_COMMANDS: InjectionKey<BitCommands>`
  - `export type CreateFields = Pick<Bit, 'title'> & Partial<Pick<Bit, 'status' | 'priority' | 'dueDate' | 'notes' | 'color' | 'size' | 'recurrence'>>`
  - `bitStore.createBit` nimmt zusätzlich `size` und `recurrence` an.
  - `LWorkspace.toggleDone` (Haken auf der Capsule) ruft `commands.reopen` bzw. `commands.complete`
    auf, statt selbst `updateBit` zu verwenden.

- [ ] **Step 1: Failing Tests schreiben.**
  - `queueUpdate`:
    - Zwei schnelle Patches während eines laufenden PUT → insgesamt genau 2 PUTs, der zweite enthält
      beide Felder.
    - Fehler beim ersten PUT setzt `title` zurück, aber nicht, wenn ein späterer Patch `title` neu
      gesetzt hat.
  - `complete` ohne Wiederholung sendet `{ status: 2 }`.
  - `complete` mit `recurrence: 'daily'` (Fake-Timer):
    - Sofort ist lokal `status 2` gesetzt, ohne PUT.
    - Nach 800 ms gibt es genau einen PUT mit `{ status: 0, dueDate, completedCount: 1 }`.
    - `rolledTo` ist der neue Tag.
- [ ] **Step 2:** Tests ausführen. Erwartet: FAIL.
- [ ] **Step 3: Implementieren.**
  - `remove` ruft in diesem Task direkt `actions.deleteBit(id, opts.layout())` auf. Das verzögerte
    Löschen folgt in Task 17.
  - `removeDependency` ruft `dependencyStore.deleteDependency` auf.
  - `create` ruft `bitStore.createBit` auf.
- [ ] **Step 4:** `npm test --workspace frontend` ausführen. Erwartet: PASS.
- [ ] **Step 5: Commit** mit `feat(frontend): serialize bit updates and add bit commands`

### Task 14: `useBitEditor` und `LBitDetailView`

**Files:**

- Create: `frontend/src/composables/useBitEditor.ts`,
  `frontend/src/components/sheet/LBitDetailView.vue`
- Test: `frontend/src/composables/useBitEditor.test.ts`,
  `frontend/src/components/sheet/LBitDetailView.test.ts`

**Interfaces:**

- Consumes: `BIT_COMMANDS`, `LSegmented`, `LPropertyChip`, `LDatePicker`, `PALETTE`,
  `RECURRENCE_LABEL`, `firstDue`, `SIZE_LABEL`, `SIZE_MINUTES`, `useToday`
- Produces:
  - **`useBitEditor(bitId: Ref<string | null>)`** liefert:
    - `title: Ref<string>`, `notes: Ref<string>`
    - `onTitleInput(v)`, `onNotesInput(v)`: Debounce von 400 ms
    - `onTextBlur(): Promise<void>` (Flush; ein leerer Titel stellt den letzten gespeicherten wieder
      her und setzt `shake.value = true` für 240 ms)
    - `set(patch: Partial<Bit>, label: string): Promise<void>` (sofort)
    - `flush(): Promise<void>`
    - `saveState: Ref<'idle' | 'saving' | 'error'>` (`saving` erst nach 500 ms)
    - `retry(): Promise<void>`
    - `shake: Ref<boolean>`
    - Bei einem Wechsel von `bitId` wird zuerst geflusht.
  - **`LBitDetailView`**
    - Props `{ bitId: string; canGoBack: boolean }`
    - Emits `back: []`, `close: []`, `open-bit: [id: string]`, `focus-node: [ref: NodeRef]`
    - Für die späteren Tasks gibt es die Slots bzw. Bereiche `#complete` (Task 22), `#focus`
      (Task 23) und `#dependencies` (Task 24). Bis dahin zeigt `#complete` einen schlichten
      ◯-Button, der `commands.complete` aufruft.

- [ ] **Step 1: Failing Tests schreiben.**
  - Editor (Fake-Timer):
    - Tippen ohne 400 ms Pause löst keinen Save aus, danach genau einen.
    - `flush()` speichert sofort.
    - Ein leerer Titel wird nicht gesendet und beim Blur wiederhergestellt.
    - `saveState` ist nach 499 ms noch `idle`, nach 500 ms `saving`.
    - Bei einem Fehler wird es `error`, und `retry` sendet den Entwurf erneut.
  - View:
    - Status-Segment „Done“ ruft `commands.complete` auf.
    - Der Priorität-Chip öffnet die Auswahl, `!!!` sendet `{ priority: 3 }`.
    - Es ist immer nur ein Chip offen.
    - Der Fälligkeits-Chip bekommt `tone="danger"`, wenn das Bit überfällig ist.
    - Wiederholung ohne Fälligkeit setzt `dueDate = dueToApi(firstDue(rule, today))` mit.
    - Hat das Bit eine Farbe außerhalb der Palette, erscheint sie als zusätzliches Feld vorn.
    - Der Footer zeigt `Created 14 Oct`.
    - Der Delete-Button ruft `commands.remove` ohne Bestätigung auf.
- [ ] **Step 2:** Tests ausführen. Erwartet: FAIL.
- [ ] **Step 3: Implementieren** nach dem Layout aus Spec → „Detail-Ansicht“.
  - Titel: `textarea` mit Auto-Höhe, 1,25 rem, Gewicht 650, Tracking −0,015 em, maximal 500 Zeichen.
  - Notizen: wachsen bis 12 Zeilen, maximal 10 000 Zeichen.
  - Der Aufwand-Chip zeigt den Richtwert `≈ 30 min / 1 h / 3 h / 6 h`.
  - Der Snooze-Chip zeigt gesetzt `☾ until <formatDayShort>`, × setzt `snoozedUntil: null`.
  - Der Wiederholungs-Chip zeigt gesetzt `↻ Weekly` bzw. `↻ Weekly · 12×`. Der Zähler erscheint erst
    ab `completedCount >= 1`.
  - Beim Öffnen liegt der Fokus auf dem Titel, der Cursor steht am Ende.
  - Das Wackeln entfällt bei Reduced Motion; dann gibt es nur einen roten Rand.
  - `useBitEditor` registriert `pagehide` → `flush()`.
  - Der Chevron `‹ New Bits` erscheint nur bei `canGoBack`. `LBitSheet` setzt das, wenn
    `sheetStore.series.length > 0` ist.
- [ ] **Step 4:** `npm test --workspace frontend` ausführen. Erwartet: PASS.
- [ ] **Step 5: Commit** mit `feat(frontend): add live-saving bit detail view`

### Task 15: `LBitSheet`, einfache Capture-Ansicht und Einbau in den Workspace

**Files:**

- Create: `frontend/src/stores/sheetStore.ts`, `frontend/src/components/sheet/LBitSheet.vue`,
  `frontend/src/components/sheet/LCaptureView.vue`
- Modify: `frontend/src/views/LWorkspace.vue`, `frontend/src/views/LWorkspace.test.ts`
- Delete: `frontend/src/components/LBitPanel.vue`, `frontend/src/components/LCreateBitModal.vue`

**Interfaces:**

- **Produces, `sheetStore`:**
  - State:
    - `open: boolean`
    - `view: 'capture' | 'detail'`
    - `bitId: string | null`
    - `origin: { x: number; y: number }` (Canvas-Klickpunkt)
    - `flowId: string | null`
    - `series: { id: string; failed: boolean; fields?: CreateFields }[]`
    - `revealed: number` (0–320, live aus der Geste)
  - Actions:
    - `openCapture(origin, flowId)` leert `series`.
    - `openDetail(id)`
    - `backToCapture()`
    - `close()`
- **`LBitSheet`:**
  - Liest den `sheetStore` und rendert `LCaptureView` bzw. `LBitDetailView`. Der Wechsel zwischen
    Bits ist ein Cross-Fade von 150 ms.
  - `role="dialog"`, `aria-modal="false"`, `aria-label` `New Bits` bzw. `Bit: <title>`
  - Tint: ein Verlauf im Header von `color-mix(--c 8%)` nach transparent
  - Esc schließt zuerst einen offenen Chip (über `provide` eines Flags), sonst das Sheet.
- **`LCaptureView`** (einfache Form):
  - Eine `input`-Zeile und die Liste `series` darüber.
  - **Enter** ruft `commands.create({ title, color: DEFAULT_COLOR }, …)` auf, an der Stelle `origin`
    (zentriert, wie bisher `x − CAPSULE_W/2`, `y − CAPSULE_H/2`), mit `flowId`.
  - **Strg/⌘+Enter** legt an und ruft `openDetail` auf.
  - Klick auf eine Zeile ruft `openDetail` auf.
- **`LWorkspace`:**
  - `LBitPanel` und `<Transition name="sheet">` werden entfernt, ebenso das CSS `.sheet-*`.
  - `createBit()` → `sheetStore.openCapture(contextCanvasPos, flowAt(...))`
  - `openBitDetail(id)` → `sheetStore.openDetail(id)`
  - Der Canvas-Container nutzt `transform: translateX(${sheetStore.revealed}px)` ohne CSS-Transition
    (vorher `300px` mit Transition).

- [ ] **Step 1: `LWorkspace.test.ts` umstellen** (`findComponent({ name: 'LBitPanel' })` und
      `confirm` ersetzen):
  - Doppelklick im Flow-Frame → `.capture input` füllen, Enter → POST enthält `flowId: 'f9'`
  - außerhalb → POST ohne `flowId`
  - Klick auf eine Capsule öffnet die Detail-Ansicht mit dem Titel des Bits.
  - Esc schließt das Sheet.
- [ ] **Step 2:** Tests ausführen. Erwartet: FAIL.
- [ ] **Step 3:** Implementieren und die alten Dateien löschen.
  - In `LBitSheet` kommen `@media (prefers-reduced-transparency: reduce)` (massiver
    `--surface1`-Hintergrund, kein `backdrop-filter`) und `@media (prefers-contrast: more)` (Rand in
    `--text2`) dazu.
  - Bei Reduced Motion blendet das Sheet in 200 ms über, statt zu gleiten.
- [ ] **Step 4:** `npm run lint && npm run type-check && npm test` ausführen. Erwartet: alles grün.
- [ ] **Step 5: Im Browser prüfen.**
  - `docker compose up -d`, dann `http://localhost:5173` öffnen.
  - Doppelklick → Capture, drei Bits per Enter.
  - Eine Capsule anklicken → Detail. Titel tippen, die Capsule ändert sich live.
  - Das Sheet mit der Maus wegziehen: langsam bis 30 % (federt zurück), schneller Wurf (schließt),
    während des Schließens erneut greifen.
- [ ] **Step 6: Commit** mit `feat(frontend): replace bit panel with swipeable bit sheet`

---

## Phase 4 — Undo

### Task 16: `historyStore` mit Toast-Zustand

**Files:**

- Create: `frontend/src/stores/historyStore.ts`
- Test: `frontend/src/stores/historyStore.test.ts`

**Interfaces:**

- Produces:
  - **`HistoryEntry`**:
    `{ id: string; bitId: string; label: string; coalesceKey?: string; sealed: boolean; patch?: { before: Partial<Bit>; after: Partial<Bit> }; undo(): Promise<void>; redo(): Promise<void> }`
  - **`historyStore`:**
    - `push(entry)`: leert Redo, Grenze 50, das älteste fliegt raus
    - `top()`
    - `seal()`: versiegelt den obersten Eintrag
    - `drop(id)`
    - `undo()`, `redo()`
    - `undoEntry(id)`: nur, wenn der Eintrag noch im Stapel ist. Der Eintrag wandert auf den
      Redo-Stapel.
    - `canUndo`, `canRedo`
  - **`Toast`**:
    `{ id: string; message: string; undoable: boolean; entryId?: string; onCommit?: () => Promise<void> }`
  - **Toast-API:**
    - `toast: Ref<Toast | null>`
    - `showToast(t)`: führt den `onCommit` des vorherigen Toasts sofort aus
    - `pauseToast()`, `resumeToast()`
    - `undoToast()`: `undoEntry(entryId)`, ohne Commit
    - `dismissToast()`: ohne Commit
    - `TOAST_MS = 6000`. Läuft die Zeit ab, wird `onCommit` ausgeführt und der Toast entfernt.

- [ ] **Step 1: Failing Tests schreiben** (Fake-Timer):
  - `push` nach `undo` leert Redo.
  - Der 51. Eintrag verdrängt den ersten.
  - Ablauf nach 6000 ms ruft `onCommit` einmal auf, nicht nach 5999 ms.
  - `pause` bei 3000 ms, `resume` nach 10 s → Commit erst 3000 ms nach `resume`.
  - Ein neuer `showToast` committet den alten sofort.
  - `undoToast` ruft `undo` des Eintrags auf und keinen Commit.
- [ ] **Step 2–4:** Tests ausführen und FAIL sehen, implementieren, Tests ausführen und PASS sehen.
- [ ] **Step 5: Commit** mit `feat(frontend): add bit history store with undo toast state`

### Task 17: Undo in `useBitCommands`, verzögertes Löschen

**Files:**

- Modify: `frontend/src/composables/useBitCommands.ts`, `frontend/src/stores/bitStore.ts`,
  `frontend/src/stores/dependencyStore.ts`, `frontend/src/views/LWorkspace.vue`
- Test: `frontend/src/composables/useBitCommands.test.ts`, `frontend/src/stores/flowStores.test.ts`

**Interfaces:**

- Consumes: `historyStore` (Task 16)
- **Produces:**
  - **`bitStore`:**
    - `hiddenIds: Ref<Set<string>>`
    - `hide(id)`, `unhide(id)`
    - `visibleBits` als computed, ohne versteckte Bits
  - **`LWorkspace`** nutzt `visibleBits` überall dort, wo heute `bitStore.bits` gerendert,
    gelayoutet oder gefiltert wird. Pfeile mit versteckten Enden entfallen.
  - **`dependencyStore.createDependency(from, to, id?: string)`:** Ohne `id` wird wie bisher
    `uuidv7()` vergeben.
  - **Die Commands schreiben History-Einträge:**
    - `update` mit `coalesce`: Ist der oberste Eintrag nicht versiegelt und hat dieselbe `bitId` und
      denselben `coalesceKey`, wird `after` gemergt. Sonst entsteht ein neuer Eintrag. Ein Timer von
      1,5 s Ruhe ruft `seal()` auf.
    - `complete` und `reopen`: Der Eintrag enthält Vorher- und Nachher-Patch und zeigt den Toast
      `Done` bzw. `↻ Next: <formatDayShort>`, `undoable: true`.
    - `create`: Undo löscht sofort über `actions.deleteBit`, Redo legt mit derselben `id` neu an.
    - `removeDependency`: Undo legt mit derselben `id` neu an.
    - **`remove(id)`:**
      - `hide(id)`; läuft dafür ein Fokus-Timer, wird er abgebrochen (Hook `onRemove` für Task 23,
        bis dahin no-op); ist das Sheet auf diesem Bit offen, schließt es.
      - Eintrag mit `undo = unhide + dismissToast`.
      - `showToast({ message: 'Bit deleted', onCommit })`
      - `onCommit = actions.deleteBit(id, layout())`, danach `drop(entry.id)`.
      - Ein Fehler ruft `unhide` auf und zeigt den Toast `Couldn't delete` (`undoable: false`).
    - **`pagehide`-Listener:** Bei einem offenen Lösch-Toast geht ein `fetch(`${api.defaults.baseURL
      ?? ''}/api/bit/${id}`, { method: 'DELETE', keepalive: true, credentials: 'include' })` raus.

- [ ] **Step 1: Failing Tests schreiben.**
  - Drei Titel-Updates innerhalb von 1,5 s ergeben 1 Eintrag. Nach 1,5 s Pause entsteht beim
    nächsten Update ein zweiter.
  - `undo` eines Updates sendet die alten Werte.
  - Löschen:
    - Das Bit fehlt sofort in `visibleBits`, ohne DELETE.
    - `undo` vor 6 s → wieder sichtbar und kein DELETE.
    - Nach 6 s gibt es genau einen DELETE-Aufruf über `deleteBit`.
  - Löschen eines Bits, das im Sheet offen ist, setzt `sheetStore.open = false`.
  - Ein Commit-Fehler macht das Bit wieder sichtbar und zeigt `Couldn't delete`.
  - Abhaken mit Wiederholung, dann Undo → `status`, `dueDate` und `completedCount` haben die alten
    Werte (Review Focus 2).
  - `removeDependency` und dann Undo →
    `api.post('/api/dependency', expect.objectContaining({ id: <alte id> }))`
- [ ] **Step 2:** Tests ausführen. Erwartet: FAIL.
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** `npm test --workspace frontend` ausführen. Erwartet: PASS.
- [ ] **Step 5: Commit** mit `feat(frontend): undo bit edits and delete bits with a grace period`

### Task 18: `LUndoToast` und Tastatur

**Files:**

- Create: `frontend/src/components/LUndoToast.vue`
- Modify: `frontend/src/views/LWorkspace.vue`, `frontend/src/composables/useBitEditor.ts`
  (`onTextBlur` ruft `history.seal()` auf)
- Test: `frontend/src/components/toolComponents.test.ts`, `frontend/src/views/LWorkspace.test.ts`

**Interfaces:**

- Consumes: `historyStore`
- **Produces:**
  - **`LUndoToast`:**
    - Unten mittig, 24 px Abstand, Klasse `material--regular`, Pill-Form.
    - `role="status"`, `aria-live="polite"`
    - Der Knopf `.toast__undo` ist nur sichtbar, wenn `undoable`.
    - `mouseenter`/`mouseleave` rufen `pauseToast`/`resumeToast` auf.
    - Rein und raus jeweils 12 px nach unten mit Deckkraft per `Spring`.
  - **`LWorkspace` `keydown`:**
    - Strg/⌘+Z → `history.undo()`
    - Strg/⌘+Umschalt+Z → `history.redo()`
    - Beides nur, wenn das Ziel nicht editierbar ist. Dafür wird `isEditable` aus `toolStore`
      exportiert und wiederverwendet.

- [ ] **Step 1: Failing Tests schreiben.**
  - Toast: Klick auf Undo ruft `undoToast` auf; Hover pausiert.
  - Workspace:
    - Strg+Z bei Fokus auf `textarea` ruft `history.undo` **nicht** auf.
    - Auf `body` ruft es `history.undo` auf.
    - Löschen über das Sheet → Toast `Bit deleted` sichtbar, Klick auf Undo → Capsule wieder im DOM.
- [ ] **Step 2–4:** Tests ausführen und FAIL sehen, implementieren, Tests ausführen und PASS sehen.
- [ ] **Step 5: Commit** mit `feat(frontend): add undo toast and undo shortcuts`

---

## Phase 5 — Capture

### Task 19: Smart-Eingabe-Parser

**Files:**

- Create: `frontend/src/helpers/quickEntry.ts`
- Test: `frontend/src/helpers/quickEntry.test.ts`

**Interfaces:**

- Consumes: `localDate`, `colorByName`, `Recurrence`, `firstDue`
- **Produces:**
  - `type TokenKind = 'due' | 'priority' | 'color' | 'size' | 'recurrence'`
  - `interface QuickEntry` wie in der Spec, mit `dueDate` als Tages-Key
  - `parseQuickEntry(text: string, now: Date, literal?: ReadonlySet<number>): QuickEntry`
  - `stripToken(text: string, token: { start: number; end: number }): string`: entfernt das Token
    und überzählige Leerzeichen

**Regeln, die die Spec offen lässt (hier festgelegt):**

- **Wörter:**
  - Zerlegung an Leerzeichen mit Positionen.
  - Wort-Tokens werden vom Ende her gelesen, mit Mustern aus 3, 2 und 1 Wort (längstes zuerst).
  - Sigil-Tokens im Endbereich unterbrechen das Lesen nicht.
  - Das erste Wort, das kein Token ist, beendet die Suche.
- **Wochentage:**
  - Englisch kurz und lang (`mon`…`sun`, `monday`…`sunday`), Deutsch lang (`montag`…`sonntag`).
  - Deutsch 2-Buchstaben **nur mit Punkt** (`mo.`…`so.`).
  - Optional mit `nächsten`/`next` davor.
- **`D.M.`:** Liegt das Datum dieses Jahr vor heute, gilt das nächste Jahr.
- **`jeden <wochentag>` / `every <weekday>`:** ergibt `recurrence: 'weekly'` und `dueDate` =
  nächster passender Tag (heute zählt mit).
- **`täglich`/`daily`/`jeden tag`/`every day`/`werktags`/`weekdays`/`wöchentlich`/`weekly`/`monatlich`/`monthly`:**
  setzen nur die Regel. Liegt kein Datum vor, kommt `dueDate = firstDue(rule, today)` dazu.
- **Sigils:**
  - `!{1,3}` als ganzes Wort
  - `#<name>` nur, wenn `colorByName` einen Treffer liefert (`#1` bleibt Text)
  - `~(s|m|l|xl)`
  - Gilt eine Art mehrfach, gewinnt das Vorkommen, das im Text am weitesten rechts steht.

- [ ] **Step 1: Failing Tests schreiben** (`now = new Date(2026, 9, 16, 10)`, das ist Freitag, der
      16.10.2026). Format: `[input, erwarteter Titel, erwartete Felder]`.
  - **Erkannt:**
    - `'Steuer abgeben morgen !! #rot'` → `'Steuer abgeben'`,
      `{ dueDate: '2026-10-17', priority: 2, color: '#ef4444' }`
    - `'Ship release fri !!! #blue'` → `{ dueDate: '2026-10-23', priority: 3, color: '#3b82f6' }`
      (Freitag heute ergibt nächste Woche)
    - `'Bericht nächste woche ~l'` → `{ dueDate: '2026-10-19', size: 3 }`
    - `'Report in 3 days'` → `'2026-10-19'`; `'Report in 2 wochen'` → `'2026-10-30'`
    - `'Party 20.10.'` → `'2026-10-20'`; `'Party 1.2.'` → `'2027-02-01'`
    - `'Party 2026-12-24'` → `'2026-12-24'`
    - `'Müll jeden montag'` → `{ recurrence: 'weekly', dueDate: '2026-10-19' }`
    - `'Standup täglich'` → `{ recurrence: 'daily', dueDate: '2026-10-16' }`
    - `'Termin fr.'` → `'2026-10-23'`
  - **Text bleibt (Review Focus 1):**
    - `'Mail an Fr. Müller'`
    - `'Morgen-Routine planen'`
    - `'Meeting heute vorbereiten'`
    - `'Things to do'`
    - `'And so'`
    - `'Prio #1 klären'`
    - `'Party 31.2.'`
    - Bei allen: Titel unverändert, keine Felder.
  - **Sonderfälle:**
    - `'A !! B !'` → `priority: 1`, Titel `'A B'`
    - `literal` mit dem Start von `morgen` → `'Steuer morgen'` bleibt Titel, kein `dueDate`
    - `'!! #rot'` → Titel `''`
    - Token-Positionen von `'X morgen'`: `[{ start: 2, end: 8, kind: 'due' }]`
- [ ] **Step 2:** `npx vitest run src/helpers/quickEntry --root frontend` ausführen. Erwartet: FAIL.
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** Tests ausführen. Erwartet: PASS.
- [ ] **Step 5: Commit** mit
      `feat(frontend): parse dates, priority, colour, size and repeat from bit titles`

### Task 20: `LQuickEntryInput`

**Files:**

- Create: `frontend/src/components/sheet/LQuickEntryInput.vue`
- Test: `frontend/src/components/sheet/sheetControls.test.ts`

**Interfaces:**

- Consumes: `QuickEntry`
- **Produces:**
  - Props `{ modelValue: string; entry: QuickEntry; placeholder?: string }`
  - Emits `update:modelValue: [v: string]`, `submit: [opts: { details: boolean }]`
  - Struktur:
    `<div class="qe"><div class="qe__mirror" aria-hidden="true">…<mark class="qe__token qe__token--<kind>">…</mark>…</div><input class="qe__input"></div>`
  - Spiegel und Input haben identische Schrift, Padding und Scroll-Position (`scrollLeft` wird bei
    `input` und `scroll` synchronisiert).
  - Enter emittiert `submit({ details: false })`, Strg/⌘+Enter `submit({ details: true })`.

- [ ] **Step 1: Failing Tests schreiben.**
  - Bei `'X morgen'` mit dem passenden `entry` enthält der Spiegel `mark.qe__token--due` mit dem
    Text `morgen`.
  - Enter emittiert `submit` mit `details: false`, Strg+Enter mit `details: true`.
- [ ] **Step 2–4:** Tests ausführen und FAIL sehen, implementieren, Tests ausführen und PASS sehen.
- [ ] **Step 5: Commit** mit `feat(frontend): add quick entry input with token highlighting`

### Task 21: Serie, Platzierung und Geister-Capsule

**Files:**

- Create: `frontend/src/composables/useCapturePlacement.ts`,
  `frontend/src/components/LGhostCapsule.vue`
- Modify: `frontend/src/components/sheet/LCaptureView.vue`, `frontend/src/stores/sheetStore.ts`,
  `frontend/src/views/LWorkspace.vue`
- Test: `frontend/src/composables/useCapturePlacement.test.ts`,
  `frontend/src/views/LWorkspace.test.ts`

**Interfaces:**

- Consumes: `parseQuickEntry`, `stripToken`, `LQuickEntryInput`, `LPropertyChip`, `LDatePicker`,
  `LSegmented`, `capsuleHeight`, `BIT_COMMANDS`
- **Produces:**
  - **`nextSlot(origin: { x: number; y: number }, prev: Rect | null, height: number, layout: FlowLayout): { x: number; y: number }`**
    - Ohne `prev`: `{ x: origin.x - CAPSULE_W / 2, y: origin.y - height / 2 }`
    - Mit `prev`: `{ x: prev.x, y: prev.y + prev.h + 12 }`
    - Überlappt das Rechteck (mit 8 px Rand) ein Bit- oder Packet-Rechteck, gilt
      `y = Unterkante des Hindernisses + 8`. Das wiederholt sich, bis der Platz frei ist.
  - **`sheetStore`** bekommt
    `ghost: { x: number; y: number; h: number; title: string; color: string } | null` und
    `lastRect: Rect | null`.
  - **`LGhostCapsule`**
    - Props `{ ghost }`
    - Deckkraft 0,45, gestrichelter Rand in der Bitfarbe
    - Position und Höhe per `Spring`
  - **`LCaptureView` (vollständig):**
    - Chips Fällig, Priorität, Aufwand, Farbe, live aus `entry` bzw. expliziter Wahl
    - Chip mit Token → Menü `Keep as text` (Start-Index in `literal`) und `Clear` (`stripToken`)
    - Enter:
      - legt mit allen Feldern an (`dueDate` als `dueToApi(entry.dueDate)`)
      - setzt `lastRect`
      - behält nur die Farbe
      - löst die Materialisierung aus: Die neue Capsule startet bei Deckkraft 0,45 und Skalierung
        0,96 und federt auf 1. Dafür setzt `LBitCapsule` eine Klasse `capsule--materialize` für den
        ersten Frame.
    - Fehler → `series`-Zeile `failed` mit Retry. Die Geister-Capsule bleibt.
  - **`LWorkspace`:**
    - `ensureVisible(rect: Rect)`: Liegt das Rect außerhalb von
      `[24, Containerbreite − revealed − 24] × [56 + 16, Höhe − 16]` (Bildschirmkoordinaten im
      Container), ruft es `animateView` mit gleichem Zoom auf, sodass `rect.x` 48 px vom linken
      Containerrand und vertikal mittig liegt.
    - Es wird bei jeder Änderung von `ghost` aufgerufen.

- [ ] **Step 1: Failing Tests schreiben.**
  - `nextSlot`:
    - erster Slot zentriert
    - zweiter Slot 12 px unter `prev`
    - Hindernis-Bit direkt im Weg → Slot darunter
    - zwei Hindernisse hintereinander → unter beiden
  - Workspace:
    - Doppelklick, `'A morgen !!'` Enter, `'B'` Enter → zwei POSTs.
    - Beim ersten POST: `title: 'A'`, `priority: 2`, `dueDate` = morgen.
    - Der zweite POST hat `y = y1 + 32 + 12`.
    - Die Farbe des ersten (über `#grün`) ist beim zweiten erhalten.
    - Die Geister-Capsule ist sichtbar.
- [ ] **Step 2–4:** Tests ausführen und FAIL sehen, implementieren, Tests ausführen und PASS sehen.
- [ ] **Step 5: Im Browser prüfen.** Eine Serie aus 15 Bits bis über den unteren Rand anlegen; der
      Canvas folgt. Mit Strg+Z außerhalb des Feldes das letzte Bit zurücknehmen.
- [ ] **Step 6: Commit** mit `feat(frontend): quick capture series with ghost capsule`

---

## Phase 6 — Momente

### Task 22: Abhaken-Geste

**Files:**

- Create: `frontend/src/components/sheet/LHoldToComplete.vue`
- Modify: `frontend/src/components/sheet/LBitDetailView.vue`,
  `frontend/src/components/sheet/LBitSheet.vue`
- Test: `frontend/src/components/sheet/sheetControls.test.ts`

**Interfaces:**

- **Produces:**
  - Props `{ done: boolean; color: string }`
  - Emits `complete: []`, `reopen: []`
  - `HOLD_MS = 600`, `TAP_MS = 200`
  - Der Ring ist ein SVG-Kreis mit `stroke-dashoffset`, die Füllung linear über
    `requestAnimationFrame`.
  - Früh loslassen → der Ring federt per `Spring` auf 0.
  - Ein Druck unter 200 ms zeigt 1,5 s lang den Tooltip `Hold to complete`.
  - Leertaste oder Enter → sofort `complete`.
  - `done` und Klick → `reopen`.
  - Bei `complete` feuert `navigator.vibrate?.(10)` im selben Handler.
- **In `LBitDetailView`:**
  - `complete` → `commands.complete`
  - Zugleich ruft `LWorkspace` `settle()` auf der Capsule auf, über `sheetStore.settleBitId`, das
    `LWorkspace` beobachtet.
  - Nach 350 ms `close`.

- [ ] **Step 1: Failing Tests schreiben** (Fake-Timer):
  - `pointerdown`, 599 ms, `pointerup` → kein `complete`
  - `pointerdown`, 600 ms → `complete` einmal, `vibrate` mit 10 aufgerufen
  - `pointerdown`, 100 ms, `pointerup` → Tooltip sichtbar
  - `keydown` Leertaste → `complete`
  - `done: true` und Klick → `reopen`
- [ ] **Step 2–4:** Tests ausführen und FAIL sehen, implementieren, Tests ausführen und PASS sehen.
- [ ] **Step 5: Commit** mit `feat(frontend): hold to complete a bit`

### Task 23: Fokus-Timer

**Files:**

- Create: `frontend/src/stores/focusStore.ts`, `frontend/src/components/sheet/LFocusSection.vue`,
  `frontend/src/components/LFocusPill.vue`
- Modify: `frontend/src/stores/bitStore.ts` (`addFocus`),
  `frontend/src/composables/useBitCommands.ts` (`onRemove` → `focus.cancel`),
  `frontend/src/components/LBitCapsule.vue` (`focusing` aus Store),
  `frontend/src/layout/LTaskbar.vue`, `frontend/src/components/sheet/LBitDetailView.vue`,
  `frontend/src/views/LWorkspace.vue` (`restore` und `flushPending` nach `reloadAll`)
- Test: `frontend/src/stores/focusStore.test.ts`, `frontend/src/components/toolComponents.test.ts`

**Interfaces:**

- **`bitStore.addFocus(id: string, seconds: number): Promise<void>`:** erhöht `focusSeconds`
  optimistisch lokal und sendet `POST /api/bit/${id}/focus` mit `{ seconds }`. Bei einem Fehler wird
  lokal zurückgezogen und der Fehler geworfen.
- **`focusStore`:**
  - `running: Ref<{ bitId: string; startedAt: number } | null>`
  - `elapsed: Ref<number>` (Sekunden, tickt jede Sekunde, solange ein Timer läuft)
  - `start(bitId)`: stoppt vorher einen laufenden anderen Timer
  - `stop()`: bucht `min(elapsed, 43200)`, aber nur ab 5 s
  - `cancel()`: ohne Buchung
  - `restore()`
  - `flushPending()`
  - `localStorage`-Schlüssel `listion.focus` und `listion.focus.pending`
- **`LFocusSection`**
  - Props `{ bit: Bit }`
  - Laufend: `12:04` bzw. `1:12:04` mit `tabular-nums`.
  - Balken `<total> of ~<SIZE_MINUTES>` nur bei gesetztem `size`. Über 100 % in Warnfarbe.
  - Sonst die Summe `1 h 20 m tracked` bzw. `No focus time yet` und ▶.
- **`LFocusPill`:** in `LTaskbar` rechts neben dem Filter, nur bei laufendem Timer. Zeigt `●`, den
  Titel (maximal 18 Zeichen mit …), die Zeit und ■. Ein Klick auf den Titel ruft
  `sheetStore.openDetail` auf.

- [ ] **Step 1: Failing Tests schreiben** (Fake-Timer, `api` gemockt):
  - `start` dann `stop` nach 4 s → kein POST
  - nach 65 s → POST `{ seconds: 65 }`
  - `start(a)`, 30 s, `start(b)` → POST für `a` mit 30, `running.bitId === 'b'`
  - `localStorage` mit `startedAt` vor 100 s → `restore()` liefert `elapsed` 100
  - POST schlägt fehl → `listion.focus.pending` enthält `{ a: 65 }`, `flushPending()` sendet nach
  - 13 h → Buchung 43200
  - Löschen eines Bits mit laufendem Timer → `running === null` ohne POST (Review Focus 3)
  - Pill: nur mit Timer gerendert, ■ ruft `stop` auf
- [ ] **Step 2–4:** Tests ausführen und FAIL sehen, implementieren, Tests ausführen und PASS sehen.
- [ ] **Step 5: Commit** mit `feat(frontend): focus timer with taskbar pill`

### Task 24: Abhängigkeiten im Sheet

**Files:**

- Create: `frontend/src/components/sheet/LDependencyList.vue`
- Modify: `frontend/src/components/sheet/LBitDetailView.vue`, `frontend/src/views/LWorkspace.vue`
- Test: `frontend/src/components/sheet/LBitDetailView.test.ts`

**Interfaces:**

- Consumes: `dependencyStore`, `bitStore.visibleBits`, `packetStore`,
  `BIT_COMMANDS.removeDependency`
- **Produces:**
  - Props `{ bitId: string }`
  - Emits `navigate: [ref: NodeRef]`, `hover: [depId: string | null]`
  - Abschnitte `Waiting for` (eingehend) und `Blocking` (ausgehend). Sind beide leer, wird nichts
    gerendert.
  - Jede Zeile zeigt: Status-Punkt bzw. Stack-Icon, Titel bzw. Name, ×, ›.
- **`LWorkspace`:**
  - `hover` → `selectedDependencyId`
  - `navigate` bei einem Bit: `ensureVisible(rect)` und `sheetStore.openDetail(id)`
  - `navigate` bei einem Packet: `focusPacket(id)`

- [ ] **Step 1: Failing Tests schreiben.**
  - Ein Bit mit einem eingehenden und einem ausgehenden Pfeil zeigt beide Abschnitte, ohne Pfeile
    keinen.
  - Klick auf eine Zeile emittiert `navigate` mit dem Ziel.
  - × ruft `removeDependency` auf.
  - `mouseenter` emittiert `hover` mit der Pfeil-ID.
- [ ] **Step 2–4:** Tests ausführen und FAIL sehen, implementieren, Tests ausführen und PASS sehen.
- [ ] **Step 5: Commit** mit `feat(frontend): list and navigate dependencies in the bit sheet`

### Task 25: Filter „Hide snoozed“

**Files:**

- Modify: `frontend/src/stores/toolStore.ts`, `frontend/src/components/LFilterPopover.vue`,
  `frontend/src/views/LWorkspace.vue`
- Test: `frontend/src/stores/toolStore.test.ts`, `frontend/src/components/toolComponents.test.ts`,
  `frontend/src/views/LWorkspace.test.ts`

**Interfaces:**

- **Produces:**
  - `FilterState.hideSnoozed: boolean`
  - `toolStore.setHideSnoozed(v: boolean)`
  - `activeFilterCount` zählt den Schalter mit +1.
  - `loadFilters` liest einen Wert, der kein Boolean ist, als `false`.
- **`LFilterPopover`:** Schalter `Hide snoozed` als `role="switch"` mit `aria-checked`. Emittiert
  `toggle-snoozed`.
- **`LWorkspace`:**
  - Ist `hideSnoozed` aktiv, fehlen gesnoozte **lose** Bits in `looseBits` und in den Pfeilen.
  - Bits in einem Stack bleiben gerendert, aber blass.

- [ ] **Step 1: Failing Tests schreiben.**
  - Store: Persistenz und Zähler.
  - Popover: Klick emittiert `toggle-snoozed`.
  - Workspace: ein loses gesnooztes Bit und ein gesnooztes Bit im Stack, mit Schalter an → das lose
    fehlt im DOM, das im Stack ist da und trägt `capsule--snoozed`.
- [ ] **Step 2–4:** Tests ausführen und FAIL sehen, implementieren, Tests ausführen und PASS sehen.
- [ ] **Step 5: Commit** mit `feat(frontend): filter to hide snoozed bits`

### Task 26: Abschluss-Prüfung

- [ ] **Step 1:** `npm run lint && npm run type-check && npm test && npm run format` ausführen.
      Erwartet: alles grün.
- [ ] **Step 2:** `docker compose restart backend`, dann im Browser (`http://localhost:5173`) jeden
      Punkt aus Spec → Tests → „Manuell im Browser“ durchgehen:
  - Wisch-Geste mit Maus und Touch-Emulation (Viewport `mobile`), Unterbrechen mitten in der
    Bewegung
  - Reduced Motion (DevTools-Emulation)
  - Hell und Dunkel
  - Serie über den Bildschirmrand
  - Abhaken per Halten
  - Fokus-Timer, dann Reload, die Pill läuft weiter
  - Löschen und Undo, das Bit kommt im Packet an derselben Stelle zurück
- [ ] **Step 3:** Was dabei auffällt, bekommt einen Fix mit Test (`fix(frontend): …`), dann wird
      Step 1 wiederholt.
