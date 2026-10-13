<script lang="ts" setup>
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { Lock, Zap } from 'lucide-vue-next'
import type { Bit } from '@/stores/bitStore'
import type { Side } from '@/stores/connectionStore'
import { Spring, VelocityTracker, project, SPRING_DEFAULT, SPRING_MOMENTUM } from '@/helpers/motion'

const props = defineProps<{
  bit: Bit
  zoom: number
  highlightSide?: Side | null
  dimmed?: boolean
  highlightRole?: 'upstream' | 'downstream' | null
  workflowState?: 'blocked' | 'ready' | null
  snapPos?: { x: number; y: number } | null
}>()

const emit = defineEmits<{
  moveEnd: [id: number, x: number, y: number]
  dragMove: [id: number, x: number, y: number]
  rename: [id: number, title: string]
  openDetail: [id: number]
  hover: [id: number]
  hoverEnd: []
}>()

const isDragging = ref(false)
const isPressed = ref(false)
const isEditing = ref(false)
const editTitle = ref(props.bit.title)
const editInput = ref<HTMLInputElement | null>(null)
let clickTimer: ReturnType<typeof setTimeout> | null = null

// On-screen position is driven by two independent springs (X / Y), so every
// move — snap, glide, server update — starts from the live value and can be interrupted.
const displayX = ref(props.bit.x ?? 0)
const displayY = ref(props.bit.y ?? 0)
const springX = new Spring(displayX.value, (v) => (displayX.value = v))
const springY = new Spring(displayY.value, (v) => (displayY.value = v))

// Where the pointer says the bit is (canvas space), independent of snapping
const fingerX = ref(displayX.value)
const fingerY = ref(displayY.value)

watch(
  () => [props.bit.x, props.bit.y] as const,
  ([x, y]) => {
    if (isDragging.value || x == null || y == null) return
    if (x === springX.target && y === springY.target) return
    springX.to(x, SPRING_DEFAULT)
    springY.to(y, SPRING_DEFAULT)
  },
)

// Magnetic snap while dragging: ease into the docking position and back out to the finger
const SNAP_SPRING = { damping: 1, response: 0.18 }
watch(
  () => props.snapPos,
  (snap) => {
    if (!isDragging.value) return
    springX.to(snap ? snap.x : fingerX.value, SNAP_SPRING)
    springY.to(snap ? snap.y : fingerY.value, SNAP_SPRING)
  },
)

watch(isEditing, (v) => {
  if (v) {
    editTitle.value = props.bit.title
    setTimeout(() => editInput.value?.select(), 0)
  }
})

onBeforeUnmount(() => {
  springX.stop()
  springY.stop()
  if (clickTimer) clearTimeout(clickTimer)
})

const DEFAULT_COLOR = '#6366f1'

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

const bitColor = computed(() => props.bit.color ?? DEFAULT_COLOR)
const accentShadow = computed(() => hexToRgba(bitColor.value, 0.5))

const ringColor = computed(() => {
  const hex = bitColor.value
  const r = Math.min(255, Math.round(parseInt(hex.slice(1, 3), 16) * 0.6 + 255 * 0.4))
  const g = Math.min(255, Math.round(parseInt(hex.slice(3, 5), 16) * 0.6 + 255 * 0.4))
  const b = Math.min(255, Math.round(parseInt(hex.slice(5, 7), 16) * 0.6 + 255 * 0.4))
  return `rgb(${r},${g},${b})`
})
const ringGlow = computed(() => hexToRgba(bitColor.value, 0.85))

const STATUS_LABELS: Record<number, string> = { 0: 'Open', 1: 'In Progress', 2: 'Done' }
const statusLabel = computed(() => STATUS_LABELS[props.bit.status] ?? 'Open')

const STATUS_BADGE_COLOR: Record<number, string> = {
  0: 'rgba(148,163,184,0.75)',
  1: '#fbbf24',
  2: '#34d399',
}
const badgeColor = computed(() => STATUS_BADGE_COLOR[props.bit.status] ?? STATUS_BADGE_COLOR[0])
const badgeBg = computed(() => {
  const base = props.bit.status === 1 ? '#fbbf24' : props.bit.status === 2 ? '#34d399' : '#94a3b8'
  return hexToRgba(base, 0.1)
})

