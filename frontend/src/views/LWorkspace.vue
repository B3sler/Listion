<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import LContextMenu from '@/components/LContextMenu.vue'
import LBit from '@/components/LBit.vue'
import LCreateBitModal from '@/components/LCreateBitModal.vue'
import { useTheme } from '@/composables/useTheme.ts'
import { useCanvas } from '@/composables/useCanvas.ts'
import LTaskbar from '@/layout/LTaskbar.vue'
import LMenu from '@/layout/LMenu.vue'
import { ScanSearch, ZoomIn, ZoomOut, Fullscreen } from 'lucide-vue-next'
import { useBitStore } from '@/stores/bitStore'

type ContextMenuState = {
  visible: boolean
  x: number
  y: number
}

const containerRef = ref<HTMLElement | null>(null)

const {
  zoom,
  panX,
  panY,
  canvasTransform,
  isDragging,
  zoomIn,
  zoomOut,
  resetView,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  handleWheel,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
} = useCanvas(containerRef)

const bitStore = useBitStore()

// canvas-space coordinates of the last right-click
const contextCanvasPos = ref({ x: 0, y: 0 })
const contextMenu = ref<ContextMenuState>({ visible: false, x: 0, y: 0 })

const showContextMenu = (x: number, y: number) => {
  contextMenu.value = { visible: true, x, y }
}

const closeContextMenu = () => {
  contextMenu.value.visible = false
}

const handleContextMenu = (event: MouseEvent) => {
  event.preventDefault()
  contextCanvasPos.value = {
    x: (event.clientX - panX.value) / zoom.value,
    y: (event.clientY - panY.value) / zoom.value,
  }
  showContextMenu(event.clientX, event.clientY)
}

// ── long-press (touch) ─────────────────────────────────────────────
let longPressTimer: number | null = null
const LONG_PRESS_DURATION = 500

const handleTouchStartWithLongPress = (event: TouchEvent) => {
  if (event.touches.length === 1) {
    const touch = event.touches[0]!
    longPressTimer = window.setTimeout(() => {
      contextCanvasPos.value = {
        x: (touch.clientX - panX.value) / zoom.value,
        y: (touch.clientY - panY.value) / zoom.value,
      }
      showContextMenu(touch.clientX, touch.clientY)
    }, LONG_PRESS_DURATION)
  } else {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null }
  }
  handleTouchStart(event)
}

const handleTouchMoveWithLongPress = (event: TouchEvent) => {
  if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null }
  handleTouchMove(event)
}

const handleTouchEndWithLongPress = (event: TouchEvent) => {
  if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null }
  handleTouchEnd(event)
}

// ── bit actions ────────────────────────────────────────────────────
const showCreateModal = ref(false)

const createBit = () => {
  closeContextMenu()
  showCreateModal.value = true
}

const onModalConfirm = async (data: {
  title: string
  status: number
  priority: number | undefined
  dueDate: string | undefined
  notes: string | undefined
}) => {
  showCreateModal.value = false
  try {
    await bitStore.createBit({
      title: data.title,
      x: contextCanvasPos.value.x,
      y: contextCanvasPos.value.y,
      status: data.status,
      priority: data.priority,
      dueDate: data.dueDate,
      notes: data.notes,
    })
  } catch (e) {
    console.error('Failed to create bit:', e)
  }
}

const onBitMoveEnd = (id: number, x: number, y: number) => {
  bitStore.updateBit(id, { x: Math.round(x), y: Math.round(y) })
}

const onBitRename = (id: number, title: string) => {
  bitStore.updateBit(id, { title })
}

const menuItems = [
  { label: 'Create Bit', icon: '+', action: createBit },
  { label: 'Create Packet', icon: '◼', action: () => closeContextMenu() },
]

// ── theme & controls ───────────────────────────────────────────────
const { initTheme, applyTheme, isDark } = useTheme()

const showControls = ref(false)
let hideTimer: number | null = null

function handleEnter() {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
  showControls.value = true
}

function handleLeaveDelay() {
  hideTimer = window.setTimeout(() => { showControls.value = false }, 300)
}

onMounted(() => {
  initTheme()
  applyTheme()
  window.addEventListener('mouseup', handleMouseUp)
  window.addEventListener('mousemove', handleMouseMove)
  bitStore.fetchBits()
})

onUnmounted(() => {
  window.removeEventListener('mouseup', handleMouseUp)
  window.removeEventListener('mousemove', handleMouseMove)
})
</script>

<template>
  <div
    ref="containerRef"
    class="w-full h-screen overflow-hidden bg-surface1 relative"
    :class="isDark ? 'bg-dotted-grid-dark' : 'bg-dotted-grid-light'"
    @wheel.prevent="handleWheel"
    @mousedown="handleMouseDown"
    @contextmenu="handleContextMenu"
    @touchstart="handleTouchStartWithLongPress"
    @touchmove="handleTouchMoveWithLongPress"
    @touchend="handleTouchEndWithLongPress"
    :style="{ cursor: isDragging ? 'grabbing' : 'default' }"
  >
    <!-- ── canvas transform layer ── -->
    <div class="absolute inset-0 origin-top-left" :style="{ transform: canvasTransform }">
      <!-- workspace hint text -->
      <div class="p-5">
        <div class="max-w-7xl">
          <h1 class="text-3xl font-bold text-text0 mb-4">Workspace</h1>
          <p class="text-text1 text-base">
            Right-click or long-press for options. Shift+Drag or Ctrl+Scroll to navigate.
          </p>
        </div>
      </div>

      <!-- ── bits ── -->
      <LBit
        v-for="bit in bitStore.bits"
        :key="bit.id"
        :bit="bit"
        :zoom="zoom"
        @move-end="onBitMoveEnd"
        @rename="onBitRename"
        @delete="(id) => bitStore.deleteBit(id)"
      />
    </div>

    <!-- ── zoom controls ── -->
    <div class="absolute bottom-4 left-4 z-50">
      <div
        class="flex flex-col items-start"
        @mouseenter="handleEnter"
        @mouseleave="handleLeaveDelay"
      >
        <transition name="fade" mode="out-in">
          <div v-if="showControls" class="flex flex-col items-start gap-2">
            <button
              @click="zoomIn"
              class="w-12 h-12 text-text0 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-surface2 active:scale-95"
              title="Zoom In"
            >
              <ZoomIn :size="24" />
            </button>
            <button
              @click="zoomOut"
              class="w-12 h-12 text-text0 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-surface2 active:scale-95"
              title="Zoom Out"
            >
              <ZoomOut :size="24" />
            </button>
            <button
              @click="resetView"
              class="w-12 h-12 text-text0 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-surface2 active:scale-95"
              title="Reset View"
            >
              <Fullscreen :size="24" />
            </button>
          </div>
          <button
            v-else
            class="w-12 h-12 text-text0 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-surface2 active:scale-95"
            title="View Controls"
          >
            <ScanSearch :size="24" />
          </button>
        </transition>
      </div>
    </div>

    <LTaskbar />
    <LMenu />
    <LCreateBitModal
      v-if="showCreateModal"
      @confirm="onModalConfirm"
      @cancel="showCreateModal = false"
    />
    <LContextMenu
      v-if="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :items="menuItems"
      @close="closeContextMenu"
    />
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
