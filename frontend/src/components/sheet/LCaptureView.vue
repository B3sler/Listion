<script setup lang="ts">
import { computed, inject, onMounted, onUnmounted, ref, toRaw, useTemplateRef, watch } from 'vue'
import { CircleAlert, CircleCheck, Circle, X } from 'lucide-vue-next'
import { BIT_COMMANDS, type CreateFields } from '@/composables/useBitCommands'
import { CAPSULE_W, capsuleHeight } from '@/composables/useFlowLayout'
import { useCapturePlacement } from '@/composables/useCapturePlacement'
import { useToday } from '@/composables/useToday'
import { useBitStore } from '@/stores/bitStore'
import { useSheetStore, type Ghost, type SeriesEntry } from '@/stores/sheetStore'
import { dueToApi, fromDateKey } from '@/helpers/localDate'
import { DEFAULT_COLOR } from '@/helpers/palette'
import {
  parseQuickEntry,
  shiftLiteral,
  stripToken,
  type QuickEntryToken,
} from '@/helpers/quickEntry'
import { uuidv7 } from '@/helpers/uuid'
import LQuickEntryInput from './LQuickEntryInput.vue'
import LCaptureChips, { type CaptureChip } from './LCaptureChips.vue'

const emit = defineEmits<{ close: [] }>()

const injected = inject(BIT_COMMANDS)
if (!injected) throw new Error('LCaptureView needs BIT_COMMANDS to be provided')
const commands = injected

const sheet = useSheetStore()
const bitStore = useBitStore()
const today = useToday()

const inputRef = useTemplateRef<InstanceType<typeof LQuickEntryInput>>('inputRef')
const chipsRef = useTemplateRef<InstanceType<typeof LCaptureChips>>('chipsRef')

// ── Smart entry ──────────────────────────────────────────────────────
const text = ref('')
/** Start indices of tokens kept as text. */
const literal = ref<Set<number>>(new Set())
/** Picked on a chip; applies while the text holds no token of that kind. */
const picked = ref<{ due?: string; priority?: 1 | 2 | 3; size?: 1 | 2 | 3 | 4 }>({})

const entry = computed(() => parseQuickEntry(text.value, fromDateKey(today.value), literal.value))

/** Every edit moves the kept-as-text marks along with the text. */
function setText(next: string) {
  literal.value = shiftLiteral(literal.value, text.value, next)
  text.value = next
}

/** The token behind each chip: the last one of its kind (it is the one that counts). */
const tokens = computed(() => {
  const out: Partial<Record<CaptureChip, QuickEntryToken>> = {}
  for (const t of entry.value.tokens) {
    if (t.kind !== 'recurrence') out[t.kind] = t
  }
  return out
})

// a repeat rule alone also sets a due day; a pick then still wins over that implied one
const due = computed(
  () =>
    (tokens.value.due ? entry.value.dueDate : (picked.value.due ?? entry.value.dueDate)) ?? null,
)
const priority = computed(() => entry.value.priority ?? picked.value.priority ?? null)
const size = computed(() => entry.value.size ?? picked.value.size ?? null)
const color = computed(() => entry.value.color ?? sheet.seriesColor ?? DEFAULT_COLOR)
const height = computed(() => capsuleHeight({ size: size.value }))

function keepAsText(kind: CaptureChip) {
  const token = tokens.value[kind]
  if (token) literal.value = new Set(literal.value).add(token.start)
}

function clearToken(kind: CaptureChip) {
  const token = tokens.value[kind]
  if (token) setText(stripToken(text.value, token))
}

function pick<K extends keyof typeof picked.value>(key: K, value: (typeof picked.value)[K] | null) {
  const next = { ...picked.value }
  if (value === null) delete next[key]
  else next[key] = value
  picked.value = next
}

// ── Placement and ghost ──────────────────────────────────────────────
const slot = useCapturePlacement(() => height.value)

/** The ghost this view last showed; a view on its way out must not clear its successor's. */
let shown: Ghost | null = null