const PRIORITY_LABEL: Record<number, string> = { 1: 'Low', 2: 'Med', 3: 'High' }
const priorityLabel = computed(() =>
  props.bit.priority ? PRIORITY_LABEL[props.bit.priority] : null,
)

const trackPathRef = ref<SVGPathElement | null>(null)
const pathLength = ref(484)
const doneOffset = ref(484)

onMounted(async () => {
  if (trackPathRef.value) {
    pathLength.value = parseFloat(trackPathRef.value.getTotalLength().toFixed(2))
    doneOffset.value = pathLength.value
  }
  if (props.bit.status === 2) {
    await nextTick()
    setTimeout(() => {
      doneOffset.value = 0
    }, 80)
  }
})

watch(
  () => props.bit.status,
  async (s) => {
    doneOffset.value = pathLength.value
    if (s === 2) {
      await nextTick()
      setTimeout(() => {
        doneOffset.value = 0
      }, 50)
    }
  },
)

const outerPath =
  'M 28.93,7.07 Q 36,0 46,0 L 98,0 Q 108,0 115.07,7.07 ' +
  'L 136.93,28.93 Q 144,36 144,46 L 144,98 Q 144,108 136.93,115.07 ' +
  'L 115.07,136.93 Q 108,144 98,144 L 46,144 Q 36,144 28.93,136.93 ' +
  'L 7.07,115.07 Q 0,108 0,98 L 0,46 Q 0,36 7.07,28.93 Z'

// Starts at top-center (72,0) so the ring arc always begins at 12 o'clock
const ringPath =
  'M 72,0 L 98,0 Q 108,0 115.07,7.07 ' +
  'L 136.93,28.93 Q 144,36 144,46 L 144,98 Q 144,108 136.93,115.07 ' +
  'L 115.07,136.93 Q 108,144 98,144 L 46,144 Q 36,144 28.93,136.93 ' +
  'L 7.07,115.07 Q 0,108 0,98 L 0,46 Q 0,36 7.07,28.93 ' +
  'L 28.93,7.07 Q 36,0 46,0 L 72,0 Z'

const innerPath =
  'M 39.76,12.24 Q 44,8 50,8 L 94,8 Q 100,8 104.24,12.24 ' +
  'L 131.76,39.76 Q 136,44 136,50 L 136,94 Q 136,100 131.76,104.24 ' +
  'L 104.24,131.76 Q 100,136 94,136 L 50,136 Q 44,136 39.76,131.76 ' +
  'L 12.24,104.24 Q 8,100 8,94 L 8,50 Q 8,44 12.24,39.76 Z'

const tracker = new VelocityTracker()

