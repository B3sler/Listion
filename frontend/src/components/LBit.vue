<script setup lang="ts">
import { computed } from 'vue'
import { Trash2, Edit } from 'lucide-vue-next'
import type { Bit } from '@/types/bit'

interface Props {
  bit: Bit
}

const props = defineProps<Props>()
const emit = defineEmits<{
  delete: [id: number]
  edit: [bit: Bit]
  positionChange: [id: number, x: number, y: number]
}>()

const statusText = computed(() => {
  switch (props.bit.status) {
    case 0:
      return 'Open'
    case 1:
      return 'In Progress'
    case 2:
      return 'Done'
    default:
      return 'Unknown'
  }
})

const statusColor = computed(() => {
  switch (props.bit.status) {
    case 0:
      return 'bg-blue-500'
    case 1:
      return 'bg-yellow-500'
    case 2:
      return 'bg-green-500'
    default:
      return 'bg-gray-500'
  }
})

const priorityText = computed(() => {
  switch (props.bit.priority) {
    case 1:
      return 'Low'
    case 2:
      return 'Medium'
    case 3:
      return 'High'
    default:
      return ''
  }
})

const priorityColor = computed(() => {
  switch (props.bit.priority) {
    case 1:
      return 'text-green-400'
    case 2:
      return 'text-yellow-400'
    case 3:
      return 'text-red-400'
    default:
      return 'text-gray-400'
  }
})

const handleDelete = () => {
  emit('delete', props.bit.id)
}

const handleEdit = () => {
  emit('edit', props.bit)
}
</script>

<template>
  <div
    class="bg-surface2 border border-gray-600 rounded-lg p-4 shadow-lg min-w-[200px] max-w-[300px] cursor-move hover:shadow-xl transition-shadow"
    :style="{
      position: 'absolute',
      left: `${bit.x || 0}px`,
      top: `${bit.y || 0}px`,
    }"
  >
    <div class="flex items-start justify-between mb-2">
      <h3 class="text-text0 font-medium text-base flex-1 break-words">{{ bit.title }}</h3>
      <div class="flex gap-1 ml-2">
        <button
          @click.stop="handleEdit"
          class="text-text1 hover:text-blue-400 transition-colors p-1 rounded hover:bg-surface3"
          title="Edit"
        >
          <Edit :size="16" />
        </button>
        <button
          @click.stop="handleDelete"
          class="text-text1 hover:text-red-400 transition-colors p-1 rounded hover:bg-surface3"
          title="Delete"
        >
          <Trash2 :size="16" />
        </button>
      </div>
    </div>

    <div v-if="bit.notes" class="text-text1 text-sm mb-3 break-words">
      {{ bit.notes }}
    </div>

    <div class="flex items-center gap-2 flex-wrap">
      <span
        :class="`${statusColor} text-white text-xs px-2 py-1 rounded-full font-medium inline-block`"
      >
        {{ statusText }}
      </span>
      <span v-if="priorityText" :class="`${priorityColor} text-xs font-medium`">
        {{ priorityText }}
      </span>
    </div>
  </div>
</template>
