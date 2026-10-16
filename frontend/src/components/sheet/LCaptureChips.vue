<script setup lang="ts">
import { computed, h, ref, type ComponentPublicInstance, type FunctionalComponent } from 'vue'
import { Calendar, Flag, RectangleVertical } from 'lucide-vue-next'
import type { QuickEntryToken } from '@/helpers/quickEntry'
import { addDays, formatDayShort, weekdayOf } from '@/helpers/localDate'
import { PALETTE } from '@/helpers/palette'
import { SIZE_LABEL } from '@/helpers/bitMeta'
import LPropertyChip from './LPropertyChip.vue'
import LDatePicker from './LDatePicker.vue'
import LSegmented from './LSegmented.vue'
import LColorGrid from './LColorGrid.vue'

/**
 * The four chips of the next captured bit. They show what the smart entry recognised or what was
 * picked here; the parent decides which wins. A chip whose value comes from a token offers
 * "Keep as text" and "Clear" instead of a picker.
 */

export type CaptureChip = 'due' | 'priority' | 'size' | 'color'
type Priority = 1 | 2 | 3
type Size = 1 | 2 | 3 | 4

interface Props {
  today: string
  due: string | null
  priority: Priority | null
  size: Size | null
  color: string
  /** The colour was picked or typed (otherwise it is the default). */
  colorSet: boolean
  /** The token behind each chip, if its value comes from the text. */
  tokens: Partial<Record<CaptureChip, QuickEntryToken>>
}

const props = defineProps<Props>()
const emit = defineEmits<{
  due: [key: string | null]
  priority: [value: Priority | null]
  size: [value: Size | null]
  color: [hex: string | null]
  keep: [kind: CaptureChip]
  clear: [kind: CaptureChip]
  /** A pick is done; the parent hands focus back to the text field. */
  done: []
}>()

const open = ref<CaptureChip | null>(null)
const chipEls = new Map<CaptureChip, HTMLElement>()

function chipRef(key: CaptureChip) {
  return (el: Element | ComponentPublicInstance | null) => {
    const root = el && '$el' in el ? (el.$el as HTMLElement) : (el as HTMLElement | null)
    if (root) chipEls.set(key, root)
    else chipEls.delete(key)
  }
}

function toggle(key: CaptureChip) {
  open.value = open.value === key ? null : key
}

/** Closes the chip after a pick and sends focus back to the text field. */
function finish(key: CaptureChip) {
  if (open.value === key) open.value = null
  emit('done')
}

/** For the sheet's Esc: closes an open chip and reports whether there was one. */
function closeOpenChip(): boolean {
  const key = open.value
  if (key === null) return false
  open.value = null
  const root = chipEls.get(key)
  if (root && root.contains(document.activeElement)) {
    root.querySelector<HTMLButtonElement>('.chip__btn')?.focus()
  }
  return true
}

defineExpose({ closeOpenChip, close: () => (open.value = null) })

function nextWeekday(from: string, weekday: number): string {
  let key = addDays(from, 1)
  while (weekdayOf(key) !== weekday) key = addDays(key, 1)
  return key
}

const dueQuick = computed(() => [
  { label: 'Today', key: props.today },
  { label: 'Tomorrow', key: addDays(props.today, 1) },
  { label: 'Next week', key: nextWeekday(props.today, 0) },
  { label: 'None', key: null },
])

const PRIORITY_NAME: Record<Priority, string> = { 1: 'Low', 2: 'Medium', 3: 'High' }
const PRIORITY_OPTIONS: { value: number | null; label: string; title: string }[] = [
  { value: null, label: '—', title: 'None' },
  { value: 1, label: '!', title: 'Low' },
  { value: 2, label: '!!', title: 'Medium' },
  { value: 3, label: '!!!', title: 'High' },
]
const SIZE_OPTIONS: { value: number | null; label: string }[] = ([1, 2, 3, 4] as const).map(
  (value) => ({ value, label: SIZE_LABEL[value] }),
)

const labels = computed(() => {
  const palette = PALETTE.find((c) => c.hex === props.color.toLowerCase())
  return {
    due: props.due ? formatDayShort(props.due, props.today) : 'Due',
    priority: props.priority ? PRIORITY_NAME[props.priority] : 'Priority',
    size: props.size ? SIZE_LABEL[props.size] : 'Size',
    color: props.colorSet
      ? palette
        ? palette.en.charAt(0).toUpperCase() + palette.en.slice(1)
        : 'Custom'
      : 'Color',
  }
})

