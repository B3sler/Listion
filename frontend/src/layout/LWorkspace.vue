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

const handleContextMenu = (event: MouseEvent) => {
  event.preventDefault()
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
  }
}

const closeContextMenu = () => {
  contextMenu.value.visible = false
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
  <div class="w-full min-h-screen bg-gray-50 p-5" @contextmenu="handleContextMenu">
    <div class="max-w-7xl ">
      <h1 class="text-3xl font-bold text-gray-900 mb-4">Workspace</h1>
      <p class="text-gray-500 text-base">Right-click for options</p>
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