function startDrag(e: PointerEvent) {
  if (e.button !== 0 || e.shiftKey || isEditing.value) return
  e.stopPropagation()
  const el = e.currentTarget as HTMLElement
  try {
    el.setPointerCapture(e.pointerId)
  } catch {
    /* pointer already gone — tracking still works while over the element */
  }

  // Catch a gliding bit mid-flight: start from where it is on screen right now
  springX.stop()
  springY.stop()
  const ox = displayX.value
  const oy = displayY.value
  const sx = e.clientX
  const sy = e.clientY
  // Hysteresis: a finger needs more slack than a mouse before it counts as a drag
  const threshold = e.pointerType === 'mouse' ? 4 : 10
  let hasMoved = false

  isPressed.value = true // lift feedback on press, not on release
  tracker.reset()
  tracker.add(e.clientX, e.clientY)

  const onMove = (ev: PointerEvent) => {
    if (ev.pointerId !== e.pointerId) return
    if (!hasMoved) {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < threshold) return
      hasMoved = true
      isDragging.value = true
    }
    tracker.add(ev.clientX, ev.clientY)
    // 1:1 tracking, respecting the grab offset
    fingerX.value = ox + (ev.clientX - sx) / props.zoom
    fingerY.value = oy + (ev.clientY - sy) / props.zoom
    if (!props.snapPos) {
      if (springX.isAnimating) {
        // still easing out of a snap — retarget to the finger instead of jumping
        springX.to(fingerX.value, SNAP_SPRING)
        springY.to(fingerY.value, SNAP_SPRING)
      } else {
        springX.set(fingerX.value)
        springY.set(fingerY.value)
      }
    }
    emit('dragMove', props.bit.id, fingerX.value, fingerY.value)
  }

  const onUp = (ev: PointerEvent) => {
    if (ev.pointerId !== e.pointerId) return
    el.removeEventListener('pointermove', onMove)
    el.removeEventListener('pointerup', onUp)
    el.removeEventListener('pointercancel', onUp)
    isPressed.value = false

    if (!hasMoved) {
      clickTimer = setTimeout(() => {
        if (!isEditing.value) emit('openDetail', props.bit.id)
        clickTimer = null
      }, 210)
      return
    }

    isDragging.value = false
    const v = tracker.velocity()
    // canvas-space velocity
    const vx = v.x / props.zoom
    const vy = v.y / props.zoom

    if (props.snapPos) {
      // Docking after a throw: a little bounce is earned by the momentum
      springX.to(props.snapPos.x, { ...SPRING_MOMENTUM, velocity: vx })
      springY.to(props.snapPos.y, { ...SPRING_MOMENTUM, velocity: vy })
      emit('moveEnd', props.bit.id, props.snapPos.x, props.snapPos.y)
      return
    }

    // Project where the flick is heading and land there, handing off the release velocity.
    // Bits are objects on a table, not a scroll view — decelerate faster than scrolling.
    const tx = fingerX.value + project(vx, 0.985)
    const ty = fingerY.value + project(vy, 0.985)
    springX.value = displayX.value
    springY.value = displayY.value
    springX.to(tx, { damping: 1, response: 0.4, velocity: vx })
    springY.to(ty, { damping: 1, response: 0.4, velocity: vy })
    emit('moveEnd', props.bit.id, tx, ty)
  }

  el.addEventListener('pointermove', onMove)
  el.addEventListener('pointerup', onUp)
  el.addEventListener('pointercancel', onUp)
}

function startEdit(e: MouseEvent) {
  e.stopPropagation()
  if (clickTimer) {
    clearTimeout(clickTimer)
    clickTimer = null
  }
  isEditing.value = true
}
function commitEdit() {
  const t = editTitle.value.trim()
  if (t && t !== props.bit.title) emit('rename', props.bit.id, t)
  isEditing.value = false
}
function cancelEdit() {
  isEditing.value = false
}
</script>

