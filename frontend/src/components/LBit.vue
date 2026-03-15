<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Bit } from '@/stores/bitStore'

const props = defineProps<{
  bit: Bit
  zoom: number
}>()

const emit = defineEmits<{
  moveEnd: [id: number, x: number, y: number]
  rename: [id: number, title: string]
  delete: [id: number]
}>()

const isDragging = ref(false)
const dragX = ref(props.bit.x)
const dragY = ref(props.bit.y)
const isEditing = ref(false)
const editTitle = ref(props.bit.title)
const editInput = ref<HTMLInputElement | null>(null)

watch(
  () => [props.bit.x, props.bit.y] as const,
  ([x, y]) => { if (!isDragging.value) { dragX.value = x; dragY.value = y } },
)
watch(isEditing, (v) => {
  if (v) { editTitle.value = props.bit.title; setTimeout(() => editInput.value?.select(), 0) }
})

// ── theme ──────────────────────────────────────────────────────────
const THEMES = {
  0: { color: '#818cf8', shadow: 'rgba(129,140,248,0.5)',  bg: 'rgba(99,102,241,0.07)',  label: 'Open'        },
  1: { color: '#fbbf24', shadow: 'rgba(251,191,36,0.5)',   bg: 'rgba(245,158,11,0.07)',  label: 'In Progress' },
  2: { color: '#34d399', shadow: 'rgba(52,211,153,0.5)',   bg: 'rgba(16,185,129,0.07)',  label: 'Done'        },
} as const

const theme = computed(() => THEMES[props.bit.status as 0 | 1 | 2] ?? THEMES[0])

const PRIORITY_LABEL: Record<number, string> = { 1: 'Low', 2: 'Med', 3: 'High' }
const priorityLabel = computed(() => props.bit.priority ? PRIORITY_LABEL[props.bit.priority] : null)

// for CSS v-bind
const statusColor  = computed(() => theme.value.color)
const statusShadow = computed(() => theme.value.shadow)
const statusBg     = computed(() => theme.value.bg)

// ── octagon geometry (144 × 144, cut 36px, corner radius 10px) ────
// r/√2 ≈ 7.07 — used to offset along the 45° diagonal edges
const outerPath =
  'M 28.93,7.07 Q 36,0 46,0 L 98,0 Q 108,0 115.07,7.07 ' +
  'L 136.93,28.93 Q 144,36 144,46 L 144,98 Q 144,108 136.93,115.07 ' +
  'L 115.07,136.93 Q 108,144 98,144 L 46,144 Q 36,144 28.93,136.93 ' +
  'L 7.07,115.07 Q 0,108 0,98 L 0,46 Q 0,36 7.07,28.93 Z'

