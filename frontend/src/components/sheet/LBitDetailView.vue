<script setup lang="ts">
import {
  computed,
  h,
  inject,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  toRef,
  useTemplateRef,
  watch,
  type ComponentPublicInstance,
  type FunctionalComponent,
} from 'vue'
import {
  Calendar,
  ChevronLeft,
  Flag,
  Moon,
  RectangleVertical,
  Repeat,
  Trash2,
  X,
} from 'lucide-vue-next'
import type { Bit } from '@/stores/bitStore'
import type { NodeRef } from '@/types/flow'
import { BIT_COMMANDS } from '@/composables/useBitCommands'
import { useBitEditor } from '@/composables/useBitEditor'
import { useToday } from '@/composables/useToday'
import { useSheetStore } from '@/stores/sheetStore'
import { addDays, dueToApi, formatDayShort, toDateKey, weekdayOf } from '@/helpers/localDate'
import { DEFAULT_COLOR, PALETTE } from '@/helpers/palette'
import { isOverdue, isSnoozed, SIZE_LABEL, SIZE_MINUTES } from '@/helpers/bitMeta'
import { firstDue, RECURRENCE_LABEL, type Recurrence } from '@/helpers/recurrence'
import LSegmented from './LSegmented.vue'
import LPropertyChip from './LPropertyChip.vue'
import LDatePicker from './LDatePicker.vue'
import LColorGrid from './LColorGrid.vue'
import LHoldToComplete from './LHoldToComplete.vue'
import LFocusSection from './LFocusSection.vue'
import LDependencyList from './LDependencyList.vue'

interface Props {
  bitId: string
  canGoBack: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  back: []
  close: []
  'open-bit': [id: string]
  'focus-node': [ref: NodeRef]
}>()

const injected = inject(BIT_COMMANDS)
if (!injected) throw new Error('LBitDetailView needs BIT_COMMANDS to be provided')
const commands = injected

const editor = useBitEditor(toRef(props, 'bitId'))
const { bit, title, notes, saveState, shake } = editor
const today = useToday()
const sheet = useSheetStore()

const accent = computed(() => bit.value?.color ?? DEFAULT_COLOR)
const done = computed(() => bit.value?.status === 2)

// ── Title and notes ──────────────────────────────────────────────────
const titleEl = useTemplateRef<HTMLTextAreaElement>('titleEl')
const notesEl = useTemplateRef<HTMLTextAreaElement>('notesEl')

/** Grows the field with its content; the notes cap (12 lines) comes from CSS max-height. */
function fit(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

function onTitleInput(event: Event) {
  const el = event.target as HTMLTextAreaElement
  // a title is one line, even when pasted with line breaks
  const value = el.value.replace(/\s*[\r\n]+\s*/g, ' ')
  editor.onTitleInput(value)
  fit(el)
}

function onTitleKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.isComposing) return
  event.preventDefault()
  notesEl.value?.focus()
}

function onNotesInput(event: Event) {
  const el = event.target as HTMLTextAreaElement
  editor.onNotesInput(el.value)
  fit(el)
}

function focusTitle() {
  const el = titleEl.value
  if (!el) return
  el.focus({ preventScroll: true })
  const end = el.value.length
  el.setSelectionRange(end, end)
}

watch([title, notes], async () => {
  await nextTick()
  fit(titleEl.value)
  fit(notesEl.value)
})

onMounted(async () => {
  await nextTick()
  fit(titleEl.value)
  fit(notesEl.value)
  focusTitle()
})

// ── Chips ────────────────────────────────────────────────────────────
type ChipKey = 'due' | 'priority' | 'size' | 'color' | 'repeat' | 'snooze'

const open = ref<ChipKey | null>(null)
const chipEls = new Map<ChipKey, HTMLElement>()

function chipRef(key: ChipKey) {
  return (el: Element | ComponentPublicInstance | null) => {
    const root = el && '$el' in el ? (el.$el as HTMLElement) : (el as HTMLElement | null)
    if (root) chipEls.set(key, root)
    else chipEls.delete(key)
  }
}

function toggle(key: ChipKey) {
  open.value = open.value === key ? null : key
}

/** Closes the picker after a pick; focus inside it goes back to its chip. */
function closeChip(key: ChipKey) {
  if (open.value === key) open.value = null
  const root = chipEls.get(key)
  if (root && root.contains(document.activeElement)) {
    root.querySelector<HTMLButtonElement>('.chip__btn')?.focus()
  }
}

/**
 * For the sheet's Esc: closes an open picker and reports whether there was one. (The picker
 * handles Esc itself while focus is inside it; this covers focus anywhere else.)
 */
