<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { X, Zap, Pencil, Trash2 } from 'lucide-vue-next'
import type { Bit } from '@/stores/bitStore'

const props = defineProps<{
  mode: 'create' | 'edit'
  bit?: Bit
}>()

const emit = defineEmits<{
  confirm: [
    data: {
      title: string
      status: number
      priority: number | undefined
      dueDate: string | undefined
      notes: string | undefined
      color: string
    },
  ]
  cancel: []
  delete: []
}>()

const DEFAULT_COLOR = '#6366f1'

const BIT_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#f43f5e', // Rose
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#eab308', // Yellow
  '#84cc16', // Lime
  '#22c55e', // Green
  '#10b981', // Emerald
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#64748b', // Slate
] as const

const title = ref('')
const status = ref<0 | 1 | 2>(0)
const priority = ref<'' | '1' | '2' | '3'>('')
const dueDate = ref('')
const notes = ref('')
const color = ref(DEFAULT_COLOR)
const titleInput = ref<HTMLInputElement | null>(null)

watch(
  () => [props.mode, props.bit] as const,
  ([mode, b]) => {
    if (mode === 'edit' && b) {
      title.value = b.title
      status.value = (b.status ?? 0) as 0 | 1 | 2
      priority.value = b.priority ? (String(b.priority) as '1' | '2' | '3') : ''
      dueDate.value = b.dueDate ? (new Date(b.dueDate).toISOString().split('T')[0] ?? '') : ''
      notes.value = b.notes ?? ''
      color.value = b.color ?? DEFAULT_COLOR
    } else {
      title.value = ''
      status.value = 0
      priority.value = ''
      dueDate.value = ''
      notes.value = ''
      color.value = DEFAULT_COLOR
    }
  },
  { immediate: true },
)

onMounted(() => {
  setTimeout(() => titleInput.value?.focus(), 80)
  document.addEventListener('keydown', onKeydown)
})
onUnmounted(() => document.removeEventListener('keydown', onKeydown))

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') emit('cancel')
}

function submit() {
  const t = title.value.trim()
  if (!t) return
  emit('confirm', {
    title: t,
    status: status.value,
    priority: priority.value ? Number(priority.value) : undefined,
    dueDate: dueDate.value || undefined,
    notes: notes.value.trim() || undefined,
    color: color.value,
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
  0: 'rgba(148,163,184,0.75)',
  1: '#fbbf24',
  2: '#34d399',
}
</script>

<template>
  <div class="panel">
    <!-- header -->
    <div class="panel__header">
      <div class="panel__header-left">
        <div class="panel__icon-wrap">
          <component :is="mode === 'create' ? Zap : Pencil" :size="14" />
        </div>
        <span class="panel__heading">{{ mode === 'create' ? 'New Bit' : 'Bit Details' }}</span>
      </div>
      <button class="panel__close" @click="emit('cancel')">
        <X :size="14" />
      </button>
    </div>

    <!-- body -->
    <div class="panel__body">
      <form @submit.prevent="submit" id="bit-panel-form">
        <!-- title -->
        <div class="field field--1">
          <label class="field__label">Title</label>
          <div class="field__box">
            <input
              ref="titleInput"
              v-model="title"
              type="text"
              placeholder="What needs to be done?"
              maxlength="120"
              class="field__input"
              required
            />
          </div>
        </div>

        <!-- color picker -->
        <div class="field field--2">
          <label class="field__label">Color</label>
          <div class="color-picker">
            <button
              v-for="c in BIT_COLORS"
              :key="c"
              type="button"
              class="color-swatch"
              :class="{ 'color-swatch--active': color === c }"
              :style="{ background: c }"
              :title="c"
              @click="color = c"
            />
          </div>
        </div>

        <!-- status + priority row -->
        <div class="field-row">
          <div class="field field--3">
            <label class="field__label">Status</label>
            <div class="field__box field__box--select">
              <span class="field__dot" :style="{ background: STATUS_COLOURS[status] }" />
              <select
                v-model="status"
                class="field__input field__input--select field__input--dotted"
              >
                <option v-for="o in STATUS_OPTIONS" :key="o.value" :value="o.value">
                  {{ o.label }}
                </option>
              </select>
            </div>
          </div>
          <div class="field field--4">
            <label class="field__label">Priority</label>
            <div class="field__box field__box--select">
              <select v-model="priority" class="field__input field__input--select">
                <option value="">None</option>
                <option v-for="o in PRIORITY_OPTIONS" :key="o.value" :value="o.value">
                  {{ o.label }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <!-- due date -->
        <div class="field field--5">
          <label class="field__label">Due Date</label>
          <div class="field__box">
            <input v-model="dueDate" type="date" class="field__input field__input--date" />
          </div>
        </div>

        <!-- notes -->
        <div class="field field--6">
          <label class="field__label">Notes</label>
          <div class="field__box">
            <textarea
              v-model="notes"
              rows="4"
              placeholder="Optional notes…"
              class="field__input field__input--textarea"
            />
          </div>
        </div>
      </form>
    </div>

    <!-- footer -->
    <div class="panel__footer">
      <button v-if="mode === 'edit'" type="button" class="btn btn--danger" @click="emit('delete')">
        <Trash2 :size="13" />
        Delete
      </button>
      <div v-else />
      <div class="panel__actions">
        <button type="button" class="btn" @click="emit('cancel')">Cancel</button>
        <button
          type="submit"
          form="bit-panel-form"
          class="btn btn--primary"
          :disabled="!title.trim()"
        >
          {{ mode === 'create' ? 'Create' : 'Save' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ─────────────────────────────────────────
   Panel shell
───────────────────────────────────────── */
.panel {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 300px;
  z-index: 100;
  background-color: var(--surface2);
  border-right: 1px solid var(--surface3);
  border-radius: 0 20px 20px 0;
  box-shadow:
    4px 0 6px -1px hsl(var(--surface-shadow) / calc(var(--shadow-strength) + 0.05)),
    10px 0 24px -4px hsl(var(--surface-shadow) / var(--shadow-strength));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: panel-enter 0.28s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes panel-enter {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* ─────────────────────────────────────────
   Header
───────────────────────────────────────── */
.panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 13px;
  border-bottom: 1px solid var(--surface3);
  flex-shrink: 0;
  animation: fade-in 0.22s ease 0.05s both;
}

.panel__header-left {
  display: flex;
  align-items: center;
  gap: 9px;
}

.panel__icon-wrap {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  background-color: var(--surface3);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--brand);
  flex-shrink: 0;
}

.panel__heading {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text0);
  letter-spacing: -0.01em;
}

.panel__close {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text2);
  background: transparent;
  border: none;
  cursor: pointer;
  transition:
    background-color 0.15s,
    color 0.15s;
}
.panel__close:hover {
  background-color: var(--surface3);
  color: var(--text0);
}

/* ─────────────────────────────────────────
   Body
───────────────────────────────────────── */
.panel__body {
  flex: 1;
  overflow-y: auto;
  padding: 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  scrollbar-width: thin;
  scrollbar-color: var(--surface3) transparent;
}

/* ─────────────────────────────────────────
   Field
───────────────────────────────────────── */
.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  opacity: 0;
  animation: field-rise 0.22s ease forwards;
}
.field--1 {
  animation-delay: 0.08s;
}
.field--2 {
  animation-delay: 0.12s;
}
.field--3 {
  animation-delay: 0.16s;
}
.field--4 {
  animation-delay: 0.16s;
}
.field--5 {
  animation-delay: 0.2s;
}
.field--6 {
  animation-delay: 0.24s;
}

/* two-column grid for status + priority */
.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.field__label {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text2);
  padding-left: 2px;
}

.field__box {
  background-color: var(--surface3);
  border-radius: 9px;
  border: 1.5px solid transparent;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
  overflow: hidden;
}
.field__box:has(:focus) {
  border-color: var(--brand);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 18%, transparent);
}

