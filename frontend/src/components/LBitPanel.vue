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
  titleInput.value?.focus({ preventScroll: true })
  document.addEventListener('keydown', onKeydown)
})
onUnmounted(() => document.removeEventListener('keydown', onKeydown))

const onKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape') emit('cancel')
}

// Deleting is irreversible: ask once, inline, instead of a modal dialog
const confirmingDelete = ref(false)
let confirmTimer: ReturnType<typeof setTimeout> | null = null

function onDeleteClick() {
  if (confirmingDelete.value) {
    emit('delete')
    return
  }
  confirmingDelete.value = true
  if (confirmTimer) clearTimeout(confirmTimer)
  confirmTimer = setTimeout(() => (confirmingDelete.value = false), 3000)
}
onUnmounted(() => {
  if (confirmTimer) clearTimeout(confirmTimer)
})

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
  <div
    class="panel material--thick"
    role="dialog"
    :aria-label="mode === 'create' ? 'New Bit' : 'Bit Details'"
  >
    <!-- header -->
    <div class="panel__header">
      <div class="panel__header-left">
        <div class="panel__icon-wrap">
          <component :is="mode === 'create' ? Zap : Pencil" :size="14" />
        </div>
        <span class="panel__heading">{{ mode === 'create' ? 'New Bit' : 'Bit Details' }}</span>
      </div>
      <button class="panel__close pressable" aria-label="Close" @click="emit('cancel')">
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
              :style="{ background: c, color: c }"
              :title="c"
              :aria-label="`Color ${c}`"
              :aria-pressed="color === c"
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
      <button
        v-if="mode === 'edit'"
        type="button"
        class="btn btn--danger pressable"
        :class="{ 'btn--danger-confirm': confirmingDelete }"
        @click="onDeleteClick"
      >
        <Trash2 :size="13" />
        {{ confirmingDelete ? 'Delete Bit?' : 'Delete' }}
      </button>
      <div v-else />
      <div class="panel__actions">
        <button type="button" class="btn pressable" @click="emit('cancel')">Cancel</button>
        <button
          type="submit"
          form="bit-panel-form"
          class="btn btn--primary pressable"
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
   Panel shell — a thick material sheet; enter/leave is driven by
   the <Transition name="sheet"> in LWorkspace (same path both ways)
───────────────────────────────────────── */
.panel {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 300px;
  z-index: 100;
  border: 1px solid var(--material-stroke);
  border-left: none;
  border-radius: 0 22px 22px 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  will-change: transform;
}

/* ─────────────────────────────────────────
   Header
───────────────────────────────────────── */
.panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 12px;
  flex-shrink: 0;
}

.panel__header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.panel__icon-wrap {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background-color: color-mix(in srgb, var(--brand) 14%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--brand);
  flex-shrink: 0;
}

.panel__heading {
  font-size: 1.0625rem;
  font-weight: 650;
  color: var(--text0);
  letter-spacing: -0.015em;
}

.panel__close {
  width: 28px;
  height: 28px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text2);
  background-color: var(--fill-hover);
  border: none;
  cursor: pointer;
}
.panel__close:hover {
  background-color: var(--fill-press);
  color: var(--text0);
}

/* ─────────────────────────────────────────
   Body
───────────────────────────────────────── */
.panel__body {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 4px 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  scrollbar-width: thin;
  scrollbar-color: var(--surface3) transparent;
  /* scroll edge effect instead of hard dividers */
  mask-image: linear-gradient(
    to bottom,
    transparent 0,
    #000 10px,
    #000 calc(100% - 14px),
    transparent 100%
  );
}

#bit-panel-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ─────────────────────────────────────────
   Field
───────────────────────────────────────── */
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* two-column grid for status + priority */
.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.field__label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.005em;
  color: var(--text2);
  padding-left: 4px;
}

.field__box {
  background-color: var(--fill-hover);
  border-radius: 10px;
  border: 1px solid var(--material-stroke);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    background-color 0.15s ease;
  overflow: hidden;
}
.field__box:hover {
  background-color: var(--fill-press);
}
.field__box:has(:focus) {
  border-color: var(--brand);
  background-color: var(--surface1);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--brand) 16%, transparent);
}

.field__box--select {
  position: relative;
}

.field__input {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  padding: 9px 11px;
  font-size: 0.9375rem;
  letter-spacing: -0.005em;
  color: var(--text0);
  appearance: none;
  -webkit-appearance: none;
}
.field__input::placeholder {
  color: var(--text2);
  opacity: 0.7;
}

.field__input--select {
  cursor: pointer;
  padding-right: 26px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%236c7086' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 9px center;
}

.field__input--dotted {
  padding-left: 25px;
}

.field__dot {
  position: absolute;
  left: 11px;
  top: 50%;
  transform: translateY(-50%);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  pointer-events: none;
  transition: background-color 0.2s ease;
}

.field__input--textarea {
  resize: none;
  line-height: 1.5;
}

.field__input--date {
  color-scheme: light;
}
:global(.theme-dark) .field__input--date {
  color-scheme: dark;
}
.field__input--date::-webkit-calendar-picker-indicator {
  opacity: 0.55;
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
  gap: 8px;
  padding: 12px;
  background-color: var(--fill-hover);
  border: 1px solid var(--material-stroke);
  border-radius: 12px;
}

.color-swatch {
  aspect-ratio: 1;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  padding: 0;
  outline: none;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.12);
  transition:
    transform var(--spring-duration) var(--ease-spring),
    box-shadow 0.2s ease;
}
.color-swatch:hover {
  transform: scale(1.12);
}
.color-swatch:active {
  transform: scale(0.9);
  transition-duration: var(--press-duration);
}
/* selection ring sits outside the swatch, like the system colour well */
.color-swatch--active {
  box-shadow:
    0 0 0 2px var(--surface1),
    0 0 0 4px currentColor;
}
.color-swatch:focus-visible {
  box-shadow:
    0 0 0 2px var(--surface1),
    0 0 0 4px var(--brand);
}

/* ─────────────────────────────────────────
   Footer
───────────────────────────────────────── */
.panel__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px 14px;
  flex-shrink: 0;
}

.panel__actions {
  display: flex;
  gap: 6px;
}

/* ─────────────────────────────────────────
   Buttons
───────────────────────────────────────── */
.btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 550;
  letter-spacing: -0.005em;
  color: var(--text1);
  background: transparent;
  border: none;
  cursor: pointer;
}
.btn:hover {
  background-color: var(--fill-hover);
  color: var(--text0);
}

.btn--primary {
  background-color: var(--brand);
  color: hsl(0 0% 100%);
  font-weight: 600;
  padding: 8px 18px;
}
.btn--primary:hover:not(:disabled) {
  background-color: var(--brand);
  filter: brightness(1.1);
  color: hsl(0 0% 100%);
}
.btn--primary:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.btn--danger {
  color: hsl(0 72% 52%);
  padding-left: 10px;
}
.btn--danger:hover {
  color: hsl(0 72% 50%);
  background-color: hsl(0 72% 50% / 0.1);
}
.btn--danger-confirm,
.btn--danger-confirm:hover {
  color: hsl(0 0% 100%);
  background-color: hsl(0 72% 52%);
}
</style>
