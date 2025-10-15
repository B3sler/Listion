<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import LContextMenu from '@/components/LContextMenu.vue'
import { useTheme } from '@/composables/useTheme.ts'
import LTaskbar from '@/layout/LTaskbar.vue'
import LMenu from '@/layout/LMenu.vue'
import { ScanSearch, ZoomIn, ZoomOut, Fullscreen } from 'lucide-vue-next'

type ContextMenuState = {
  visible: boolean
  x: number
  y: number
}

const contextMenu = ref<ContextMenuState>({
  visible: false,
  x: 0,
  y: 0,
})

const storageKeyZoom = 'lZoom'
const storageKeyPanZ = 'lPanX'
const storageKeyPanY = 'lPanY'

const zoom = ref(parseFloat(localStorage.getItem(storageKeyZoom) || '1'))
const panX = ref(parseFloat(localStorage.getItem(storageKeyPanZ) || '0'))
const panY = ref(parseFloat(localStorage.getItem(storageKeyPanY) || '0'))
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartY = ref(0)
const dragStartPanX = ref(0)
const dragStartPanY = ref(0)

const MIN_ZOOM = 0.25
const MAX_ZOOM = 3
const ZOOM_STEP = 0.1

let longPressTimer: number | null = null
const LONG_PRESS_DURATION = 500

const canvasTransform = computed(() => {
  return `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`
})

watch(zoom, (newZoom) => {
  localStorage.setItem(storageKeyZoom, newZoom.toString())
})

watch(panX, (newPanX) => {
  localStorage.setItem(storageKeyPanZ, newPanX.toString())
})

watch(panY, (newPanY) => {
  localStorage.setItem(storageKeyPanY, newPanY.toString())
})

const handleContextMenu = (event: MouseEvent) => {
  event.preventDefault()
  showContextMenu(event.clientX, event.clientY)
}

const showContextMenu = (x: number, y: number) => {
  contextMenu.value = {
    visible: true,
    x,
    y,
  }
}

const closeContextMenu = () => {
  contextMenu.value.visible = false
}

const handleWheel = (event: WheelEvent) => {
  event.preventDefault()
  const delta = -event.deltaY / 1000
  const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom.value + delta))

  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  const xs = (x - panX.value) / zoom.value
  const ys = (y - panY.value) / zoom.value

  panX.value = x - xs * newZoom
  panY.value = y - ys * newZoom
  zoom.value = newZoom
}

const zoomIn = () => {
  zoom.value = Math.min(MAX_ZOOM, zoom.value + ZOOM_STEP)
}

const zoomOut = () => {
  zoom.value = Math.max(MIN_ZOOM, zoom.value - ZOOM_STEP)
}

const resetZoom = () => {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
}

const handleMouseDown = (event: MouseEvent) => {
  if (event.button === 1 || (event.button === 0 && event.shiftKey)) {
    event.preventDefault()
    isDragging.value = true
    dragStartX.value = event.clientX
    dragStartY.value = event.clientY
    dragStartPanX.value = panX.value
    dragStartPanY.value = panY.value
  }
}

const handleMouseMove = (event: MouseEvent) => {
  if (isDragging.value) {
    const dx = event.clientX - dragStartX.value
    const dy = event.clientY - dragStartY.value
    panX.value = dragStartPanX.value + dx
    panY.value = dragStartPanY.value + dy
  }
}

const handleMouseUp = () => {
  isDragging.value = false
}

const handleTouchStart = (event: TouchEvent) => {
  if (event.touches.length === 2) {
    //ToDO Zwei-Finger-Touch für Pinch-Zoom könnte hier implementiert werden
    return
  }

  const touch = event.touches[0]
  if (!touch) return

  const x = touch.clientX
  const y = touch.clientY

  longPressTimer = window.setTimeout(() => {
    showContextMenu(x, y)
  }, LONG_PRESS_DURATION)
}

const handleTouchEnd = () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

const handleTouchMove = () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

const createBit = () => {
  console.log('Create bit was selected')
  alert('Create bit - Function will be implemented')
}

const menuItems = [
  {
    label: 'Create Bit',
    icon: '+',
    action: createBit,
  },
  {
    label: 'Create Packet',
    icon: '◼️',
    action: createBit,
  },
]

const { initTheme, applyTheme, isDark } = useTheme()

const showControls = ref(false)

const controlTransition = ref(false)

function handleLeaveDelay() {
  showControls.value = false
  setTimeout(() => {
    controlTransition.value = false
  }, 1000)
}

function handleEnter() {
  showControls.value = true
  controlTransition.value = true
}

onMounted(() => {
  initTheme()
  applyTheme()
  window.addEventListener('mouseup', handleMouseUp)
  window.addEventListener('mousemove', handleMouseMove)
})
</script>

<template>
  <div
    class="w-full h-screen overflow-hidden bg-surface1 relative"
    :class="isDark ? 'bg-dotted-grid-dark' : 'bg-dotted-grid-light'"
    @wheel="handleWheel"
    @mousedown="handleMouseDown"
    @contextmenu="handleContextMenu"
    @touchstart="handleTouchStart"
    @touchend="handleTouchEnd"
    @touchmove="handleTouchMove"
    :style="{ cursor: isDragging ? 'grabbing' : 'default' }"
  >
    <div class="absolute inset-0 origin-top-left" :style="{ transform: canvasTransform }">
      <div class="p-5">
        <div class="max-w-7xl">
          <h1 class="text-3xl font-bold text-text0 mb-4">Workspace</h1>
          <p class="text-text1 text-base">
            Right-click or long-press for options. Shift+Drag or Mouse wheel to navigate.
          </p>
        </div>
      </div>
    </div>

    <div class="absolute bottom-4 left-4 z-50">
      <div
        class="flex flex-col items-start"
        @mouseenter="handleEnter"
        @mouseleave="handleLeaveDelay"
      >
        <button
          v-if="!showControls && !controlTransition"
          class="w-12 h-12 text-text0 rounded-lg flex items-center justify-center transition-all duration-300 hover:bg-surface2 active:scale-95"
          title="Scan Search"
        >
          <ScanSearch :size="24" />
        </button>

        <transition name="fade">
          <button
            v-if="showControls"
            @click="zoomIn"
            class="w-12 h-12 text-text0 rounded-lg flex items-center justify-center transition-all duration-300 hover:bg-surface2 active:scale-95 mt-2"
            title="Zoom In"
          >
            <ZoomIn :size="24" />
          </button>
        </transition>

        <transition name="fade">
          <button
            v-if="showControls"
            @click="zoomOut"
            class="w-12 h-12 text-text0 rounded-lg flex items-center justify-center transition-all duration-300 hover:bg-surface2 active:scale-95 mt-2"
            title="Zoom Out"
          >
            <ZoomOut :size="24" />
          </button>
        </transition>

        <transition name="fade">
          <button
            v-if="showControls"
            @click="resetZoom"
            class="w-12 h-12 text-text0 rounded-lg flex items-center justify-center transition-all duration-300 hover:bg-surface2 active:scale-95 mt-2"
            title="Fullscreen"
          >
            <Fullscreen :size="24" />
          </button>
        </transition>
      </div>
    </div>

    <LTaskbar></LTaskbar>
    <LMenu></LMenu>
    <LContextMenu
      v-if="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :items="menuItems"
      @close="closeContextMenu"
    />
  </div>
</template>

<style scoped></style>
