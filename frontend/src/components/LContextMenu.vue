<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

type MenuItem = {
  label: string
  icon?: string
  action: () => void
}

type Props = {
  x: number
  y: number
  items: MenuItem[]
}

defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

const menuRef = ref<HTMLElement | null>(null)

const handleClickOutside = (event: MouseEvent) => {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

const handleItemClick = (action: () => void) => {
  action()
  emit('close')
}
</script>

<template>
  <div
    ref="menuRef"
    class="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-[1000] min-w-[200px] "
    :style="{ left: `${x}px`, top: `${y}px` }"
  >
    <ul class="list-none m-0 p-0 divide-y divide-gray-100 ">
      <li
        v-for="(item, index) in items"
        :key="index"
        class="flex items-center px-2 py-1 cursor-pointer transition-colors duration-200 hover:bg-gray-100 select-none "
        @click="handleItemClick(item.action)"
      >
        <span v-if="item.icon" class="mr-3 text-lg ">{{ item.icon }}</span>
        <span class="text-sm text-gray-700">{{ item.label }}</span>
      </li>
    </ul>
  </div>
</template>