// inner ring: inset 8px on flat edges, r=6 (r/√2 ≈ 4.24)
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
  const sx = e.clientX, sy = e.clientY
  const ox = dragX.value,  oy = dragY.value
  const onMove = (ev: MouseEvent) => {
    dragX.value = ox + (ev.clientX - sx) / props.zoom
    dragY.value = oy + (ev.clientY - sy) / props.zoom
  }
  const onUp = () => {
    isDragging.value = false
    emit('moveEnd', props.bit.id, dragX.value, dragY.value)
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

// ── edit ──────────────────────────────────────────────────────────
function startEdit(e: MouseEvent) { e.stopPropagation(); isEditing.value = true }
function commitEdit() {
  const t = editTitle.value.trim()
  if (t && t !== props.bit.title) emit('rename', props.bit.id, t)
  isEditing.value = false
}
function cancelEdit() { isEditing.value = false }
</script>

<template>
  <div
    class="lbit"
    :class="{ 'lbit--dragging': isDragging }"
    :style="{
      position: 'absolute',
      left: `${dragX}px`,
      top: `${dragY}px`,
      width: '144px',
      height: '144px',
      userSelect: 'none',
      transform: 'translate(-50%, -50%)',
      cursor: isDragging ? 'grabbing' : 'grab',
      clipPath: `path('${outerPath}')`,
    }"
    @mousedown="startDrag"
    @dblclick="startEdit"
  >
    <svg
      width="144" height="144"
      style="position:absolute;inset:0;overflow:visible"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath :id="`clip-${bit.id}`">
          <path :d="outerPath" />
        </clipPath>

        <!-- subtle radial gradient tint from status color -->
        <radialGradient :id="`tint-${bit.id}`" cx="50%" cy="30%" r="70%">
          <stop offset="0%"   :stop-color="theme.color" stop-opacity="0.22" />
          <stop offset="100%" :stop-color="theme.color" stop-opacity="0"    />
        </radialGradient>
      </defs>

      <!-- base fill — semi-transparent for glass effect -->
      <path :d="outerPath" fill="rgba(14,14,32,0.62)" />

      <!-- radial tint overlay -->
      <path :d="outerPath" :fill="`url(#tint-${bit.id})`" />

      <!-- inner ring — subtle depth -->
      <path :d="innerPath" fill="none" stroke="rgba(255,255,255,0.09)" stroke-width="1" />

      <!-- top accent bar -->
      <line x1="44" y1="1.5" x2="100" y2="1.5"
        :stroke="theme.color" stroke-width="2.5"
        stroke-linecap="round" opacity="0.9"
      />

      <!-- outer border -->
      <path :d="outerPath" fill="none"
        :stroke="theme.color" stroke-width="1.5"
        opacity="0.55" class="lbit__border"
      />

      <!-- connector dots — midpoints of flat edges -->
      <circle cx="72"    cy="1.5"   r="2.5" :fill="theme.color" class="lbit__dot" />
      <circle cx="142.5" cy="72"    r="2.5" :fill="theme.color" class="lbit__dot" />
      <circle cx="72"    cy="142.5" r="2.5" :fill="theme.color" class="lbit__dot" />
      <circle cx="1.5"   cy="72"    r="2.5" :fill="theme.color" class="lbit__dot" />
    </svg>

    <!-- ── content ── -->
    <div class="lbit__body">
      <!-- title / edit -->
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

      <!-- meta row -->
      <div class="lbit__meta">
        <span class="lbit__badge">{{ theme.label }}</span>
        <span v-if="priorityLabel" class="lbit__priority">{{ priorityLabel }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── entrance + float animations ── */
@keyframes lbit-enter {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.78);
    filter: drop-shadow(0 0 0px transparent);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

@keyframes lbit-float {
  0%, 100% { transform: translateY(0px);   }
  50%       { transform: translateY(-4px);  }
}

/* ── wrapper: backdrop blur + drop-shadow glow ── */
.lbit {
  backdrop-filter: blur(16px) saturate(1.5);
  -webkit-backdrop-filter: blur(16px) saturate(1.5);
  filter:
    drop-shadow(0 6px 18px rgba(0,0,0,0.55))
    drop-shadow(0 0 6px v-bind(statusShadow));
  animation: lbit-enter 0.38s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  transition:
    filter    0.3s ease,
    transform 0.25s ease;
}
.lbit:hover {
  filter:
    drop-shadow(0 8px 24px rgba(0,0,0,0.65))
    drop-shadow(0 0 14px v-bind(statusShadow));
  transform: translate(-50%, -50%) scale(1.04) !important;
}
.lbit--dragging {
  filter:
    drop-shadow(0 12px 32px rgba(0,0,0,0.7))
    drop-shadow(0 0 22px v-bind(statusShadow)) !important;
  transform: translate(-50%, -50%) scale(1.07) !important;
  transition: none !important;
  animation: none !important;
}

/* ── border brightens on hover ── */
.lbit__border {
  transition: opacity 0.25s ease;
}
.lbit:hover .lbit__border {
  opacity: 0.9;
  stroke-width: 2;
}

/* ── connector dots: hidden → visible on hover ── */
.lbit__dot {
  opacity: 0;
  transition: opacity 0.2s ease;
}
.lbit:hover .lbit__dot {
  opacity: 0.7;
}

/* ── layout ── */
.lbit__body {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 20px 28px;
  pointer-events: none;
  animation: lbit-float 5s ease-in-out infinite;
}

.lbit--dragging .lbit__body {
  animation: none;
}

/* ── title ── */
.lbit__title {
  color: #e2e8f0;
  font-size: 11.5px;
  font-weight: 500;
  letter-spacing: 0.02em;
  line-height: 1.4;
  text-align: center;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ── inline edit ── */
.lbit__input {
  pointer-events: all;
  background: rgba(255,255,255,0.05);
  border: 1px solid v-bind(statusColor);
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

/* ── meta row ── */
.lbit__meta {
  display: flex;
  align-items: center;
  gap: 5px;
}

.lbit__badge {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: v-bind(statusColor);
  background: v-bind(statusBg);
  padding: 2px 6px;
  border-radius: 99px;
  border: 1px solid v-bind(statusColor);
  opacity: 0.85;
}

.lbit__priority {
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.05em;
  color: rgba(148,163,184,0.7);
  text-transform: uppercase;
}
</style>