function closeOpenChip(): boolean {
  const key = open.value
  if (key === null) return false
  closeChip(key)
  return true
}

defineExpose({ closeOpenChip })

watch(
  () => props.bitId,
  async () => {
    open.value = null
    await nextTick()
    focusTitle()
  },
)

/** First day after today that falls on `weekday` (0 = Monday … 6 = Sunday). */
function nextWeekday(from: string, weekday: number): string {
  let key = addDays(from, 1)
  while (weekdayOf(key) !== weekday) key = addDays(key, 1)
  return key
}

const MONDAY = 0
const SATURDAY = 5

const dueKey = computed(() => (bit.value?.dueDate ? toDateKey(bit.value.dueDate) : null))
const dueQuick = computed(() => [
  { label: 'Today', key: today.value },
  { label: 'Tomorrow', key: addDays(today.value, 1) },
  { label: 'Next week', key: nextWeekday(today.value, MONDAY) },
  { label: 'None', key: null },
])
const snoozeQuick = computed(() => [
  { label: 'Tomorrow', key: addDays(today.value, 1) },
  { label: 'Weekend', key: nextWeekday(today.value, SATURDAY) },
  { label: 'Next week', key: nextWeekday(today.value, MONDAY) },
])

const PRIORITY_NAME: Record<number, string> = { 1: 'Low', 2: 'Medium', 3: 'High' }
const PRIORITY_OPTIONS: { value: number | null; label: string; title: string }[] = [
  { value: null, label: '—', title: 'None' },
  { value: 1, label: '!', title: 'Low' },
  { value: 2, label: '!!', title: 'Medium' },
  { value: 3, label: '!!!', title: 'High' },
]
type Size = NonNullable<Bit['size']>
const SIZE_OPTIONS: { value: Size | null; label: string }[] = ([1, 2, 3, 4] as const).map(
  (value) => ({ value, label: SIZE_LABEL[value] }),
)
const STATUS_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Open' },
  { value: 1, label: 'In Progress' },
  { value: 2, label: 'Done' },
]
const RECURRENCES = Object.keys(RECURRENCE_LABEL) as Recurrence[]

function minutesLabel(min: number): string {
  return min < 60 ? `${min} min` : `${min / 60} h`
}

const overdue = computed(() => (bit.value ? isOverdue(bit.value, today.value) : false))
const snoozed = computed(() => (bit.value ? isSnoozed(bit.value, today.value) : false))

const labels = computed(() => {
  const b = bit.value
  const size = b?.size ?? null
  const rule = b?.recurrence ?? null
  const count = b?.completedCount ?? 0
  const palette = PALETTE.find((c) => c.hex === b?.color?.toLowerCase())
  return {
    due: dueKey.value ? formatDayShort(dueKey.value, today.value) : 'Due',
    priority: b?.priority ? (PRIORITY_NAME[b.priority] ?? 'Priority') : 'Priority',
    size: size ? `${SIZE_LABEL[size]} · ≈ ${minutesLabel(SIZE_MINUTES[size])}` : 'Size',
    color: b?.color
      ? palette
        ? palette.en.charAt(0).toUpperCase() + palette.en.slice(1)
        : 'Custom'
      : 'Color',
    repeat: rule ? `${RECURRENCE_LABEL[rule]}${count >= 1 ? ` · ${count}×` : ''}` : 'Repeat',
    snooze:
      snoozed.value && b?.snoozedUntil
        ? `until ${formatDayShort(b.snoozedUntil, today.value)}`
        : 'Snooze',
  }
})

const sizeHint = computed(() => {
  const size = bit.value?.size
  return size ? `≈ ${minutesLabel(SIZE_MINUTES[size])}` : 'Rough effort, shapes the capsule'
})

// the colour chip's icon is the bit's colour itself
const ColorDot: FunctionalComponent = () =>
  h('span', {
    'aria-hidden': 'true',
    style: {
      display: 'inline-block',
      flex: 'none',
      width: '0.75rem',
      height: '0.75rem',
      borderRadius: '50%',
      backgroundColor: accent.value,
      boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / 0.12)',
    },
  })

function save(patch: Partial<Bit>, label: string) {
  void editor.set(patch, label)
}

function pickDue(key: string | null) {
  save({ dueDate: dueToApi(key) }, 'Due date')
  closeChip('due')
}

function pickPriority(value: number | null) {
  save({ priority: value }, 'Priority')
}

function pickSize(value: Size | null) {
  if (value !== null) save({ size: value }, 'Size')
}

function pickColor(hex: string) {
  save({ color: hex }, 'Color')
  closeChip('color')
}

