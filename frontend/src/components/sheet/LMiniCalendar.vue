<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { addDays, weekdayOf } from '@/helpers/localDate'

interface Props {
  modelValue: string | null
  today: string
  accent: string
}

const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [key: string] }>()

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

const root = useTemplateRef<HTMLElement>('root')

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0')
}

/** 'YYYY-MM' of a day key. */
function monthOf(key: string): string {
  return key.slice(0, 7)
}

function daysInMonth(year: number, month: number): number {
  // month is 1-based: day 0 of the next month is the last day of this one
  return new Date(year, month, 0).getDate()
}

/** Same day-of-month `n` months away, clamped to the target month's last day. */
function shiftMonth(key: string, n: number): string {
  const year = Number(key.slice(0, 4))
  const month = Number(key.slice(5, 7))
  const day = Number(key.slice(8, 10))
  const index = year * 12 + (month - 1) + n
  const ty = Math.floor(index / 12)
  const tm = (index % 12) + 1
  return `${pad(ty, 4)}-${pad(tm)}-${pad(Math.min(day, daysInMonth(ty, tm)))}`
}

// The roving "active day" is always inside the displayed month; it is the one tab stop.
const initial = props.modelValue ?? props.today
const activeKey = ref(initial)
const viewMonth = ref(monthOf(initial))
// travel direction of the last month change: 1 = forward (content moves left), -1 = back
const direction = ref<1 | -1>(1)

const title = computed(() => {
  const [year, month] = viewMonth.value.split('-')
  return `${MONTHS[Number(month) - 1]} ${year}`
})

interface Cell {
  key: string | null
  day: number
}

const weeks = computed<Cell[][]>(() => {
  const year = Number(viewMonth.value.slice(0, 4))
  const month = Number(viewMonth.value.slice(5, 7))
  const lead = weekdayOf(`${viewMonth.value}-01`)
  const cells: Cell[] = Array.from({ length: lead }, () => ({ key: null, day: 0 }))
  for (let d = 1; d <= daysInMonth(year, month); d++) {
    cells.push({ key: `${viewMonth.value}-${pad(d)}`, day: d })
  }
  while (cells.length % 7 !== 0) cells.push({ key: null, day: 0 })
  const rows: Cell[][] = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
  return rows
})

function show(key: string) {
  const from = viewMonth.value
  const to = monthOf(key)
  if (to !== from) direction.value = to > from ? 1 : -1
  activeKey.value = key
  viewMonth.value = to
}

function focusActive() {
  root.value?.querySelector<HTMLElement>(`[data-key="${activeKey.value}"]`)?.focus()
}

async function moveActive(key: string) {
  show(key)
  await nextTick()
  focusActive()
}

function stepMonth(n: number) {
  show(shiftMonth(activeKey.value, n))
}

function select(key: string) {
  activeKey.value = key
  emit('update:modelValue', key)
}

function onKeydown(event: KeyboardEvent, key: string) {
  let next: string
  switch (event.key) {
    case 'ArrowLeft':
      next = addDays(key, -1)
      break
    case 'ArrowRight':
      next = addDays(key, 1)
      break
    case 'ArrowUp':
      next = addDays(key, -7)
      break
    case 'ArrowDown':
      next = addDays(key, 7)
      break
    case 'PageUp':
      next = shiftMonth(key, -1)
      break
    case 'PageDown':
      next = shiftMonth(key, 1)
      break
    case 'Enter':
      event.preventDefault()
      select(key)
      return
    default:
      return
  }
  event.preventDefault()
  void moveActive(next)
}

// an outside change of the selection brings its month into view
watch(
  () => props.modelValue,
  (value) => {
    if (value) show(value)
  },
)
</script>

