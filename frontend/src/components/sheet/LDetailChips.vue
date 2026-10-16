<script setup lang="ts">
import {
  computed,
  h,
  ref,
  watch,
  type ComponentPublicInstance,
  type FunctionalComponent,
} from 'vue'
import { Calendar, Flag, Moon, RectangleVertical, Repeat } from 'lucide-vue-next'
import type { Bit } from '@/stores/bitStore'
import { addDays, dueToApi, formatDayShort, toDateKey, weekdayOf } from '@/helpers/localDate'
import { PALETTE } from '@/helpers/palette'
import { isOverdue, isSnoozed, PRIORITY_NAME, SIZE_LABEL, SIZE_MINUTES } from '@/helpers/bitMeta'
import { firstDue, RECURRENCE_LABEL, type Recurrence } from '@/helpers/recurrence'
import LSegmented from './LSegmented.vue'
import LPropertyChip from './LPropertyChip.vue'
import LDatePicker from './LDatePicker.vue'
import LColorGrid from './LColorGrid.vue'

interface Props {
  bit: Bit
  /** Local calendar day, YYYY-MM-DD. */
  today: string
  accent: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  /** A pick or a cleared chip: the fields to save and the history label. */
  set: [patch: Partial<Bit>, label: string]
}>()

const today = computed(() => props.today)
const bit = computed(() => props.bit)

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

// another bit: no picker stays open
watch(
  () => props.bit.id,
  () => {
    open.value = null
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
    priority: b?.priority ? (PRIORITY_NAME[b.priority as 1 | 2 | 3] ?? 'Priority') : 'Priority',
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
      backgroundColor: props.accent,
      boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / 0.12)',
    },
  })

function save(patch: Partial<Bit>, label: string) {
  emit('set', patch, label)
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
</script>

<template>
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
</template>

<style scoped>
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

.picker__quick:focus-visible {
  box-shadow: 0 0 0 2px var(--brand);
}
</style>
