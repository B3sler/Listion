<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'

const CARDS_PER_PAGE = 3

interface PacketCard {
  key: number
  bitIds: number[]
  index: number
  total: number
  done: number
  inProgress: number
  blocked: number
  ready: number
  cycles: number
  percent: number
}

const props = defineProps<{ cards: PacketCard[] }>()

const emit = defineEmits<{
  highlight: [bitIds: number[]]
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

// Clamp page when packet count shrinks
watch(
  () => props.cards.length,
  () => {
    if (currentPage.value >= totalPages.value) {
      currentPage.value = Math.max(0, totalPages.value - 1)
    }
    measurePageHeight()
  },
)

const pageHeight = ref(0)
const firstPageEl = ref<HTMLElement | null>(null)

async function measurePageHeight() {
  await nextTick()
  if (firstPageEl.value) {
    pageHeight.value = firstPageEl.value.offsetHeight
  }
}

const dragOffset = ref(0)
const isSnapping = ref(false)

const trackStyle = computed(() => {
  const h = pageHeight.value
  const base = -(currentPage.value * h)
  return {
    transform: `translateY(${base + dragOffset.value}px)`,
    transition: isSnapping.value ? 'transform 0.38s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none',
    willChange: 'transform',
  }
})

const viewportStyle = computed(() =>
  isPaged.value && pageHeight.value > 0 ? { height: `${pageHeight.value}px` } : {},
)

const pageSlotStyle = computed(() =>
  isPaged.value && pageHeight.value > 0 ? { height: `${pageHeight.value}px` } : {},
)

function snapToPage(targetPage?: number) {
  const threshold = pageHeight.value * 0.4
  if (targetPage !== undefined) {
    currentPage.value = Math.max(0, Math.min(totalPages.value - 1, targetPage))
  } else {
    if (dragOffset.value < -threshold && currentPage.value < totalPages.value - 1) {
      currentPage.value++
    } else if (dragOffset.value > threshold && currentPage.value > 0) {
      currentPage.value--
    }
  }
  dragOffset.value = 0
  isSnapping.value = true
  setTimeout(() => {
    isSnapping.value = false
  }, 420)
}

// Rubber-band resistance at edges
function resistedOffset(raw: number): number {
  const atStart = currentPage.value === 0
  const atEnd = currentPage.value === totalPages.value - 1
  if (raw > 0 && atStart) return raw * 0.2
  if (raw < 0 && atEnd) return raw * 0.2
  return raw
}

let dragStartY = 0
let isDragging = false

function onMouseDown(e: MouseEvent) {
  if (!isPaged.value) return
  e.preventDefault()
  isDragging = true
  dragStartY = e.clientY
  isSnapping.value = false
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging) return
  dragOffset.value = resistedOffset(e.clientY - dragStartY)
}

function onMouseUp() {
  if (!isDragging) return
  isDragging = false
  snapToPage()
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
}

function onWheel(e: WheelEvent) {
  if (!isPaged.value || isSnapping.value) return
  e.preventDefault()
  e.stopPropagation()
  if (e.deltaY > 0) snapToPage(currentPage.value + 1)
  else snapToPage(currentPage.value - 1)
}

let touchStartY = 0

function onTouchStart(e: TouchEvent) {
  if (!isPaged.value) return
  touchStartY = e.touches[0]!.clientY
  isSnapping.value = false
}

function onTouchMove(e: TouchEvent) {
  if (!isPaged.value) return
  dragOffset.value = resistedOffset(e.touches[0]!.clientY - touchStartY)
}

function onTouchEnd() {
  if (!isPaged.value) return
  snapToPage()
}

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
})

const STORAGE_KEY = 'listion-packet-names'
const packetNames = ref<Record<number, string>>({})

onMounted(() => {
  measurePageHeight()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) packetNames.value = JSON.parse(raw)
  } catch {
    /* ignore */
  }
})

function getPacketName(key: number, index: number): string {
  return packetNames.value[key] ?? `Packet ${index}`
}

const editingKey = ref<number | null>(null)
const editValue = ref('')
const editInput = ref<HTMLInputElement | null>(null)

async function startRename(key: number, index: number) {
  editingKey.value = key
  editValue.value = getPacketName(key, index)
  await nextTick()
  editInput.value?.select()
}

function commitRename() {
  if (editingKey.value === null) return
  const trimmed = editValue.value.trim()
  if (trimmed) {
    packetNames.value = { ...packetNames.value, [editingKey.value]: trimmed }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(packetNames.value))
  }
  editingKey.value = null
}

function cancelRename() {
  editingKey.value = null
}

const highlightedKey = ref<number | null>(null)

function toggleHighlight(card: PacketCard) {
  if (highlightedKey.value === card.key) {
    highlightedKey.value = null
    emit('unhighlight')
  } else {
    highlightedKey.value = card.key
    emit('highlight', card.bitIds)
  }
}
</script>

