<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import type { Bit } from '@/stores/bitStore'
import type { Side } from '@/stores/connectionStore'

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
  delete: [id: number]
  openDetail: [id: number]
  hover: [id: number]
  hoverEnd: []
}>()

const isDragging = ref(false)
const dragX = ref(props.bit.x)
const dragY = ref(props.bit.y)
const isEditing = ref(false)
const editTitle = ref(props.bit.title)
const editInput = ref<HTMLInputElement | null>(null)
let clickTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => [props.bit.x, props.bit.y] as const,
  ([x, y]) => { if (!isDragging.value) { dragX.value = x; dragY.value = y } },
)
watch(isEditing, (v) => {
  if (v) { editTitle.value = props.bit.title; setTimeout(() => editInput.value?.select(), 0) }
})

// While dragging, use the snap-preview position if the parent detected a snap target;
// otherwise follow the raw drag position.
const displayX = computed(() => isDragging.value && props.snapPos ? props.snapPos.x : dragX.value)
const displayY = computed(() => isDragging.value && props.snapPos ? props.snapPos.y : dragY.value)

// ── color helpers ────────────────────────────────────────────────
const DEFAULT_COLOR = '#6366f1'

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// User-chosen bit color — drives border, glow, tint, dots, accent line, ring
const bitColor     = computed(() => props.bit.color ?? DEFAULT_COLOR)
const accentColor  = computed(() => bitColor.value)
const accentShadow = computed(() => hexToRgba(bitColor.value, 0.5))
const accentBg     = computed(() => hexToRgba(bitColor.value, 0.08))

// Ring color: bit color lightened 40% toward white — clearly readable on dark bg
const ringColor = computed(() => {
  const hex = bitColor.value
  const r = Math.min(255, Math.round(parseInt(hex.slice(1, 3), 16) * 0.6 + 255 * 0.4))
  const g = Math.min(255, Math.round(parseInt(hex.slice(3, 5), 16) * 0.6 + 255 * 0.4))
  const b = Math.min(255, Math.round(parseInt(hex.slice(5, 7), 16) * 0.6 + 255 * 0.4))
  return `rgb(${r},${g},${b})`
})
const ringGlow = computed(() => hexToRgba(bitColor.value, 0.85))

// ── status ────────────────────────────────────────────────────────
const STATUS_LABELS: Record<number, string> = { 0: 'Open', 1: 'In Progress', 2: 'Done' }
const statusLabel = computed(() => STATUS_LABELS[props.bit.status] ?? 'Open')

// Badge uses fixed status colors (not bit color) for clear status read
const STATUS_BADGE_COLOR: Record<number, string> = {
  0: 'rgba(148,163,184,0.75)',
  1: '#fbbf24',
  2: '#34d399',
}
const badgeColor = computed(() => STATUS_BADGE_COLOR[props.bit.status] ?? STATUS_BADGE_COLOR[0])
const badgeBg    = computed(() => {
  const base = props.bit.status === 1 ? '#fbbf24' : props.bit.status === 2 ? '#34d399' : '#94a3b8'
  return hexToRgba(base, 0.10)
})

const PRIORITY_LABEL: Record<number, string> = { 1: 'Low', 2: 'Med', 3: 'High' }
const priorityLabel = computed(() => props.bit.priority ? PRIORITY_LABEL[props.bit.priority] : null)

// ── octagon perimeter (measured via getTotalLength on mount) ──────
const trackPathRef = ref<SVGPathElement | null>(null)
const pathLength   = ref(484)   // approximation until mount measures it
const doneOffset   = ref(484)   // stroke-dashoffset for draw animation

onMounted(async () => {
  if (trackPathRef.value) {
    pathLength.value = parseFloat(trackPathRef.value.getTotalLength().toFixed(2))
    doneOffset.value = pathLength.value
  }
  // Trigger draw-in for bits that are already Done on first render
  if (props.bit.status === 2) {
    await nextTick()
    setTimeout(() => { doneOffset.value = 0 }, 80)
  }
})

// Re-trigger draw animation when status switches to Done
watch(() => props.bit.status, async (s) => {
  doneOffset.value = pathLength.value   // reset to hidden
  if (s === 2) {
    await nextTick()
    setTimeout(() => { doneOffset.value = 0 }, 50)
  }
})

// ── octagon geometry (144 × 144, cut 36px, corner radius 10px) ────
const outerPath =
  'M 28.93,7.07 Q 36,0 46,0 L 98,0 Q 108,0 115.07,7.07 ' +
  'L 136.93,28.93 Q 144,36 144,46 L 144,98 Q 144,108 136.93,115.07 ' +
  'L 115.07,136.93 Q 108,144 98,144 L 46,144 Q 36,144 28.93,136.93 ' +
  'L 7.07,115.07 Q 0,108 0,98 L 0,46 Q 0,36 7.07,28.93 Z'

