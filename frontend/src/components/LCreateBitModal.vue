<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { X, Zap } from 'lucide-vue-next'

const emit = defineEmits<{
  confirm: [
    data: {
      title: string
      status: number
      priority: number | undefined
      dueDate: string | undefined
      notes: string | undefined
    },
  ]
  cancel: []
}>()

const title = ref('')
const status = ref<0 | 1 | 2>(0)
const priority = ref<'' | '1' | '2' | '3'>('')
const dueDate = ref('')
const notes = ref('')
const titleInput = ref<HTMLInputElement | null>(null)

onMounted(() => titleInput.value?.focus())

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') emit('cancel')
}
onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))

function submit() {
  const t = title.value.trim()
  if (!t) return
  emit('confirm', {
    title: t,
    status: status.value,
    priority: priority.value ? Number(priority.value) : undefined,
    dueDate: dueDate.value || undefined,
    notes: notes.value.trim() || undefined,
  })
}

const STATUS_OPTIONS = [
  { value: 0, label: 'Open' },
  { value: 1, label: 'In Progress' },
  { value: 2, label: 'Done' },
] as const

const PRIORITY_OPTIONS = [
  { value: '1', label: 'Low' },
  { value: '2', label: 'Medium' },
  { value: '3', label: 'High' },
] as const

const STATUS_COLOURS: Record<number, string> = {
  0: '#818cf8',
  1: '#fbbf24',
  2: '#34d399',
}
</script>

<template>
  <Transition name="modal-fade" appear>
    <!-- backdrop -->
    <div
      class="fixed inset-0 z-[2000] flex items-center justify-center"
      style="background: rgba(0, 0, 0, 0.55); backdrop-filter: blur(4px)"
      @click.self="emit('cancel')"
    >
      <!-- panel -->
      <div
        class="relative w-full max-w-md rounded-2xl border border-surface3/60 bg-surface1 shadow-[0_24px_64px_-12px_rgba(0,0,0,0.6)]"
        style="padding: 28px 28px 24px"
      >
        <!-- header -->
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-2.5">
            <Zap :size="18" class="text-indigo-400" />
            <span class="text-text0 font-semibold text-base tracking-wide">New Bit</span>
          </div>
          <button
            @click="emit('cancel')"
            class="w-7 h-7 rounded-lg flex items-center justify-center text-text2 hover:bg-surface2 hover:text-text0 transition-colors"
          >
            <X :size="15" />
          </button>
        </div>

        <form @submit.prevent="submit" class="flex flex-col gap-4">
          <!-- title -->
          <div class="field">
            <label class="field-label">Title <span class="text-red-400">*</span></label>
            <input
              ref="titleInput"
              v-model="title"
              type="text"
              placeholder="What needs to be done?"
              maxlength="120"
              class="field-input"
              required
            />
          </div>

          <!-- status + priority row -->
          <div class="flex gap-3">
            <div class="field flex-1">
              <label class="field-label">Status</label>
              <div class="relative">
                <span
                  class="absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
                  :style="{ background: STATUS_COLOURS[status] }"
                />
                <select v-model="status" class="field-input pl-7">
                  <option v-for="o in STATUS_OPTIONS" :key="o.value" :value="o.value">
                    {{ o.label }}
                  </option>
                </select>
              </div>
            </div>

            <div class="field flex-1">
              <label class="field-label">Priority</label>
              <select v-model="priority" class="field-input">
                <option value="">— none —</option>
                <option v-for="o in PRIORITY_OPTIONS" :key="o.value" :value="o.value">
                  {{ o.label }}
                </option>
              </select>
            </div>
          </div>

          <!-- due date -->
          <div class="field">
            <label class="field-label">Due Date</label>
            <input v-model="dueDate" type="date" class="field-input" />
          </div>

          <!-- notes -->
          <div class="field">
            <label class="field-label">Notes</label>
            <textarea
              v-model="notes"
              rows="3"
              placeholder="Optional notes…"
              class="field-input resize-none"
            />
          </div>

          <!-- actions -->
          <div class="flex justify-end gap-2 mt-2">
            <button type="button" class="btn-ghost" @click="emit('cancel')">Cancel</button>
            <button type="submit" class="btn-primary" :disabled="!title.trim()">Create Bit</button>
          </div>
        </form>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* ── fields ── */
.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.field-label {
  font-size: 11.5px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text2, #94a3b8);
}

.field-input {
  width: 100%;
  background: var(--color-surface2, #1e1e2e);
  border: 1px solid var(--color-surface3, #313244);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13.5px;
  color: var(--color-text0, #cdd6f4);
  outline: none;
  transition: border-color 0.15s ease;
  appearance: none;
  -webkit-appearance: none;
}
.field-input:focus {
  border-color: #818cf8;
}
.field-input::placeholder {
  color: var(--color-text2, #6c7086);
}

/* date picker icon colour */
.field-input[type='date']::-webkit-calendar-picker-indicator {
  filter: invert(0.6);
  cursor: pointer;
}

/* select arrow */
select.field-input {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236c7086' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 30px;
}

/* ── buttons ── */
.btn-ghost {
  padding: 7px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text1, #a6adc8);
  background: transparent;
  border: 1px solid var(--color-surface3, #313244);
  cursor: pointer;
  transition:
    background 0.15s,
    color 0.15s;
}
.btn-ghost:hover {
  background: var(--color-surface2, #1e1e2e);
  color: var(--color-text0, #cdd6f4);
}

.btn-primary {
  padding: 7px 20px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  background: #6366f1;
  border: none;
  cursor: pointer;
  transition:
    background 0.15s,
    opacity 0.15s;
}
.btn-primary:hover:not(:disabled) {
  background: #818cf8;
}
.btn-primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ── transition ── */
.modal-fade-enter-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}
.modal-fade-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
  transform: scale(0.96) translateY(6px);
}
</style>