<template>
  <Transition name="hud">
    <div v-if="cards.length > 0" class="packets-hud">
      <div class="hud-header">
        <span class="hud-title">Packets</span>
        <div class="hud-header-right">
          <div v-if="isPaged" class="pager-dots">
            <span
              v-for="i in totalPages"
              :key="i"
              class="pager-dot"
              :class="{ 'pager-dot--active': currentPage === i - 1 }"
            />
          </div>
          <span class="hud-count">{{ cards.length }}</span>
        </div>
      </div>

      <div
        class="packet-viewport"
        :class="{ 'packet-viewport--paged': isPaged }"
        :style="viewportStyle"
        @mousedown="onMouseDown"
        @wheel.prevent="onWheel"
        @touchstart.passive="onTouchStart"
        @touchmove.prevent="onTouchMove"
        @touchend="onTouchEnd"
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
              class="packet-card"
              :class="{ 'packet-card--highlighted': highlightedKey === card.key }"
            >
              <div class="packet-card__header">
                <template v-if="editingKey === card.key">
                  <input
                    ref="editInput"
                    v-model="editValue"
                    class="packet-name-input"
                    maxlength="32"
                    @keydown.enter.prevent="commitRename"
                    @keydown.escape.prevent="cancelRename"
                    @blur="commitRename"
                    @mousedown.stop
                  />
                </template>
                <template v-else>
                  <button
                    class="packet-name"
                    @click="startRename(card.key, card.index)"
                    @mousedown.stop
                  >
                    {{ getPacketName(card.key, card.index) }}
                    <span class="edit-icon">✎</span>
                  </button>
                </template>

                <div class="card-actions">
                  <button
                    class="highlight-btn"
                    :class="{ 'highlight-btn--active': highlightedKey === card.key }"
                    :title="
                      highlightedKey === card.key ? 'Highlight entfernen' : 'Auf Canvas hervorheben'
                    "
                    @click="toggleHighlight(card)"
                    @mousedown.stop
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

              <div class="packet-bar">
                <div class="packet-bar__fill" :style="{ width: card.percent + '%' }" />
              </div>

              <div
                v-if="card.cycles || card.blocked || card.ready || card.inProgress"
                class="packet-chips"
              >
                <span v-if="card.cycles > 0" class="chip chip--cycle">⚠ cycle</span>
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
  width: 228px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hud-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2px;
}

.hud-title {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(148, 163, 184, 0.5);
}

.hud-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hud-count {
  font-size: 9.5px;
  font-weight: 600;
  color: rgba(148, 163, 184, 0.4);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 99px;
  padding: 1px 7px;
  line-height: 16px;
}

.pager-dots {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pager-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: rgba(148, 163, 184, 0.2);
  transition:
    background 0.2s,
    transform 0.2s;
}

.pager-dot--active {
  background: rgba(226, 232, 240, 0.65);
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
  gap: 6px;
  flex-shrink: 0;
}

.packet-viewport--paged .packet-page {
  align-content: flex-start;
  padding-bottom: 10px;
}

.packet-card {
  background: rgba(10, 10, 20, 0.84);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 12px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
  flex-shrink: 0;
}

.packet-card:hover {
  border-color: rgba(255, 255, 255, 0.12);
}

.packet-card--highlighted {
  border-color: rgba(148, 163, 184, 0.42) !important;
  box-shadow:
    0 0 0 1px rgba(148, 163, 184, 0.12),
    0 0 20px rgba(148, 163, 184, 0.07);
}

.packet-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  min-height: 22px;
}

.packet-name {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: rgba(148, 163, 184, 0.75);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  flex: 1;
  transition: color 0.15s;
}

.packet-name:hover {
  color: rgba(226, 232, 240, 0.9);
}

.edit-icon {
  font-size: 9px;
  opacity: 0;
  flex-shrink: 0;
  transition: opacity 0.15s;
}

.packet-name:hover .edit-icon {
  opacity: 0.55;
}

.packet-name-input {
  flex: 1;
  min-width: 0;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: #e2e8f0;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(148, 163, 184, 0.4);
  border-radius: 5px;
  padding: 2px 6px;
  outline: none;
  transition: border-color 0.15s;
}

.packet-name-input:focus {
  border-color: rgba(148, 163, 184, 0.65);
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-shrink: 0;
}

.highlight-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: none;
  border: 1px solid transparent;
  cursor: pointer;
  color: rgba(148, 163, 184, 0.35);
  transition:
    color 0.15s,
    background 0.15s,
    border-color 0.15s;
}

.highlight-btn:hover {
  color: rgba(226, 232, 240, 0.8);
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.1);
}

.highlight-btn--active {
  color: #e2e8f0;
  background: rgba(148, 163, 184, 0.13);
  border-color: rgba(148, 163, 184, 0.32);
}

.packet-fraction {
  font-size: 15px;
  font-weight: 700;
  color: #f1f5f9;
  line-height: 1;
}

.packet-fraction__total {
  font-size: 10px;
  font-weight: 400;
  color: rgba(148, 163, 184, 0.4);
}

.packet-bar {
  width: 100%;
  height: 3px;
  background: rgba(255, 255, 255, 0.07);
  border-radius: 99px;
  overflow: hidden;
}

.packet-bar__fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981, #34d399);
  border-radius: 99px;
  transition: width 0.55s cubic-bezier(0.34, 1.2, 0.64, 1);
  box-shadow: 0 0 6px rgba(52, 211, 153, 0.45);
}

.packet-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.chip {
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 99px;
  border: 1px solid currentColor;
}

.chip--cycle {
  color: #f97316;
  background: rgba(249, 115, 22, 0.12);
  animation: blink-cycle 1s ease-in-out infinite;
}
.chip--blocked {
  color: #f87171;
  background: rgba(248, 113, 113, 0.1);
}
.chip--ready {
  color: #34d399;
  background: rgba(52, 211, 153, 0.1);
}
.chip--progress {
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.1);
}

@keyframes blink-cycle {
  0%,
  100% {
    opacity: 0.7;
  }
  50% {
    opacity: 1;
  }
}

.hud-enter-active {
  transition:
    opacity 0.3s ease,
    transform 0.35s cubic-bezier(0.34, 1.4, 0.64, 1);
}
.hud-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.hud-enter-from,
.hud-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.95);
}
</style>
