<script setup lang="ts">
import { ref } from 'vue'
import { X } from 'lucide-vue-next'
import type { CreateBitDto } from '@/types/bit'

interface Props {
  x?: number
  y?: number
  userId: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  create: [bit: CreateBitDto]
}>()

const title = ref('')
const notes = ref('')
const priority = ref<number | undefined>(undefined)
const status = ref(0)

const handleSubmit = () => {
  if (!title.value.trim()) {
    return
  }

  const createBitDto: CreateBitDto = {
    user: props.userId,
    title: title.value,
    status: status.value,
    notes: notes.value || undefined,
    priority: priority.value,
    x: props.x,
    y: props.y,
  }

  emit('create', createBitDto)
  emit('close')
}

const handleCancel = () => {
  emit('close')
}
</script>

<template>
  <div
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000]"
    @click.self="handleCancel"
  >
    <div class="bg-surface2 rounded-lg shadow-xl w-full max-w-md p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-semibold text-text0">Create New Bit</h2>
        <button
          @click="handleCancel"
          class="text-text1 hover:text-text0 transition-colors p-1 rounded hover:bg-surface3"
          title="Close"
        >
          <X :size="20" />
        </button>
      </div>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div>
          <label for="title" class="block text-sm font-medium text-text1 mb-1">
            Title <span class="text-red-500">*</span>
          </label>
          <input
            id="title"
            v-model="title"
            type="text"
            required
            placeholder="Enter task title"
            class="w-full px-3 py-2 bg-surface3 border border-gray-600 rounded-lg text-text0 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label for="notes" class="block text-sm font-medium text-text1 mb-1"> Notes </label>
          <textarea
            id="notes"
            v-model="notes"
            rows="3"
            placeholder="Add notes (optional)"
            class="w-full px-3 py-2 bg-surface3 border border-gray-600 rounded-lg text-text0 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          ></textarea>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="status" class="block text-sm font-medium text-text1 mb-1"> Status </label>
            <select
              id="status"
              v-model.number="status"
              class="w-full px-3 py-2 bg-surface3 border border-gray-600 rounded-lg text-text0 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option :value="0">Open</option>
              <option :value="1">In Progress</option>
              <option :value="2">Done</option>
            </select>
          </div>

          <div>
            <label for="priority" class="block text-sm font-medium text-text1 mb-1">
              Priority
            </label>
            <select
              id="priority"
              v-model.number="priority"
              class="w-full px-3 py-2 bg-surface3 border border-gray-600 rounded-lg text-text0 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option :value="undefined">None</option>
              <option :value="1">Low</option>
              <option :value="2">Medium</option>
              <option :value="3">High</option>
            </select>
          </div>
        </div>

        <div class="flex justify-end gap-3 mt-6">
          <button
            type="button"
            @click="handleCancel"
            class="px-4 py-2 text-sm font-medium text-text1 bg-surface3 rounded-lg hover:bg-surface4 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!title.trim()"
          >
            Create Bit
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