function pickRepeat(rule: Recurrence | null) {
  const patch: Partial<Bit> = { recurrence: rule }
  // a repeating bit needs a day to repeat from
  if (rule && !bit.value?.dueDate) patch.dueDate = dueToApi(firstDue(rule, today.value))
  save(patch, 'Repeat')
  closeChip('repeat')
}

function pickSnooze(key: string | null) {
  save({ snoozedUntil: key }, 'Snooze')
  closeChip('snooze')
}

function clearChip(key: ChipKey) {
  if (open.value === key) open.value = null
  const patch: Record<ChipKey, Partial<Bit>> = {
    due: { dueDate: null },
    priority: { priority: null },
    size: { size: null },
    color: { color: null },
    repeat: { recurrence: null },
    snooze: { snoozedUntil: null },
  }
  const label: Record<ChipKey, string> = {
    due: 'Due date',
    priority: 'Priority',
    size: 'Size',
    color: 'Color',
    repeat: 'Repeat',
    snooze: 'Snooze',
  }
  save(patch[key], label[key])
}

// ── Status, completion, delete ───────────────────────────────────────
function report(e: unknown) {
  console.error('Failed to update bit status', e)
}

/** What "Couldn't save · Retry" repeats when completing or reopening failed. */
const retryStatus = ref<(() => void) | null>(null)
/** Ticking off by the gesture closes the sheet this long after the check has landed. */
const CLOSE_AFTER_COMPLETE_MS = 350
let closeTimer: ReturnType<typeof setTimeout> | null = null

function cancelClose() {
  if (closeTimer) clearTimeout(closeTimer)
  closeTimer = null
}

function complete(again: () => void = complete) {
  retryStatus.value = null
  commands.complete(props.bitId).catch((e: unknown) => {
    report(e)
    cancelClose()
    retryStatus.value = again
  })
}

/** The held ◯: complete, let the capsule on the canvas settle, then close the sheet. */
function completeByGesture() {
  complete(completeByGesture)
  sheet.requestSettle(props.bitId)
  cancelClose()
  closeTimer = setTimeout(() => {
    closeTimer = null
    emit('close')
  }, CLOSE_AFTER_COMPLETE_MS)
}

function reopen() {
  retryStatus.value = null
  commands.reopen(props.bitId).catch((e: unknown) => {
    report(e)
    retryStatus.value = reopen
  })
}

/** Footer retry: repeats a failed status change, and what the editor could not save. */
function retry() {
  const again = retryStatus.value
  retryStatus.value = null
  again?.()
  if (saveState.value === 'error') void editor.retry()
}

onBeforeUnmount(cancelClose)

// leaving the sheet (or this bit) ends the hover: no mouseleave reaches a removed row
onBeforeUnmount(() => {
  sheet.hoverDependencyId = null
})

async function setStatus(value: number) {
  const b = bit.value
  if (!b || value === b.status) return
  if (value === 2) return complete()
  if (b.status === 2) {
    // leaving Done is one step, also straight to In Progress (one undo restores Done)
    try {
      await commands.reopen(b.id, value === 1 ? 1 : 0)
    } catch (e) {
      report(e)
    }
    return
  }
  await editor.set({ status: value }, 'Status')
}

function remove() {
  void editor.flush()
  commands.remove(props.bitId)
  emit('close')
}