<template>
  <div
    :class="{ 'lbit-outer--dragging': isDragging, 'lbit-outer--dimmed': dimmed }"
    :style="{
      position: 'absolute',
      left: 0,
      top: 0,
      width: '144px',
      height: '144px',
      userSelect: 'none',
      transform: `translate3d(${displayX - 72}px, ${displayY - 72}px, 0)`,
      cursor: isDragging ? 'grabbing' : 'grab',
      zIndex: isPressed || isDragging ? 10 : undefined,
    }"
    class="lbit-outer"
  >
    <div
      :class="{ 'lbit--lifted': isPressed || isDragging }"
      :style="{ clipPath: `path('${outerPath}')` }"
      class="lbit"
      @dblclick="startEdit"
      @pointerdown="startDrag"
      @mouseenter="emit('hover', bit.id)"
      @mouseleave="emit('hoverEnd')"
    >
      <svg
        height="144"
        style="position: absolute; inset: 0; overflow: visible"
        width="144"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient :id="`tint-${bit.id}`" cx="50%" cy="30%" r="70%">
            <stop :stop-color="bitColor" offset="0%" stop-opacity="0.22" />
            <stop :stop-color="bitColor" offset="100%" stop-opacity="0" />
          </radialGradient>
        </defs>

        <path :d="outerPath" fill="rgba(14,14,32,0.62)" />
        <path :d="outerPath" :fill="`url(#tint-${bit.id})`" />
        <path :d="innerPath" fill="none" stroke="rgba(255,255,255,0.09)" stroke-width="1" />

        <line
          :stroke="bitColor"
          opacity="0.9"
          stroke-linecap="round"
          stroke-width="2.5"
          x1="44"
          x2="100"
          y1="1.5"
          y2="1.5"
        />

        <path
          :d="outerPath"
          :stroke="bitColor"
          class="lbit__border"
          fill="none"
          opacity="0.55"
          stroke-width="1.5"
        />

        <circle
          :class="['lbit__dot', { 'lbit__dot--snap': highlightSide === 'top' }]"
          :fill="bitColor"
          :r="highlightSide === 'top' ? 5 : 2.5"
          cx="72"
          cy="1.5"
        />
        <circle
          :class="['lbit__dot', { 'lbit__dot--snap': highlightSide === 'top-right' }]"
          :fill="bitColor"
          :r="highlightSide === 'top-right' ? 5 : 2.5"
          cx="126"
          cy="18"
        />
        <circle
          :class="['lbit__dot', { 'lbit__dot--snap': highlightSide === 'right' }]"
          :fill="bitColor"
          :r="highlightSide === 'right' ? 5 : 2.5"
          cx="142.5"
          cy="72"
        />
        <circle
          :class="['lbit__dot', { 'lbit__dot--snap': highlightSide === 'bottom-right' }]"
          :fill="bitColor"
          :r="highlightSide === 'bottom-right' ? 5 : 2.5"
          cx="126"
          cy="126"
        />
        <circle
          :class="['lbit__dot', { 'lbit__dot--snap': highlightSide === 'bottom' }]"
          :fill="bitColor"
          :r="highlightSide === 'bottom' ? 5 : 2.5"
          cx="72"
          cy="142.5"
        />
        <circle
          :class="['lbit__dot', { 'lbit__dot--snap': highlightSide === 'bottom-left' }]"
          :fill="bitColor"
          :r="highlightSide === 'bottom-left' ? 5 : 2.5"
          cx="18"
          cy="126"
        />
        <circle
          :class="['lbit__dot', { 'lbit__dot--snap': highlightSide === 'left' }]"
          :fill="bitColor"
          :r="highlightSide === 'left' ? 5 : 2.5"
          cx="1.5"
          cy="72"
        />
        <circle
          :class="['lbit__dot', { 'lbit__dot--snap': highlightSide === 'top-left' }]"
          :fill="bitColor"
          :r="highlightSide === 'top-left' ? 5 : 2.5"
          cx="18"
          cy="18"
        />
      </svg>

      <div class="lbit__body">
        <template v-if="isEditing">
          <input
            ref="editInput"
            v-model="editTitle"
            class="lbit__input"
            maxlength="60"
            @blur="commitEdit"
            @keydown.enter="commitEdit"
            @keydown.escape="cancelEdit"
            @pointerdown.stop
            @mousedown.stop
            @click.stop
          />
        </template>
        <template v-else>
          <span class="lbit__title">{{ bit.title }}</span>
        </template>

        <div class="lbit__meta">
          <div class="lbit__meta-row">
            <span class="lbit__badge">{{ statusLabel }}</span>
            <span v-if="priorityLabel" class="lbit__priority">{{ priorityLabel }}</span>
          </div>
          <div
            v-if="workflowState"
            :class="`lbit__workflow-chip--${workflowState}`"
            class="lbit__workflow-chip"
          >
            <component
              :is="workflowState === 'blocked' ? Lock : Zap"
              :size="8"
              :stroke-width="2.5"
            />
            {{ workflowState === 'blocked' ? 'Blocked' : 'Ready' }}
          </div>
        </div>
      </div>
    </div>

    <svg
      height="144"
      style="position: absolute; inset: 0; overflow: visible; pointer-events: none"
      width="144"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        v-if="highlightRole"
        :d="outerPath"
        :stroke="highlightRole === 'upstream' ? 'rgba(99,102,241,0.85)' : 'rgba(16,185,129,0.85)'"
        class="lbit__workflow-ring"
        fill="none"
        stroke-width="3"
      />

      <!-- dashed track used to measure total path length via getTotalLength() -->
      <path
        ref="trackPathRef"
        :d="ringPath"
        fill="none"
        stroke="rgba(255,255,255,0.13)"
        stroke-dasharray="4 7"
        stroke-width="1.5"
      />

      <path
        v-if="bit.status === 1"
        :d="ringPath"
        :stroke="ringColor"
        :stroke-dasharray="`${pathLength / 2} ${pathLength}`"
        class="lbit__arc--progress"
        fill="none"
        stroke-linecap="round"
        stroke-width="3"
      />

      <path
        v-if="bit.status === 2"
        :d="ringPath"
        :stroke="ringColor"
        :style="{ strokeDasharray: pathLength, strokeDashoffset: doneOffset }"
        class="lbit__arc--done"
        fill="none"
        stroke-linecap="round"
        stroke-width="3"
      />
    </svg>
  </div>
