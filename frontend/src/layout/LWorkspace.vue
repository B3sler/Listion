<script setup lang="ts">
import { ref, onMounted } from 'vue'
import LContextMenu from '@/components/LContextMenu.vue'
import { useTheme } from '@/composables/useTheme.ts'

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
const LONG_PRESS_DURATION = 500

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

const handleTouchStart = (event: TouchEvent) => {
  const touch = event.touches[0]
  if (!touch) return

  const x = touch.clientX
  const y = touch.clientY

  longPressTimer = window.setTimeout(() => {
    showContextMenu(x, y)
  }, LONG_PRESS_DURATION)
  event.preventDefault()
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

const { initTheme, applyTheme } = useTheme()

onMounted(() => {
  initTheme()
  applyTheme()
})
</script>

<template>
  <div
    class="w-full min-h-screen bg-surface1 p-5"
    @contextmenu="handleContextMenu"
    @touchstart="handleTouchStart"
    @touchend="handleTouchEnd"
    @touchmove="handleTouchMove"
  >
    <div class="max-w-7xl">
      <h1 class="text-3xl font-bold text-text0 mb-4">Workspace</h1>
      <p class="text-text1 text-base">Right-click or long-press for options</p>
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