const created = computed(() =>
  bit.value
    ? new Date(bit.value.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : '',
)
</script>

<template>
  <section v-if="bit" class="detail" :style="{ '--c': accent }">
    <header class="detail__header">
      <button v-if="canGoBack" type="button" class="detail__back pressable" @click="emit('back')">
        <ChevronLeft :size="16" aria-hidden="true" />
        New Bits
      </button>
      <span v-else />
      <button
        type="button"
        class="detail__close pressable"
        aria-label="Close"
        @click="emit('close')"
      >
        <X :size="14" aria-hidden="true" />
      </button>
    </header>

    <div class="detail__body">
      <div class="detail__head">
        <LHoldToComplete
          :done="done"
          :color="accent"
          @complete="completeByGesture"
          @reopen="reopen"
        />
        <textarea
          ref="titleEl"
          class="detail__title"
          :class="{ 'detail__title--shake': shake }"
          :value="title"
          rows="1"
          maxlength="500"
          placeholder="Title"
          aria-label="Title"
          spellcheck="true"
          @input="onTitleInput"
          @keydown="onTitleKeydown"
          @blur="editor.onTextBlur()"
        />
      </div>

      <!-- ariaLabel in camelCase: vue-tsc does not map aria-label onto a generic component's prop -->
      <LSegmented
        :model-value="bit.status"
        :options="STATUS_OPTIONS"
        ariaLabel="Status"
        @update:model-value="setStatus"
      />

      <div class="detail__chips">
        <LPropertyChip
          :ref="chipRef('due')"
          data-chip="due"
          :icon="Calendar"
          :label="labels.due"
          :set="!!dueKey"
          :expanded="open === 'due'"
          :tone="overdue ? 'danger' : 'default'"
          @toggle="toggle('due')"
          @clear="clearChip('due')"
        >
          <LDatePicker
            :model-value="dueKey"
            :today="today"
            :accent="accent"
            :quick="dueQuick"
            @update:model-value="pickDue"
          />
        </LPropertyChip>

        <LPropertyChip
          :ref="chipRef('priority')"
          data-chip="priority"
          :icon="Flag"
          :label="labels.priority"
          :set="!!bit.priority"
          :expanded="open === 'priority'"
          @toggle="toggle('priority')"
          @clear="clearChip('priority')"
        >
          <div class="detail__picker">
            <LSegmented
              :model-value="bit.priority ?? null"
              :options="PRIORITY_OPTIONS"
              ariaLabel="Priority"
              @update:model-value="pickPriority"
            />
          </div>
        </LPropertyChip>

        <LPropertyChip
          :ref="chipRef('size')"
          data-chip="size"
          :icon="RectangleVertical"
          :label="labels.size"
          :set="!!bit.size"
          :expanded="open === 'size'"
          @toggle="toggle('size')"
          @clear="clearChip('size')"
        >
          <div class="detail__picker">
            <LSegmented
              :model-value="bit.size ?? null"
              :options="SIZE_OPTIONS"
              ariaLabel="Size"
              @update:model-value="pickSize"
            />
            <p class="detail__hint">{{ sizeHint }}</p>
          </div>
        </LPropertyChip>

        <LPropertyChip
          :ref="chipRef('color')"
          data-chip="color"
          :icon="ColorDot"
          :label="labels.color"
          :set="!!bit.color"
          :expanded="open === 'color'"
          @toggle="toggle('color')"
          @clear="clearChip('color')"
        >
          <LColorGrid :model-value="bit.color ?? null" @update:model-value="pickColor" />
        </LPropertyChip>

        <LPropertyChip
          :ref="chipRef('repeat')"
          data-chip="repeat"
          :icon="Repeat"
          :label="labels.repeat"
          :set="!!bit.recurrence"
          :expanded="open === 'repeat'"
          @toggle="toggle('repeat')"
          @clear="clearChip('repeat')"
        >
          <div class="detail__picker detail__quicks">
            <button
              v-for="rule in RECURRENCES"
              :key="rule"
              type="button"
              class="picker__quick pressable"
              :class="{ 'picker__quick--active': bit.recurrence === rule }"
              :aria-pressed="bit.recurrence === rule"
              @click="pickRepeat(rule)"
            >
              {{ RECURRENCE_LABEL[rule] }}
            </button>
            <button
              type="button"
              class="picker__quick pressable"
              :class="{ 'picker__quick--active': !bit.recurrence }"
              :aria-pressed="!bit.recurrence"
              @click="pickRepeat(null)"
            >
              None
            </button>
          </div>
        </LPropertyChip>

        <LPropertyChip
          :ref="chipRef('snooze')"
          data-chip="snooze"
          :icon="Moon"
          :label="labels.snooze"
          :set="snoozed"
          :expanded="open === 'snooze'"
          @toggle="toggle('snooze')"
          @clear="clearChip('snooze')"
        >
          <LDatePicker
            :model-value="snoozed ? (bit.snoozedUntil ?? null) : null"
            :today="today"
            :accent="accent"
            :quick="snoozeQuick"
            @update:model-value="pickSnooze"
          />
        </LPropertyChip>
      </div>

      <textarea
        ref="notesEl"
        class="detail__notes"
        :value="notes"
        rows="2"
        maxlength="10000"
        placeholder="Notes"
        aria-label="Notes"
        @input="onNotesInput"
        @blur="editor.onTextBlur()"
      />

      <slot name="focus" :bit="bit"><LFocusSection :bit="bit" /></slot>
      <slot name="dependencies" :bit="bit">
        <LDependencyList
          :bit-id="bit.id"
          @navigate="(target) => emit('focus-node', target)"
          @hover="(depId) => (sheet.hoverDependencyId = depId)"
        />
      </slot>
    </div>

    <footer class="detail__footer">
      <div class="detail__meta">
        <span class="detail__created">Created {{ created }}</span>
        <span class="detail__save" role="status" aria-live="polite">
          <template v-if="saveState === 'saving'">Saving…</template>
          <template v-else-if="saveState === 'error' || retryStatus">
            Couldn’t save ·
            <button type="button" class="detail__retry pressable" @click="retry">Retry</button>
          </template>
        </span>
      </div>
      <button type="button" class="detail__delete pressable" @click="remove">
        <Trash2 :size="13" aria-hidden="true" />
        Delete
      </button>
    </footer>
  </section>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

/* ── Header ─────────────────────────────────────────────────────────── */
.detail__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: none;
  padding: 14px 14px 4px 10px;
}