</template>

<style scoped>
/* Materialize on enter: scale + opacity together, critically damped */
@keyframes lbit-enter {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.lbit-outer {
  will-change: transform;
  transition: opacity 0.3s ease;
}
.lbit-outer--dimmed {
  opacity: 0.15;
  pointer-events: none;
}

.lbit {
  position: absolute;
  inset: 0;
  touch-action: none; /* we own the gesture — no browser scroll/zoom on a bit */
  backdrop-filter: blur(16px) saturate(1.5);
  -webkit-backdrop-filter: blur(16px) saturate(1.5);
  filter: drop-shadow(0 6px 18px rgba(0, 0, 0, 0.45)) drop-shadow(0 0 6px v-bind(accentShadow));
  animation: lbit-enter var(--spring-duration) var(--ease-spring) backwards;
  transition:
    filter 0.3s ease,
    transform var(--spring-duration) var(--ease-spring);
}
.lbit:hover {
  filter: drop-shadow(0 8px 24px rgba(0, 0, 0, 0.55)) drop-shadow(0 0 12px v-bind(accentShadow));
  transform: scale(1.03);
}
/* Lift instantly on press so the bit feels picked up under the pointer */
.lbit--lifted,
.lbit--lifted:hover {
  filter: drop-shadow(0 16px 32px rgba(0, 0, 0, 0.55)) drop-shadow(0 0 18px v-bind(accentShadow));
  transform: scale(1.06);
  transition:
    filter 0.15s ease-out,
    transform 0.15s ease-out;
  animation: none;
}

.lbit__border {
  transition: opacity 0.25s ease;
}
.lbit:hover .lbit__border {
  opacity: 0.9;
  stroke-width: 2;
}

.lbit__dot {
  opacity: 0;
  transition:
    opacity 0.2s ease,
    r var(--spring-duration) var(--ease-spring-bounce);
}
.lbit:hover .lbit__dot {
  opacity: 0.7;
}
.lbit__dot--snap {
  opacity: 1 !important;
  filter: drop-shadow(0 0 5px v-bind(bitColor));
}

.lbit__body {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 28px 18px 36px;
  pointer-events: none;
}

.lbit__title {
  color: #f8fafc;
  font-size: 15px;
  font-weight: 650;
  letter-spacing: -0.012em;
  line-height: 1.25;
  text-align: center;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.5);
}

.lbit__input {
  pointer-events: all;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid v-bind(bitColor);
  border-radius: 6px;
  color: #f8fafc;
  font-size: 13px;
  font-weight: 600;
  text-align: center;
  width: 100px;
  padding: 4px 6px;
  outline: none;
  letter-spacing: -0.005em;
}

.lbit__meta {
  position: absolute;
  bottom: 18px;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.lbit__meta-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}
.lbit__badge {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: v-bind(badgeColor);
  background: v-bind(badgeBg);
  padding: 2px 7px;
  border-radius: 99px;
  border: 1px solid v-bind(badgeColor);
  transition:
    color 0.3s ease,
    background-color 0.3s ease,
    border-color 0.3s ease;
}
.lbit__priority {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: rgba(203, 213, 225, 0.75);
  text-transform: uppercase;
}

/* Status chips: colour carries the meaning — no endless pulsing */
.lbit__workflow-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 99px;
  pointer-events: none;
  white-space: nowrap;
}
.lbit__workflow-chip--blocked {
  color: #fca5a5;
  background: rgba(239, 68, 68, 0.14);
  border: 1px solid rgba(239, 68, 68, 0.38);
}
.lbit__workflow-chip--ready {
  color: #6ee7b7;
  background: rgba(16, 185, 129, 0.14);
  border: 1px solid rgba(16, 185, 129, 0.4);
}

@keyframes ring-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
.lbit__workflow-ring {
  animation: ring-in 0.2s ease both;
  filter: drop-shadow(0 0 6px currentColor);
}

.lbit__arc--progress {
  filter: drop-shadow(0 0 4px v-bind(ringGlow));
}
.lbit__arc--done {
  transition: stroke-dashoffset 0.7s var(--ease-spring);
  filter: drop-shadow(0 0 5px v-bind(ringGlow));
}
</style>
