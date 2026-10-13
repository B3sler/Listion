<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { TriangleAlert } from 'lucide-vue-next'
import {
  Spring,
  VelocityTracker,
  project,
  rubberband,
  SPRING_DEFAULT,
  SPRING_MOMENTUM,
} from '@/helpers/motion'
import type { PacketCard } from '@/types/flow'

const CARDS_PER_PAGE = 3

const props = defineProps<{ cards: PacketCard[] }>()

const emit = defineEmits<{
  highlight: [packetId: number]
  unhighlight: []
}>()

const currentPage = ref(0)
const totalPages = computed(() => Math.ceil(props.cards.length / CARDS_PER_PAGE))
const isPaged = computed(() => totalPages.value > 1)

const pages = computed(() => {
  const result: PacketCard[][] = []
  for (let i = 0; i < totalPages.value; i++) {
    result.push(props.cards.slice(i * CARDS_PER_PAGE, (i + 1) * CARDS_PER_PAGE))
  }
  return result
})

const pageHeight = ref(0)
const firstPageEl = ref<HTMLElement | null>(null)

async function measurePageHeight() {
  await nextTick()
  if (firstPageEl.value) {
    pageHeight.value = firstPageEl.value.offsetHeight
  }
}

// Clamp page when packet count shrinks
watch(
  () => props.cards.length,
  async () => {
    if (currentPage.value >= totalPages.value) {
      currentPage.value = Math.max(0, totalPages.value - 1)
    }
    await measurePageHeight()
    goToPage(currentPage.value)
  },
)

// Track offset is a spring: interruptible, velocity-aware, always starts from the live value
const offset = ref(0)
const spring = new Spring(0, (v) => (offset.value = v))

const trackStyle = computed(() => ({
  transform: `translate3d(0, ${offset.value}px, 0)`,
  willChange: 'transform',
}))

const viewportStyle = computed(() =>
  isPaged.value && pageHeight.value > 0 ? { height: `${pageHeight.value}px` } : {},
)

const pageSlotStyle = computed(() =>
  isPaged.value && pageHeight.value > 0 ? { height: `${pageHeight.value}px` } : {},
)

function clampPage(p: number) {
  return Math.max(0, Math.min(totalPages.value - 1, p))
}

function goToPage(page: number, velocity?: number) {
  currentPage.value = clampPage(page)
  const cfg = velocity ? SPRING_MOMENTUM : SPRING_DEFAULT
  spring.to(-currentPage.value * pageHeight.value, { ...cfg, velocity })
}

// Soft boundaries: past the first/last page the track follows with increasing resistance
function withRubberband(raw: number): number {
  const min = -(totalPages.value - 1) * pageHeight.value
  const max = 0
  const dim = pageHeight.value || 1
  if (raw > max) return max + rubberband(raw - max, dim)
  if (raw < min) return min + rubberband(raw - min, dim)
  return raw
}

// --- Drag (mouse, touch, pen) ---
const tracker = new VelocityTracker()
let pointerId: number | null = null
let dragStartY = 0
let dragStartOffset = 0
let dragStartPage = 0
let hasMoved = false

function onPointerDown(e: PointerEvent) {
  if (!isPaged.value || e.button !== 0) return
  pointerId = e.pointerId
  try {
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  } catch {
    /* pointer already gone */
  }
  spring.stop() // catch the track mid-flight
  dragStartY = e.clientY
  dragStartOffset = offset.value
  dragStartPage = Math.round(-offset.value / (pageHeight.value || 1))
  hasMoved = false
  tracker.reset()
  tracker.add(0, e.clientY)
}

function onPointerMove(e: PointerEvent) {
  if (e.pointerId !== pointerId) return
  const dy = e.clientY - dragStartY
  if (!hasMoved && Math.abs(dy) < 6) return
  hasMoved = true
  tracker.add(0, e.clientY)
  spring.set(withRubberband(dragStartOffset + dy))
}

function onPointerUp(e: PointerEvent) {
  if (e.pointerId !== pointerId) return
  pointerId = null
  if (!hasMoved) return
  const v = tracker.velocity().y
  let target: number
  if (Math.abs(v) > 250) {
    // Intent comes from the direction of the flick, not from how far it travelled
    target = dragStartPage + (v < 0 ? 1 : -1)
  } else {
    const projected = offset.value + project(v, 0.99)
    target = Math.round(-projected / (pageHeight.value || 1))
  }
  goToPage(target, v)
}

// --- Wheel: one page per gesture, never locked out while animating ---
let wheelAccum = 0
let wheelConsumed = false
let wheelIdleTimer: ReturnType<typeof setTimeout> | null = null

