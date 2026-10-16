<script setup lang="ts" generic="T extends string | number | null">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { Spring } from '@/helpers/motion'

interface Option {
  value: T
  label: string
  title?: string
}

interface Props {
  modelValue: T
  options: Option[]
  ariaLabel: string
}

const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [value: T] }>()

const track = useTemplateRef<HTMLElement>('track')
const segments = ref<HTMLElement[]>([])

const checkedIndex = computed(() => props.options.findIndex((o) => o.value === props.modelValue))
// roving tabindex: the checked segment is the one tab stop, the first when nothing is checked
const tabStop = computed(() => Math.max(0, checkedIndex.value))

function select(index: number, focus = false) {
  const option = props.options[index]
  if (!option) return
  if (focus) segments.value[index]?.focus()
  if (option.value !== props.modelValue) emit('update:modelValue', option.value)
}

function onKeydown(event: KeyboardEvent, index: number) {
  const count = props.options.length
  if (!count) return
  let next: number
  if (event.key === 'ArrowRight') next = (index + 1) % count
  else if (event.key === 'ArrowLeft') next = (index - 1 + count) % count
  else return
  event.preventDefault()
  select(next, true)
}

// ── Sliding pill ─────────────────────────────────────────────────────
// Two springs (position + width) so a quick second tap retargets mid-flight
// instead of restarting; Spring.to jumps straight to the target under reduced motion.
const pillX = ref(0)
const pillW = ref(0)
const pillVisible = ref(false)
const xSpring = new Spring(0, (v) => (pillX.value = v))
const wSpring = new Spring(0, (v) => (pillW.value = v))

function measure(animate: boolean) {
  const el = segments.value[checkedIndex.value]
  if (!el) {
    pillVisible.value = false
    return
  }
  const x = el.offsetLeft
  const w = el.offsetWidth
  if (animate && pillVisible.value) {
    xSpring.to(x)
    wSpring.to(w)
  } else {
    // first placement (or reappearing after no selection): no flight across the track
    xSpring.set(x)
    wSpring.set(w)
    pillVisible.value = true
  }
}

watch(
  () => [props.modelValue, props.options] as const,
  async () => {
    await nextTick()
    measure(true)
  },
)

let observer: ResizeObserver | undefined
onMounted(() => {
  measure(false)
  if (typeof ResizeObserver !== 'undefined' && track.value) {
    // a resize (or a late font load) changes segment widths — follow without animating
    observer = new ResizeObserver(() => measure(false))
    observer.observe(track.value)
  }
})
onBeforeUnmount(() => {
  observer?.disconnect()
  xSpring.stop()
  wSpring.stop()
})
</script>

<template>
  <div ref="track" class="segmented" role="radiogroup" :aria-label="ariaLabel">
    <span
      class="segmented__pill"
      :class="{ 'segmented__pill--visible': pillVisible }"
      :style="{ width: `${pillW}px`, transform: `translateX(${pillX}px)` }"
      aria-hidden="true"
    />
    <button
      v-for="(option, i) in options"
      :key="i"
      :ref="(el) => (segments[i] = el as HTMLElement)"
      type="button"
      role="radio"
      class="segmented__item pressable"
      :class="{ 'segmented__item--active': i === checkedIndex }"
      :aria-checked="i === checkedIndex"
      :tabindex="i === tabStop ? 0 : -1"
      :title="option.title"
      @click="select(i)"
      @keydown="onKeydown($event, i)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.segmented {
  position: relative;
  display: flex;
  padding: 2px;
  gap: 0;
  background-color: var(--fill-hover);
  border: 1px solid var(--material-stroke);
  border-radius: 9px;
}

.segmented__pill {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  background-color: var(--surface1);
  border-radius: 7px;
  box-shadow:
    0 1px 2px hsl(var(--surface-shadow) / 0.12),
    0 2px 6px -2px hsl(var(--surface-shadow) / var(--shadow-strength));
  opacity: 0;
  pointer-events: none;
  will-change: transform, width;
}
.segmented__pill--visible {
  opacity: 1;
}

.segmented__item {
  position: relative;
  z-index: 1;
  flex: 1 1 0;
  min-width: 0;
  height: 30px;
  padding: 0 10px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--text1);
  font-family: inherit;
  font-size: 0.8125rem;
  font-weight: 550;
  letter-spacing: -0.005em;
  white-space: nowrap;
  cursor: pointer;
  outline: none;
}
.segmented__item:hover:not(.segmented__item--active) {
  color: var(--text0);
}
.segmented__item--active {
  color: var(--text0);
}
.segmented__item:focus-visible {
  box-shadow: 0 0 0 2px var(--brand);
}
</style>