// Same octagon, but starting at top-center (72,0) so the ring always
// begins at 12 o'clock — no dashoffset tricks needed.
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

// ── drag ──────────────────────────────────────────────────────────
function startDrag(e: MouseEvent) {
  if (e.button !== 0 || e.shiftKey) return
  e.stopPropagation()
  isDragging.value = true
  let hasMoved = false
  const sx = e.clientX, sy = e.clientY
  const ox = dragX.value,  oy = dragY.value
  const onMove = (ev: MouseEvent) => {
    if (Math.abs(ev.clientX - sx) > 4 || Math.abs(ev.clientY - sy) > 4) hasMoved = true
    dragX.value = ox + (ev.clientX - sx) / props.zoom
    dragY.value = oy + (ev.clientY - sy) / props.zoom
    emit('dragMove', props.bit.id, dragX.value, dragY.value)
  }
  const onUp = () => {
    isDragging.value = false
    if (hasMoved) {
      emit('moveEnd', props.bit.id, dragX.value, dragY.value)
    } else {
      clickTimer = setTimeout(() => {
        if (!isEditing.value) emit('openDetail', props.bit.id)
        clickTimer = null
      }, 210)
    }
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

// ── edit ──────────────────────────────────────────────────────────
function startEdit(e: MouseEvent) {
  e.stopPropagation()
  if (clickTimer) { clearTimeout(clickTimer); clickTimer = null }
  isEditing.value = true
}
function commitEdit() {
  const t = editTitle.value.trim()
  if (t && t !== props.bit.title) emit('rename', props.bit.id, t)
  isEditing.value = false
}
function cancelEdit() { isEditing.value = false }
</script>

<template>
  <div
    class="lbit-outer"
    :class="{ 'lbit-outer--dragging': isDragging, 'lbit-outer--dimmed': dimmed }"
    :style="{
      position: 'absolute',
      left: `${displayX}px`,
      top: `${displayY}px`,
      width: '144px',
      height: '144px',
      userSelect: 'none',
      transform: 'translate(-50%, -50%)',
      cursor: isDragging ? 'grabbing' : 'grab',
    }"
  >
    <!-- ── octagon body (clipped) ── -->
    <div
      class="lbit"
      :class="{ 'lbit--dragging': isDragging }"
      :style="{ clipPath: `path('${outerPath}')` }"
      @mousedown="startDrag"
      @dblclick="startEdit"
      @mouseenter="emit('hover', bit.id)"
      @mouseleave="emit('hoverEnd')"
    >
      <svg
        width="144" height="144"
        style="position:absolute;inset:0;overflow:visible"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient :id="`tint-${bit.id}`" cx="50%" cy="30%" r="70%">
            <stop offset="0%"   :stop-color="bitColor" stop-opacity="0.22" />
            <stop offset="100%" :stop-color="bitColor" stop-opacity="0"    />
          </radialGradient>
        </defs>

        <path :d="outerPath" fill="rgba(14,14,32,0.62)" />
        <path :d="outerPath" :fill="`url(#tint-${bit.id})`" />
        <path :d="innerPath" fill="none" stroke="rgba(255,255,255,0.09)" stroke-width="1" />

        <line x1="44" y1="1.5" x2="100" y2="1.5"
          :stroke="bitColor" stroke-width="2.5"
          stroke-linecap="round" opacity="0.9"
        />

        <path :d="outerPath" fill="none"
          :stroke="bitColor" stroke-width="1.5"
          opacity="0.55" class="lbit__border"
        />

        <circle cx="72"    cy="1.5"   :r="highlightSide === 'top'          ? 5 : 2.5" :fill="bitColor" :class="['lbit__dot', { 'lbit__dot--snap': highlightSide === 'top'          }]" />
        <circle cx="126"   cy="18"    :r="highlightSide === 'top-right'    ? 5 : 2.5" :fill="bitColor" :class="['lbit__dot', { 'lbit__dot--snap': highlightSide === 'top-right'    }]" />
        <circle cx="142.5" cy="72"    :r="highlightSide === 'right'        ? 5 : 2.5" :fill="bitColor" :class="['lbit__dot', { 'lbit__dot--snap': highlightSide === 'right'        }]" />
        <circle cx="126"   cy="126"   :r="highlightSide === 'bottom-right' ? 5 : 2.5" :fill="bitColor" :class="['lbit__dot', { 'lbit__dot--snap': highlightSide === 'bottom-right' }]" />
        <circle cx="72"    cy="142.5" :r="highlightSide === 'bottom'       ? 5 : 2.5" :fill="bitColor" :class="['lbit__dot', { 'lbit__dot--snap': highlightSide === 'bottom'       }]" />
        <circle cx="18"    cy="126"   :r="highlightSide === 'bottom-left'  ? 5 : 2.5" :fill="bitColor" :class="['lbit__dot', { 'lbit__dot--snap': highlightSide === 'bottom-left'  }]" />
        <circle cx="1.5"   cy="72"    :r="highlightSide === 'left'         ? 5 : 2.5" :fill="bitColor" :class="['lbit__dot', { 'lbit__dot--snap': highlightSide === 'left'         }]" />
        <circle cx="18"    cy="18"    :r="highlightSide === 'top-left'     ? 5 : 2.5" :fill="bitColor" :class="['lbit__dot', { 'lbit__dot--snap': highlightSide === 'top-left'     }]" />
      </svg>

      <div class="lbit__body">
        <template v-if="isEditing">
          <input
            ref="editInput"
            v-model="editTitle"
            class="lbit__input"
            maxlength="60"
            @keydown.enter="commitEdit"
            @keydown.escape="cancelEdit"
            @blur="commitEdit"
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
            class="lbit__workflow-chip"
            :class="`lbit__workflow-chip--${workflowState}`"
          >{{ workflowState === 'blocked' ? '⊘ Blocked' : '⚡ Ready' }}</div>
        </div>
      </div>
    </div>

    <!-- ── status ring — follows octagon contour, outside clip ── -->
    <svg
      class="lbit__ring"
      width="144" height="144"
      style="position:absolute;inset:0;overflow:visible;pointer-events:none;"
      xmlns="http://www.w3.org/2000/svg"
    >
      <!-- Workflow highlight ring (upstream = indigo, downstream = emerald) -->
      <path
        v-if="highlightRole"
        :d="outerPath"
        fill="none"
        :stroke="highlightRole === 'upstream' ? 'rgba(99,102,241,0.85)' : 'rgba(16,185,129,0.85)'"
        stroke-width="3"
        class="lbit__workflow-ring"
      />

      <!-- Faint dashed track — starts at top-center (12 o'clock), used for measurement -->
      <path
        ref="trackPathRef"
        :d="ringPath"
        fill="none"
        stroke="rgba(255,255,255,0.13)"
        stroke-width="1.5"
        stroke-dasharray="4 7"
      />

      <!-- In Progress: first 50% of contour, cleanly from top-center clockwise -->
      <path
        v-if="bit.status === 1"
        :d="ringPath"
        fill="none"
        :stroke="ringColor"
        stroke-width="3"
        stroke-linecap="round"
        :stroke-dasharray="`${pathLength / 2} ${pathLength}`"
        class="lbit__arc--progress"
      />

      <!-- Done: full contour with draw-in animation from top-center -->
      <path
        v-if="bit.status === 2"
        :d="ringPath"
        fill="none"
        :stroke="ringColor"
        stroke-width="3"
        stroke-linecap="round"
        :style="{
          strokeDasharray: pathLength,
          strokeDashoffset: doneOffset,
        }"
        class="lbit__arc--done"
      />
    </svg>
  </div>
</template>

<style scoped>
/* ── entrance animation ── */
@keyframes lbit-enter {
  from { opacity: 0; transform: scale(0.78); filter: drop-shadow(0 0 0px transparent); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes lbit-float {
  0%, 100% { transform: translateY(0px);  }
  50%       { transform: translateY(-4px); }
}

/* ── outer wrapper ── */
.lbit-outer {
  transition:
    left    0.45s cubic-bezier(0.34, 1.56, 0.64, 1),
    top     0.45s cubic-bezier(0.34, 1.56, 0.64, 1),
    opacity 0.25s ease;
}
.lbit-outer--dragging {
  transition: none !important;
}
.lbit-outer--dimmed {
  opacity: 0.15;
  pointer-events: none;
}

/* ── octagon body ── */
.lbit {
  position: absolute;
  inset: 0;
  backdrop-filter: blur(16px) saturate(1.5);
  -webkit-backdrop-filter: blur(16px) saturate(1.5);
  filter:
    drop-shadow(0 6px 18px rgba(0,0,0,0.55))
    drop-shadow(0 0 6px v-bind(accentShadow));
  animation: lbit-enter 0.38s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  transition: filter 0.3s ease, transform 0.25s ease;
}
.lbit:hover {
  filter:
    drop-shadow(0 8px 24px rgba(0,0,0,0.65))
    drop-shadow(0 0 14px v-bind(accentShadow));
  transform: scale(1.04);
}
.lbit--dragging {
  filter:
    drop-shadow(0 12px 32px rgba(0,0,0,0.7))
    drop-shadow(0 0 22px v-bind(accentShadow)) !important;
  transform: scale(1.07) !important;
  transition: none !important;
  animation: none !important;
}

/* ── border ── */
.lbit__border { transition: opacity 0.25s ease; }
.lbit:hover .lbit__border { opacity: 0.9; stroke-width: 2; }

/* ── connector dots ── */
.lbit__dot {
  opacity: 0;
  transition: opacity 0.2s ease, r 0.15s ease;
}
.lbit:hover .lbit__dot { opacity: 0.7; }
.lbit__dot--snap {
  opacity: 1 !important;
  filter: drop-shadow(0 0 5px v-bind(accentColor));
  animation: dot-pulse 0.6s ease-in-out infinite alternate;
}
@keyframes dot-pulse {
  from { opacity: 0.8; }
  to   { opacity: 1;   }
}

/* ── layout ── */
.lbit__body {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 28px 18px 36px;
  pointer-events: none;
  animation: lbit-float 5s ease-in-out infinite;
}
.lbit--dragging .lbit__body { animation: none; }

/* ── title ── */
.lbit__title {
  color: #f8fafc;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.01em;
  line-height: 1.3;
  text-align: center;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-shadow: 0 1px 8px rgba(0,0,0,0.6);
}

/* ── inline edit ── */
.lbit__input {
  pointer-events: all;
  background: rgba(255,255,255,0.05);
  border: 1px solid v-bind(accentColor);
  border-radius: 4px;
  color: #e2e8f0;
  font-size: 11px;
  font-weight: 500;
  text-align: center;
  width: 88px;
  padding: 3px 6px;
  outline: none;
  letter-spacing: 0.02em;
}

/* ── meta ── */
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
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: v-bind(badgeColor);
  background: v-bind(badgeBg);
  padding: 2px 6px;
  border-radius: 99px;
  border: 1px solid v-bind(badgeColor);
  opacity: 0.9;
}
.lbit__priority {
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.05em;
  color: rgba(148,163,184,0.7);
  text-transform: uppercase;
}

/* ── workflow state chip (inside meta, below status badge) ── */
.lbit__workflow-chip {
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 2px 7px;
  border-radius: 99px;
  pointer-events: none;
  white-space: nowrap;
}
.lbit__workflow-chip--blocked {
  color: #fca5a5;
  background: rgba(239, 68, 68, 0.13);
  border: 1px solid rgba(239, 68, 68, 0.35);
  animation: chip-blocked 2s ease-in-out infinite;
}
.lbit__workflow-chip--ready {
  color: #6ee7b7;
  background: rgba(16, 185, 129, 0.13);
  border: 1px solid rgba(16, 185, 129, 0.38);
  animation: chip-ready 1.4s ease-in-out infinite;
}
@keyframes chip-blocked {
  0%, 100% { opacity: 0.65; }
  50%       { opacity: 1; }
}
@keyframes chip-ready {
  0%, 100% { opacity: 0.8; }
  50%       { opacity: 1; box-shadow: 0 0 8px rgba(16,185,129,0.3); }
}

/* ── workflow ring ── */
@keyframes workflow-pulse {
  0%, 100% { opacity: 0.55; stroke-width: 2.5; }
  50%       { opacity: 1;    stroke-width: 4; }
}
.lbit__workflow-ring {
  animation: workflow-pulse 1.6s ease-in-out infinite;
  filter: drop-shadow(0 0 6px currentColor);
}

/* ── status ring ── */

/* In Progress: 50% arc with gentle pulse */
@keyframes ring-pulse {
  0%, 100% { opacity: 0.7; }
  50%       { opacity: 1;   }
}
.lbit__arc--progress {
  animation: ring-pulse 1.8s ease-in-out infinite;
  filter:
    drop-shadow(0 0 4px v-bind(ringGlow))
    drop-shadow(0 0 8px v-bind(ringGlow));
}

/* Done: draw-in via reactive strokeDashoffset transition */
.lbit__arc--done {
  transition: stroke-dashoffset 0.7s cubic-bezier(0.34, 1.1, 0.64, 1);
  filter:
    drop-shadow(0 0 5px v-bind(ringGlow))
    drop-shadow(0 0 10px v-bind(ringGlow));
}
</style>
