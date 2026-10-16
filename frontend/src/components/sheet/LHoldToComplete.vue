<script setup lang="ts">
import { onBeforeUnmount, ref, useId, watch } from 'vue'
import { SPRING_DEFAULT, SPRING_MOMENTUM, Spring } from '@/helpers/motion'

/** How long the ◯ is held until the bit counts as done. */
const HOLD_MS = 600
/** A press shorter than this is a tap: it explains the gesture instead of cancelling silently. */
const TAP_MS = 200
const TOOLTIP_MS = 1500

/** Ring geometry in the 24 × 24 viewBox, the same circle lucide's Circle draws. */
const RADIUS = 10
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

interface Props {
  done: boolean
  color: string
}

const props = defineProps<Props>()
const emit = defineEmits<{ complete: []; reopen: [] }>()

const tooltipId = useId()

// The ring's fill (0 … 1). The finger drives it 1:1 while held; letting go early springs it
// home, and pressing again takes over from wherever it is.
const progress = ref(props.done ? 1 : 0)
const ring = new Spring(progress.value, (v) => (progress.value = v), {
  restDelta: 0.001,
  restSpeed: 0.01,
})

// The check pops in with a little overshoot once the bit is done.
const checkScale = ref(props.done ? 1 : 0)
const check = new Spring(checkScale.value, (v) => (checkScale.value = Math.max(0, v)), {
  restDelta: 0.001,
  restSpeed: 0.01,
})

const tooltip = ref(false)
let tooltipTimer: ReturnType<typeof setTimeout> | null = null

let holding = false
let startValue = 0
let startedAt = 0
let frame: number | null = null
let holdTimer: ReturnType<typeof setTimeout> | null = null
/** The click that ends a completed hold (or a key press) must not reopen what it just completed. */
let swallowClick = false

function clearHold() {
  holding = false
  if (frame !== null) cancelAnimationFrame(frame)
  frame = null
  if (holdTimer) clearTimeout(holdTimer)
  holdTimer = null
}

function hideTooltip() {
  tooltip.value = false
  if (tooltipTimer) clearTimeout(tooltipTimer)
  tooltipTimer = null
}

function showTooltip() {
  tooltip.value = true
  if (tooltipTimer) clearTimeout(tooltipTimer)
  tooltipTimer = setTimeout(hideTooltip, TOOLTIP_MS)
}

function fireComplete() {
  // the haptic tick belongs to the same moment as the event, not to the check animation
  navigator.vibrate?.(10)
  emit('complete')
}

function tick() {
  if (!holding) return
  ring.set(Math.min(1, startValue + (performance.now() - startedAt) / HOLD_MS))
  frame = requestAnimationFrame(tick)
}

function onPointerDown(event: PointerEvent) {
  if (props.done || event.button !== 0) return
  swallowClick = false
  hideTooltip()
  clearHold()
  const target = event.currentTarget
  if (target instanceof Element) {
    // releasing outside the circle must still end the press
    try {
      target.setPointerCapture?.(event.pointerId)
    } catch {
      // a synthetic or already released pointer
    }
  }
  // interrupting the spring-back keeps the value it has reached
  ring.set(ring.value)
  holding = true
  startValue = ring.value
  startedAt = performance.now()
  frame = requestAnimationFrame(tick)
  // the fill is visual; the decision is made on the clock, so a dropped frame cannot delay it
  holdTimer = setTimeout(
    () => {
      clearHold()
      ring.set(1)
      swallowClick = true
      fireComplete()
    },
    Math.max(0, (1 - startValue) * HOLD_MS),
  )
}

function onPointerEnd() {
  if (!holding) return
  const heldFor = performance.now() - startedAt
  clearHold()
  ring.to(0, SPRING_DEFAULT)
  if (heldFor < TAP_MS) showTooltip()
}

function onClick() {
  if (swallowClick) {
    swallowClick = false
    return
  }
  if (props.done) emit('reopen')
}

function onKeydown(event: KeyboardEvent) {
  if ((event.key !== ' ' && event.key !== 'Enter') || props.done) return
  event.preventDefault()
  if (event.repeat) return
  swallowClick = true
  clearHold()
  hideTooltip()
  ring.set(1)
  fireComplete()
}

function onKeyup(event: KeyboardEvent) {
  // Space clicks on release in some browsers; that click would reopen the bit just completed
  if ((event.key === ' ' || event.key === 'Enter') && swallowClick) {
    swallowClick = false
    event.preventDefault()
  }
}

watch(
  () => props.done,
  (done) => {
    clearHold()
    if (done) {
      ring.set(1)
      check.to(1, SPRING_MOMENTUM)
    } else {
      // reopened (or a failed save rolled it back): ring and check let go
      ring.to(0, SPRING_DEFAULT)
      check.to(0, SPRING_DEFAULT)
    }
  },
)

onBeforeUnmount(() => {
  clearHold()
  hideTooltip()
  ring.stop()
  check.stop()
})
</script>

<template>
  <div class="hold-wrap">
    <button
      type="button"
      class="hold pressable"
      :class="{ 'hold--done': done }"
      :style="{ '--ring': color }"
      :aria-label="done ? 'Mark as open' : 'Mark as done'"
      :aria-pressed="done"
      :aria-describedby="tooltip ? tooltipId : undefined"
      @pointerdown="onPointerDown"
      @pointerup="onPointerEnd"
      @pointercancel="onPointerEnd"
      @click="onClick"
      @contextmenu.prevent
      @keydown="onKeydown"
      @keyup="onKeyup"
    >
      <svg
        class="hold__svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <circle class="hold__track" cx="12" cy="12" :r="RADIUS" stroke="currentColor" />
        <circle
          class="hold__ring"
          cx="12"
          cy="12"
          :r="RADIUS"
          :stroke-dasharray="CIRCUMFERENCE"
          :stroke-dashoffset="CIRCUMFERENCE * (1 - progress)"
          transform="rotate(-90 12 12)"
        />
        <path
          class="hold__check"
          d="m9 12 2 2 4-4"
          :style="{ transform: `scale(${checkScale})` }"
        />
      </svg>
    </button>
    <span v-if="tooltip" :id="tooltipId" class="hold__tip" role="tooltip">Hold to complete</span>
  </div>
</template>

<style scoped>
.hold-wrap {
  position: relative;
  flex: none;
  /* optical alignment with the first title line (1.25rem × 1.25) */
  margin-top: 1px;
}

.hold {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text2);
  cursor: pointer;
  outline: none;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  /* a long press must stay a hold, not open the callout or context menu */
  -webkit-touch-callout: none;
}
.hold:hover .hold__track {
  stroke: var(--ring);
}
.hold:focus-visible {
  box-shadow: 0 0 0 2px var(--brand);
}

.hold__ring,
.hold__check {
  stroke: var(--ring);
}
.hold__check {
  /* grows from the middle of the circle, in the viewBox's own coordinates */
  transform-origin: 12px 12px;
}

.hold__tip {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 2;
  padding: 4px 8px;
  border-radius: 8px;
  background-color: var(--text0);
  color: var(--surface1);
  font-size: 0.75rem;
  font-weight: 550;
  letter-spacing: 0.005em;
  white-space: nowrap;
  pointer-events: none;
}
</style>