const isSet = computed<Record<CaptureChip, boolean>>(() => ({
  due: !!props.due,
  priority: !!props.priority,
  size: !!props.size,
  color: props.colorSet,
}))

// the colour chip's icon is the next bit's colour itself
const ColorDot: FunctionalComponent = () =>
  h('span', {
    'aria-hidden': 'true',
    style: {
      display: 'inline-block',
      flex: 'none',
      width: '0.75rem',
      height: '0.75rem',
      borderRadius: '50%',
      backgroundColor: props.color,
      boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / 0.12)',
    },
  })

const CHIPS: { key: CaptureChip; icon: FunctionalComponent | typeof Calendar }[] = [
  { key: 'due', icon: Calendar },
  { key: 'priority', icon: Flag },
  { key: 'size', icon: RectangleVertical },
  { key: 'color', icon: ColorDot },
]

/** The × of a chip: a token leaves the text, a pick is undone. */
function clearChip(key: CaptureChip) {
  if (open.value === key) open.value = null
  if (props.tokens[key]) emit('clear', key)
  else if (key === 'due') emit('due', null)
  else if (key === 'priority') emit('priority', null)
  else if (key === 'size') emit('size', null)
  else emit('color', null)
}

function keep(key: CaptureChip) {
  emit('keep', key)
  finish(key)
}

function clearToken(key: CaptureChip) {
  emit('clear', key)
  finish(key)
}

function pickDue(key: string | null) {
  emit('due', key)
  finish('due')
}

function pickColor(hex: string) {
  emit('color', hex)
  finish('color')
}
</script>

<template>
  <div class="capture-chips">
    <LPropertyChip
      v-for="chip in CHIPS"
      :key="chip.key"
      :ref="chipRef(chip.key)"
      :data-chip="chip.key"
      :icon="chip.icon"
      :label="labels[chip.key]"
      :set="isSet[chip.key]"
      :expanded="open === chip.key"
      @toggle="toggle(chip.key)"
      @clear="clearChip(chip.key)"
    >
      <div v-if="tokens[chip.key]" class="capture-chips__picker capture-chips__token">
        <button type="button" class="capture-chips__action pressable" @click="keep(chip.key)">
          Keep as text
        </button>
        <button type="button" class="capture-chips__action pressable" @click="clearToken(chip.key)">
          Clear
        </button>
      </div>
      <LDatePicker
        v-else-if="chip.key === 'due'"
        :model-value="due"
        :today="today"
        :accent="color"
        :quick="dueQuick"
        @update:model-value="pickDue"
      />
      <div v-else-if="chip.key === 'priority'" class="capture-chips__picker">
        <!-- ariaLabel in camelCase: vue-tsc does not map aria-label onto a generic component's prop -->
        <LSegmented
          :model-value="priority"
          :options="PRIORITY_OPTIONS"
          ariaLabel="Priority"
          @update:model-value="emit('priority', $event as Priority | null)"
        />
      </div>
      <div v-else-if="chip.key === 'size'" class="capture-chips__picker">
        <LSegmented
          :model-value="size"
          :options="SIZE_OPTIONS"
          ariaLabel="Size"
          @update:model-value="emit('size', $event as Size | null)"
        />
      </div>
      <LColorGrid v-else :model-value="colorSet ? color : null" @update:model-value="pickColor" />
    </LPropertyChip>
  </div>
</template>

<style scoped>
.capture-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 6px;
}
/* an open chip (its picker rendered, also while it closes) takes the whole row */
.capture-chips :deep([data-chip]:has(> .chip__region > *)) {
  flex-basis: 100%;
}

.capture-chips__picker {
  padding: 10px 2px 4px;
}

.capture-chips__token {
  display: flex;
  gap: 6px;
}

.capture-chips__action {
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
.capture-chips__action:hover {
  background-color: var(--fill-press);
  color: var(--text0);
}
.capture-chips__action:focus-visible {
  box-shadow: 0 0 0 2px var(--brand);
}
</style>