watch(
  () => ({ ...slot.value, h: height.value, title: entry.value.title, color: color.value }),
  (ghost) => {
    // the series is over (closing): the ghost goes with the sheet, it does not move again
    if (!sheet.open || sheet.view !== 'capture') return
    shown = ghost
    sheet.ghost = ghost
  },
  { immediate: true },
)

onUnmounted(() => {
  if (shown && toRaw(sheet.ghost) === shown) sheet.ghost = null
})

// ── Series ───────────────────────────────────────────────────────────
/** The series as shown: live titles from the store; a deleted bit drops out. */
const rows = computed(() =>
  sheet.series.flatMap((item) => {
    if (item.failed) return [{ item, title: item.fields?.title ?? '', done: false }]
    const bit = bitStore.bits.find((b) => b.id === item.id)
    return bit ? [{ item, title: bit.title, done: bit.status === 2 }] : []
  }),
)

/** Sends the create; the row and the capsule are there already (optimistic). */
function send(item: SeriesEntry, fields: CreateFields, pos: { x: number; y: number }) {
  sheet.materializeId = fields.id ?? null
  commands.create(fields, pos, sheet.flowId).catch((e: unknown) => {
    console.error('Failed to create bit:', e)
    item.failed = true
    item.fields = fields
    item.pos = pos
    // Ctrl+Enter opened a bit that is gone again: back to the series and its failed row
    if (sheet.open && sheet.view === 'detail' && sheet.bitId === fields.id) sheet.backToCapture()
  })
}

function submit({ details }: { details: boolean }) {
  const parsed = entry.value
  if (!parsed.title) return
  const id = uuidv7()
  const fields: CreateFields = { id, title: parsed.title, color: color.value }
  if (due.value) fields.dueDate = dueToApi(due.value)
  if (priority.value) fields.priority = priority.value
  if (size.value) fields.size = size.value
  if (parsed.recurrence) fields.recurrence = parsed.recurrence
  const pos = { x: slot.value.x, y: slot.value.y }

  // the next bit lines up below this one and keeps only its colour
  sheet.lastRect = { ...pos, w: CAPSULE_W, h: height.value }
  sheet.seriesColor = parsed.color ?? sheet.seriesColor
  text.value = ''
  literal.value = new Set()
  picked.value = {}
  chipsRef.value?.close()

  sheet.series.push({ id, failed: false })
  send(sheet.series[sheet.series.length - 1]!, fields, pos)
  if (details) sheet.openDetail(id)
}

/** The same bit again, under a new id (the failed one may still exist on the server). */
function retry(item: SeriesEntry) {
  const { fields, pos } = item
  if (!fields || !pos) return
  const again = { ...fields, id: uuidv7() }
  item.id = again.id
  item.failed = false
  delete item.fields
  delete item.pos
  send(item, again, pos)
}

function openRow(id: string) {
  sheet.openDetail(id)
}

function focusInput() {
  inputRef.value?.focus()
}

/** For the sheet's Esc: an open chip closes first. */
function closeOpenChip(): boolean {
  return chipsRef.value?.closeOpenChip() ?? false
}

defineExpose({ closeOpenChip })

onMounted(focusInput)
</script>