<template>
  <div ref="root" class="cal" :style="{ '--cal-accent': accent, '--cal-dir': direction }">
    <div class="cal__header">
      <button
        type="button"
        class="cal__nav pressable"
        aria-label="Previous month"
        @click="stepMonth(-1)"
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path d="M10 3.5 5.5 8l4.5 4.5" />
        </svg>
      </button>
      <div class="cal__title" aria-live="polite">{{ title }}</div>
      <button
        type="button"
        class="cal__nav pressable"
        aria-label="Next month"
        @click="stepMonth(1)"
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path d="m6 3.5 4.5 4.5L6 12.5" />
        </svg>
      </button>
    </div>

    <div class="cal__grid" role="grid" :aria-label="title">
      <div class="cal__row" role="row">
        <div v-for="name in WEEKDAYS" :key="name" class="cal__weekday" role="columnheader">
          {{ name }}
        </div>
      </div>
      <div class="cal__viewport">
        <Transition name="cal-slide">
          <div :key="viewMonth" class="cal__body" role="rowgroup">
            <div v-for="(week, w) in weeks" :key="w" class="cal__row" role="row">
              <div
                v-for="(cell, i) in week"
                :key="i"
                class="cal__cell"
                role="gridcell"
                :aria-selected="cell.key ? cell.key === modelValue : undefined"
              >
                <button
                  v-if="cell.key"
                  type="button"
                  class="cal__day pressable"
                  :class="{
                    'cal__day--today': cell.key === today,
                    'cal__day--selected': cell.key === modelValue,
                  }"
                  :data-key="cell.key"
                  :aria-current="cell.key === today ? 'date' : undefined"
                  :tabindex="cell.key === activeKey ? 0 : -1"
                  @click="select(cell.key)"
                  @keydown="onKeydown($event, cell.key)"
                >
                  {{ cell.day }}
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cal {
  --cal-day: 32px;
  --cal-gap: 2px;
  width: 100%;
  max-width: 280px;
  user-select: none;
}

.cal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.cal__title {
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text0);
}
.cal__nav {
  display: grid;
  place-items: center;
  width: var(--cal-day);
  height: var(--cal-day);
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text1);
  cursor: pointer;
  outline: none;
}
.cal__nav svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.cal__nav:hover {
  background-color: var(--fill-hover);
  color: var(--text0);
}
.cal__nav:focus-visible,
.cal__day:focus-visible {
  box-shadow: 0 0 0 2px var(--brand);
}

.cal__row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}
.cal__weekday {
  display: grid;
  place-items: center;
  height: 24px;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--text2);
}

/* six rows always fit: the picker keeps its height from month to month */
.cal__viewport {
  position: relative;
  min-height: calc(6 * var(--cal-day) + 5 * var(--cal-gap));
}
.cal__body {
  display: flex;
  flex-direction: column;
  gap: var(--cal-gap);
}
.cal__cell {
  display: grid;
  place-items: center;
  height: var(--cal-day);
}

.cal__day {
  width: var(--cal-day);
  height: var(--cal-day);
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text0);
  font-family: inherit;
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  outline: none;
}
.cal__day:hover:not(.cal__day--selected) {
  background-color: var(--fill-hover);
}
.cal__day--today:not(.cal__day--selected) {
  box-shadow: inset 0 0 0 1.5px var(--text2);
  font-weight: 600;
}
.cal__day--today:not(.cal__day--selected):focus-visible {
  box-shadow:
    inset 0 0 0 1.5px var(--text2),
    0 0 0 2px var(--brand);
}
.cal__day--selected {
  background-color: var(--cal-accent);
  color: #fff;
  font-weight: 600;
}

/* month change: the content slides 24px in the direction of travel while crossfading */
.cal-slide-enter-active,
.cal-slide-leave-active {
  transition:
    transform 0.28s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.2s ease;
}
.cal-slide-leave-active {
  position: absolute;
  inset: 0 0 auto 0;
  pointer-events: none;
}
.cal-slide-enter-from {
  opacity: 0;
  transform: translateX(calc(var(--cal-dir) * 24px));
}
.cal-slide-leave-to {
  opacity: 0;
  transform: translateX(calc(var(--cal-dir) * -24px));
}

@media (prefers-reduced-motion: reduce) {
  .cal-slide-enter-active,
  .cal-slide-leave-active {
    transition: opacity 0.15s ease;
  }
  .cal-slide-enter-from,
  .cal-slide-leave-to {
    transform: none;
  }
}
</style>
