<script setup lang="ts">
import { ref } from 'vue'
import LContextMenu from '@/components/LContextMenu.vue'

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

let longPressTimer: number | null = null
const LONG_PRESS_DURATION = 500 // 500ms for long press

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

// Touch event handlers for long press
const handleTouchStart = (event: TouchEvent) => {
  const touch = event.touches[0]
  if (!touch) return

  const x = touch.clientX
  const y = touch.clientY

  longPressTimer = window.setTimeout(() => {
    showContextMenu(x, y)
  }, LONG_PRESS_DURATION)

  // Prevent default context menu on touch devices
  event.preventDefault()
}

const handleTouchEnd = () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

const handleTouchMove = () => {
  // Cancel long press if user moves finger
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
</script>

<template>
  <div
    class="w-full min-h-screen bg-gray-50 p-5"
    @contextmenu="handleContextMenu"
    @touchstart="handleTouchStart"
    @touchend="handleTouchEnd"
    @touchmove="handleTouchMove"
  >
    <div class="max-w-7xl ">
      <h1 class="text-3xl font-bold text-gray-900 mb-4">Workspace</h1>
      <p class="text-gray-500 text-base">Right-click or long-press for options</p>
    </div>

    <LContextMenu
      v-if="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :items="menuItems"
      @close="closeContextMenu"
    />
  </div>
</template>