function onWheel(e: WheelEvent) {
  if (!isPaged.value) return
  e.stopPropagation()
  if (wheelIdleTimer) clearTimeout(wheelIdleTimer)
  // a pause in wheel events ends the gesture (absorbs trackpad inertia)
  wheelIdleTimer = setTimeout(() => {
    wheelAccum = 0
    wheelConsumed = false
  }, 140)
  if (wheelConsumed) return
  wheelAccum += e.deltaY
  if (Math.abs(wheelAccum) > 30) {
    goToPage(currentPage.value + (wheelAccum > 0 ? 1 : -1))
    wheelConsumed = true
  }
}

onUnmounted(() => {
  spring.stop()
  if (wheelIdleTimer) clearTimeout(wheelIdleTimer)
})

onMounted(() => {
  measurePageHeight()
})

const highlightedKey = ref<number | null>(null)

function toggleHighlight(card: PacketCard) {
  if (highlightedKey.value === card.key) {
    highlightedKey.value = null
    emit('unhighlight')
  } else {
    highlightedKey.value = card.key
    emit('highlight', card.key)
  }
}
</script>

<template>
  <Transition name="hud">
    <div v-if="cards.length > 0" class="packets-hud">
      <div class="hud-header">
        <span class="hud-title">Packets</span>
        <div class="hud-header-right">
          <div v-if="isPaged" class="pager-dots" role="tablist" aria-label="Packet pages">
            <button
              v-for="i in totalPages"
              :key="i"
              class="pager-dot"
              :class="{ 'pager-dot--active': currentPage === i - 1 }"
              role="tab"
              :aria-selected="currentPage === i - 1"
              :aria-label="`Page ${i}`"
              @click="goToPage(i - 1)"
            />
          </div>
          <span class="hud-count">{{ cards.length }}</span>
        </div>
      </div>

      <div
        class="packet-viewport"
        :class="{ 'packet-viewport--paged': isPaged }"
        :style="viewportStyle"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @wheel.prevent="onWheel"
      >
        <div class="packet-track" :style="isPaged ? trackStyle : {}">
          <div
            v-for="(pageCards, pi) in pages"
            :key="pi"
            class="packet-page"
            :ref="
              (el) => {
                if (pi === 0) firstPageEl = el as HTMLElement | null
              }
            "
            :style="pageSlotStyle"
          >
            <div
              v-for="card in pageCards"
              :key="card.key"
              class="packet-card material"
              :class="{ 'packet-card--highlighted': highlightedKey === card.key }"
            >
              <div class="packet-card__header">
                <button class="packet-name" @click="toggleHighlight(card)" @pointerdown.stop>
                  <span class="packet-name__text">{{ card.name }}</span>
                </button>

                <div class="card-actions">
                  <button
                    class="highlight-btn pressable"
                    :class="{ 'highlight-btn--active': highlightedKey === card.key }"
                    :title="
                      highlightedKey === card.key ? 'Highlight entfernen' : 'Auf Canvas hervorheben'
                    "
                    :aria-pressed="highlightedKey === card.key"
                    @click="toggleHighlight(card)"
                    @pointerdown.stop
                  >
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="5.5" stroke="currentColor" stroke-width="1.5" />
                      <circle cx="8" cy="8" r="2" fill="currentColor" />
                      <line
                        x1="8"
                        y1="1"
                        x2="8"
                        y2="3.5"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                      />
                      <line
                        x1="8"
                        y1="12.5"
                        x2="8"
                        y2="15"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                      />
                      <line
                        x1="1"
                        y1="8"
                        x2="3.5"
                        y2="8"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                      />
                      <line
                        x1="12.5"
                        y1="8"
                        x2="15"
                        y2="8"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                      />
                    </svg>
                  </button>
                  <span class="packet-fraction">
                    {{ card.done }}<span class="packet-fraction__total">/{{ card.total }}</span>
                  </span>
                </div>
              </div>

              <div
                class="packet-bar"
                role="progressbar"
                :aria-valuenow="card.percent"
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <div
                  class="packet-bar__fill"
                  :style="{ transform: `scaleX(${card.percent / 100})` }"
                />
              </div>

              <div
                v-if="card.cycles || card.blocked || card.ready || card.inProgress"
                class="packet-chips"
              >
                <span v-if="card.cycles > 0" class="chip chip--cycle">
                  <TriangleAlert :size="9" :stroke-width="2.5" /> cycle
                </span>
                <span v-if="card.blocked > 0" class="chip chip--blocked"
                  >{{ card.blocked }} blocked</span
                >
                <span v-if="card.ready > 0" class="chip chip--ready">{{ card.ready }} ready</span>
                <span v-if="card.inProgress > 0" class="chip chip--progress"
                  >{{ card.inProgress }} active</span
                >
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.packets-hud {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 50;
  width: 236px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transform-origin: bottom right;
}