<template>
  <section class="capture">
    <header class="capture__header">
      <h2 class="capture__title">New Bits</h2>
      <button
        type="button"
        class="capture__close pressable"
        aria-label="Close"
        @click="emit('close')"
      >
        <X :size="14" aria-hidden="true" />
      </button>
    </header>

    <div class="capture__body">
      <ol v-if="rows.length" class="capture__series" aria-label="Created bits">
        <li v-for="row in rows" :key="row.item.id">
          <button
            v-if="!row.item.failed"
            type="button"
            class="capture__row pressable"
            @click="openRow(row.item.id)"
          >
            <component
              :is="row.done ? CircleCheck : Circle"
              class="capture__mark"
              :size="15"
              aria-hidden="true"
            />
            <span class="capture__row-title">{{ row.title }}</span>
          </button>
          <div v-else class="capture__row capture__row--failed">
            <CircleAlert class="capture__mark" :size="15" aria-hidden="true" />
            <span class="capture__row-title">{{ row.title }}</span>
            <span class="capture__failed">Couldn’t create</span>
            <button type="button" class="capture__retry pressable" @click="retry(row.item)">
              Retry
            </button>
          </div>
        </li>
      </ol>

      <LQuickEntryInput
        ref="inputRef"
        :model-value="text"
        :entry="entry"
        placeholder="What needs to be done?"
        @update:model-value="setText"
        @submit="submit"
      />

      <LCaptureChips
        ref="chipsRef"
        class="capture__chips"
        :today="today"
        :due="due"
        :priority="priority"
        :size="size"
        :color="color"
        :color-set="!!entry.color || sheet.seriesColor !== null"
        :tokens="tokens"
        @due="(key) => pick('due', key)"
        @priority="(value) => pick('priority', value)"
        @size="(value) => pick('size', value)"
        @color="(hex) => (sheet.seriesColor = hex)"
        @keep="keepAsText"
        @clear="clearToken"
        @done="focusInput"
      />
    </div>

    <footer class="capture__hints" aria-hidden="true">
      <span><kbd>↵</kbd> next</span>
      <span><kbd>⌃↵</kbd> details</span>
      <span><kbd>esc</kbd> done</span>
    </footer>
  </section>
</template>

<style scoped>
.capture {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

/* ── Header ─────────────────────────────────────────────────────────── */
.capture__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: none;
  padding: 14px 14px 4px 20px;
}

.capture__title {
  margin: 0;
  color: var(--text0);
  font-size: 1.0625rem;
  font-weight: 650;
  letter-spacing: -0.015em;
}

.capture__close {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background-color: var(--fill-hover);
  color: var(--text2);
  cursor: pointer;
  outline: none;
}
.capture__close:hover {
  background-color: var(--fill-press);
  color: var(--text0);
}

/* ── Series, input and chips ────────────────────────────────────────── */
.capture__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-height: 0;
  padding: 8px 12px 12px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--surface3) transparent;
  /* scroll edge effect instead of hard dividers */
  mask-image: linear-gradient(
    to bottom,
    transparent 0,
    #000 8px,
    #000 calc(100% - 14px),
    transparent 100%
  );
}

.capture__series {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.capture__row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 34px;
  padding: 6px 8px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--text1);
  font-family: inherit;
  font-size: 0.9375rem;
  letter-spacing: -0.005em;
  text-align: left;
  cursor: pointer;
  outline: none;
}
button.capture__row:hover {
  background-color: var(--fill-hover);
  color: var(--text0);
}
.capture__row--failed {
  cursor: default;
  color: hsl(0 72% 52%);
}

.capture__mark {
  flex: none;
  color: var(--c);
}
.capture__row--failed .capture__mark {
  color: inherit;
}

.capture__row-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.capture__failed {
  flex: none;
  font-size: 0.75rem;
  font-weight: 550;
}

.capture__retry {
  flex: none;
  height: 24px;
  padding: 0 9px;
  border: none;
  border-radius: 999px;
  background-color: hsl(0 72% 52% / 0.12);
  color: inherit;
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  outline: none;
}
.capture__retry:hover {
  background-color: hsl(0 72% 52% / 0.2);
}

.capture__chips {
  margin-top: 6px;
}

/* ── Keyboard hints ─────────────────────────────────────────────────── */
.capture__hints {
  display: flex;
  gap: 14px;
  flex: none;
  padding: 10px 20px 16px;
  color: var(--text2);
  font-size: 0.75rem;
  letter-spacing: 0.005em;
}
.capture__hints kbd {
  margin-right: 3px;
  font-family: inherit;
  font-weight: 600;
  color: var(--text1);
}

.capture__row:focus-visible,
.capture__close:focus-visible,
.capture__retry:focus-visible {
  box-shadow: 0 0 0 2px var(--brand);
}
</style>