.detail__back {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 28px;
  padding: 0 10px 0 4px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--brand);
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 550;
  letter-spacing: -0.005em;
  cursor: pointer;
  outline: none;
}
.detail__back:hover {
  background-color: var(--fill-hover);
}

.detail__close {
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
.detail__close:hover {
  background-color: var(--fill-press);
  color: var(--text0);
}

/* ── Body ───────────────────────────────────────────────────────────── */
.detail__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
  min-height: 0;
  padding: 6px 16px 16px;
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

/* the body scrolls instead of squashing content: no child (notes, chips, …) may shrink */
.detail__body > :deep(*) {
  flex-shrink: 0;
}

.detail__head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.detail__title {
  flex: 1;
  min-width: 0;
  margin: 0;
  padding: 2px 4px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text0);
  font-family: inherit;
  font-size: 1.25rem;
  font-weight: 650;
  line-height: 1.25;
  letter-spacing: -0.015em;
  resize: none;
  overflow: hidden;
  outline: none;
  transition: box-shadow 0.3s ease;
}
.detail__title::placeholder,
.detail__notes::placeholder {
  color: var(--text2);
  opacity: 0.6;
}

/* empty title rejected: shake 3 × 4 px in 240 ms */
.detail__title--shake {
  animation: shake 240ms linear;
}
@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  16.6%,
  50%,
  83.3% {
    transform: translateX(-4px);
  }
  33.3%,
  66.6% {
    transform: translateX(4px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .detail__title--shake {
    animation: none;
    box-shadow: inset 0 0 0 1.5px hsl(0 72% 52%);
    transition: none;
  }
}

/* ── Chips ──────────────────────────────────────────────────────────── */
.detail__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 6px;
}
/* an open picker (also while it closes) takes the full sheet width */
.detail__chips :deep([data-chip]:has(> .chip__region > *)) {
  flex-basis: 100%;
}

.detail__picker {
  padding: 10px 2px 4px;
}

.detail__hint {
  margin: 8px 2px 0;
  color: var(--text2);
  font-size: 0.75rem;
  letter-spacing: 0.005em;
  font-variant-numeric: tabular-nums;
}

.detail__quicks {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.picker__quick {
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--material-stroke);
  border-radius: 999px;
  background-color: var(--fill-hover);
  color: var(--text1);
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 550;
  white-space: nowrap;
  cursor: pointer;
  outline: none;
}
.picker__quick:hover {
  color: var(--text0);
}
.picker__quick--active {
  background-color: var(--fill-press);
  color: var(--text0);
}

/* ── Notes ──────────────────────────────────────────────────────────── */
.detail__notes {
  margin: 0;
  padding: 4px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text1);
  font-family: inherit;
  font-size: 0.9375rem;
  line-height: 1.5;
  letter-spacing: -0.005em;
  resize: none;
  outline: none;
  /* grows to 12 lines, then scrolls */
  max-height: calc(12 * 1.5em + 8px);
  overflow-y: auto;
}

/* ── Footer ─────────────────────────────────────────────────────────── */
.detail__footer {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex: none;
  padding: 10px 12px 14px 20px;
}

.detail__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  color: var(--text2);
  font-size: 0.75rem;
  letter-spacing: 0.005em;
}
.detail__save:empty {
  display: none;
}

.detail__retry {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--brand);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  outline: none;
}

.detail__delete {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px 0 10px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: hsl(0 72% 52%);
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 550;
  letter-spacing: -0.005em;
  cursor: pointer;
  outline: none;
}
.detail__delete:hover {
  background-color: hsl(0 72% 50% / 0.1);
}

/* ── Focus rings ────────────────────────────────────────────────────── */
.detail__back:focus-visible,
.detail__close:focus-visible,
.picker__quick:focus-visible,
.detail__retry:focus-visible,
.detail__delete:focus-visible {
  box-shadow: 0 0 0 2px var(--brand);
}
.detail__title:focus-visible,
.detail__notes:focus-visible {
  box-shadow: inset 0 0 0 1px var(--material-stroke);
}
</style>