.hud-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
}

.hud-title {
  font-size: 0.8125rem;
  font-weight: 650;
  letter-spacing: -0.005em;
  color: var(--text1);
}

.hud-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hud-count {
  font-size: 0.6875rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text2);
  background: var(--fill-hover);
  border-radius: 99px;
  padding: 0 7px;
  line-height: 18px;
}

.pager-dots {
  display: flex;
  align-items: center;
  gap: 2px;
}

/* 6px dot inside a 14px hit target */
.pager-dot {
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.pager-dot::before {
  content: '';
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--text2);
  opacity: 0.3;
  transition:
    opacity 0.2s ease,
    transform var(--spring-duration) var(--ease-spring);
}

.pager-dot--active::before {
  opacity: 0.9;
  transform: scale(1.3);
}

.packet-viewport {
  position: relative;
  cursor: default;
}

.packet-viewport--paged {
  overflow: hidden;
  /* height is set dynamically via :style after measuring the first page */
  cursor: grab;
  user-select: none;
  touch-action: none;
  /* scroll edge effect: cards fade where they leave the viewport */
  mask-image: linear-gradient(
    to bottom,
    transparent 0,
    #000 4px,
    #000 calc(100% - 8px),
    transparent 100%
  );
}

.packet-viewport--paged:active {
  cursor: grabbing;
}

.packet-track {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.packet-page {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}

.packet-viewport--paged .packet-page {
  align-content: flex-start;
  padding: 2px 0 10px;
}

.packet-card {
  border-radius: 14px;
  padding: 11px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
  flex-shrink: 0;
}

.packet-card--highlighted {
  border-color: color-mix(in srgb, var(--brand) 55%, transparent);
  box-shadow:
    inset 0 1px 0 var(--material-edge),
    0 0 0 3px color-mix(in srgb, var(--brand) 15%, transparent),
    0 8px 24px -6px hsl(var(--surface-shadow) / calc(var(--shadow-strength) + 0.05));
}

.packet-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-height: 24px;
}

.packet-name {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: -0.005em;
  color: var(--text0);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  min-width: 0;
  flex: 1;
  text-align: left;
}

.packet-name__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.highlight-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 12px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text2);
}

.highlight-btn:hover {
  color: var(--text0);
  background: var(--fill-hover);
}

.highlight-btn--active,
.highlight-btn--active:hover {
  color: hsl(0 0% 100%);
  background: var(--brand);
}

.packet-fraction {
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--text0);
  line-height: 1;
}

.packet-fraction__total {
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--text2);
}

.packet-bar {
  width: 100%;
  height: 4px;
  background: var(--fill-press);
  border-radius: 99px;
  overflow: hidden;
}

/* scaleX instead of width: compositor-only */
.packet-bar__fill {
  height: 100%;
  width: 100%;
  background: linear-gradient(90deg, #10b981, #34d399);
  border-radius: 99px;
  transform-origin: left center;
  transition: transform 0.6s var(--ease-spring);
}

.packet-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  padding: 1px 7px;
  border-radius: 99px;
  font-variant-numeric: tabular-nums;
}

.chip--cycle {
  color: #ea580c;
  background: rgba(249, 115, 22, 0.14);
}
.chip--blocked {
  color: #dc2626;
  background: rgba(248, 113, 113, 0.14);
}
.chip--ready {
  color: #059669;
  background: rgba(52, 211, 153, 0.16);
}
.chip--progress {
  color: #b45309;
  background: rgba(251, 191, 36, 0.18);
}
:global(.theme-dark) .chip--cycle {
  color: #fb923c;
}
:global(.theme-dark) .chip--blocked {
  color: #f87171;
}
:global(.theme-dark) .chip--ready {
  color: #34d399;
}
:global(.theme-dark) .chip--progress {
  color: #fbbf24;
}

/* HUD materializes from its corner */
.hud-enter-active {
  transition:
    opacity 0.25s ease,
    transform var(--spring-duration) var(--ease-spring);
}
.hud-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.25s ease;
}
.hud-enter-from,
.hud-leave-to {
  opacity: 0;
  transform: scale(0.92);
}

@media (prefers-reduced-motion: reduce) {
  .hud-enter-from,
  .hud-leave-to {
    transform: none;
  }
}
</style>