.field__box--select {
  position: relative;
}

.field__input {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  padding: 8px 10px;
  font-size: 0.875rem;
  color: var(--text0);
  appearance: none;
  -webkit-appearance: none;
}
.field__input::placeholder {
  color: var(--text2);
}

.field__input--select {
  cursor: pointer;
  padding-right: 26px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%236c7086' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
}

.field__input--dotted {
  padding-left: 24px;
}

.field__dot {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  width: 7px;
  height: 7px;
  border-radius: 50%;
  pointer-events: none;
}

.field__input--textarea {
  resize: none;
  line-height: 1.55;
}

.field__input--date {
  color-scheme: dark;
}
.field__input--date::-webkit-calendar-picker-indicator {
  filter: invert(0.5);
  cursor: pointer;
  padding: 0;
  margin: 0;
}

/* ─────────────────────────────────────────
   Color Picker
───────────────────────────────────────── */
.color-picker {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 6px;
  padding: 10px;
  background-color: var(--surface3);
  border-radius: 9px;
}

.color-swatch {
  aspect-ratio: 1;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition:
    transform 0.12s ease,
    box-shadow 0.12s ease,
    border-color 0.12s ease;
  padding: 0;
  outline: none;
}
.color-swatch:hover {
  transform: scale(1.2);
}
.color-swatch--active {
  border-color: rgba(255, 255, 255, 0.9);
  transform: scale(1.15);
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.25);
}

/* ─────────────────────────────────────────
   Footer
───────────────────────────────────────── */
.panel__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-top: 1px solid var(--surface3);
  flex-shrink: 0;
  animation: fade-in 0.22s ease 0.14s both;
}

.panel__actions {
  display: flex;
  gap: 4px;
}

/* ─────────────────────────────────────────
   Buttons
───────────────────────────────────────── */
.btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 11px;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text1);
  background: transparent;
  border: none;
  cursor: pointer;
  transition:
    background-color 0.15s,
    color 0.15s;
}
.btn:hover {
  background-color: var(--surface3);
  color: var(--text0);
}

.btn--primary {
  background-color: var(--brand);
  color: hsl(0 0% 100%);
}
.btn--primary:hover:not(:disabled) {
  background-color: var(--brand);
  filter: brightness(1.12);
}
.btn--primary:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.btn--danger:hover {
  color: hsl(0 72% 65%);
}

/* ─────────────────────────────────────────
   Animations
───────────────────────────────────────── */
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes field-rise {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
