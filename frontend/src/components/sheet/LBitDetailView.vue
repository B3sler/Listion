<script setup lang="ts">
import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  toRef,
  useTemplateRef,
  watch,
} from 'vue'
import { ChevronLeft, X } from 'lucide-vue-next'
import type { NodeRef } from '@/types/flow'
import { BIT_COMMANDS } from '@/composables/useBitCommands'
import { useBitEditor } from '@/composables/useBitEditor'
import { useToday } from '@/composables/useToday'
import { useSheetStore } from '@/stores/sheetStore'
import { DEFAULT_COLOR } from '@/helpers/palette'
import LSegmented from './LSegmented.vue'
import LHoldToComplete from './LHoldToComplete.vue'
import LFocusSection from './LFocusSection.vue'
import LDependencyList from './LDependencyList.vue'
import LDetailChips from './LDetailChips.vue'
import LDetailFooter from './LDetailFooter.vue'

interface Props {
  bitId: string
  canGoBack: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  back: []
  close: []
  'open-bit': [id: string]
  'focus-node': [ref: NodeRef]
}>()

const injected = inject(BIT_COMMANDS)
if (!injected) throw new Error('LBitDetailView needs BIT_COMMANDS to be provided')
const commands = injected

const editor = useBitEditor(toRef(props, 'bitId'))
const { bit, title, notes, saveState, shake } = editor
const today = useToday()
const sheet = useSheetStore()

const accent = computed(() => bit.value?.color ?? DEFAULT_COLOR)
const done = computed(() => bit.value?.status === 2)

// ── Title and notes ──────────────────────────────────────────────────
const titleEl = useTemplateRef<HTMLTextAreaElement>('titleEl')
const notesEl = useTemplateRef<HTMLTextAreaElement>('notesEl')

/** Grows the field with its content; the notes cap (12 lines) comes from CSS max-height. */
function fit(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

function onTitleInput(event: Event) {
  const el = event.target as HTMLTextAreaElement
  // a title is one line, even when pasted with line breaks
  const value = el.value.replace(/\s*[\r\n]+\s*/g, ' ')
  editor.onTitleInput(value)
  fit(el)
}

function onTitleKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.isComposing) return
  event.preventDefault()
  notesEl.value?.focus()
}

function onNotesInput(event: Event) {
  const el = event.target as HTMLTextAreaElement
  editor.onNotesInput(el.value)
  fit(el)
}

function focusTitle() {
  const el = titleEl.value
  if (!el) return
  el.focus({ preventScroll: true })
  const end = el.value.length
  el.setSelectionRange(end, end)
}

watch([title, notes], async () => {
  await nextTick()
  fit(titleEl.value)
  fit(notesEl.value)
})

onMounted(async () => {
  await nextTick()
  fit(titleEl.value)
  fit(notesEl.value)
  focusTitle()
})

// ── Chips ────────────────────────────────────────────────────────────
const chipsRef = useTemplateRef<InstanceType<typeof LDetailChips>>('chipsRef')

/** For the sheet's Esc: closes an open picker and reports whether there was one. */
function closeOpenChip(): boolean {
  return chipsRef.value?.closeOpenChip() ?? false
}

defineExpose({ closeOpenChip })

// another bit: the cursor goes to its title (the chips close their picker themselves)
watch(
  () => props.bitId,
  async () => {
    await nextTick()
    focusTitle()
  },
)

// ── Status, completion, delete ───────────────────────────────────────
const STATUS_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Open' },
  { value: 1, label: 'In Progress' },
  { value: 2, label: 'Done' },
]

function report(e: unknown) {
  console.error('Failed to update bit status', e)
}

/** What "Couldn't save · Retry" repeats when completing or reopening failed. */
const retryStatus = ref<(() => void) | null>(null)
/** Ticking off by the gesture closes the sheet this long after the check has landed. */
const CLOSE_AFTER_COMPLETE_MS = 350
let closeTimer: ReturnType<typeof setTimeout> | null = null

function cancelClose() {
  if (closeTimer) clearTimeout(closeTimer)
  closeTimer = null
}

function complete(again: () => void = complete) {
  retryStatus.value = null
  commands.complete(props.bitId).catch((e: unknown) => {
    report(e)
    cancelClose()
    retryStatus.value = again
  })
}

/** The held ◯: complete, let the capsule on the canvas settle, then close the sheet. */
function completeByGesture() {
  complete(completeByGesture)
  sheet.requestSettle(props.bitId)
  cancelClose()
  closeTimer = setTimeout(() => {
    closeTimer = null
    emit('close')
  }, CLOSE_AFTER_COMPLETE_MS)
}

function reopen() {
  retryStatus.value = null
  commands.reopen(props.bitId).catch((e: unknown) => {
    report(e)
    retryStatus.value = reopen
  })
}

/** Footer retry: repeats a failed status change, and what the editor could not save. */
function retry() {
  const again = retryStatus.value
  retryStatus.value = null
  again?.()
  if (saveState.value === 'error') void editor.retry()
}

onBeforeUnmount(cancelClose)

// leaving the sheet (or this bit) ends the hover: no mouseleave reaches a removed row
onBeforeUnmount(() => {
  sheet.hoverDependencyId = null
})

async function setStatus(value: number) {
  const b = bit.value
  if (!b || value === b.status) return
  if (value === 2) return complete()
  if (b.status === 2) {
    // leaving Done is one step, also straight to In Progress (one undo restores Done)
    try {
      await commands.reopen(b.id, value === 1 ? 1 : 0)
    } catch (e) {
      report(e)
    }
    return
  }
  await editor.set({ status: value }, 'Status')
}

function remove() {
  void editor.flush()
  commands.remove(props.bitId)
  emit('close')
}
</script>

<template>
  <section v-if="bit" class="detail" :style="{ '--c': accent }">
    <header class="detail__header">
      <button v-if="canGoBack" type="button" class="detail__back pressable" @click="emit('back')">
        <ChevronLeft :size="16" aria-hidden="true" />
        New Bits
      </button>
      <span v-else />
      <button
        type="button"
        class="detail__close pressable"
        aria-label="Close"
        @click="emit('close')"
      >
        <X :size="14" aria-hidden="true" />
      </button>
    </header>

    <div class="detail__body">
      <div class="detail__head">
        <LHoldToComplete
          :done="done"
          :color="accent"
          @complete="completeByGesture"
          @reopen="reopen"
        />
        <textarea
          ref="titleEl"
          class="detail__title"
          :class="{ 'detail__title--shake': shake }"
          :value="title"
          rows="1"
          maxlength="500"
          placeholder="Title"
          aria-label="Title"
          spellcheck="true"
          @input="onTitleInput"
          @keydown="onTitleKeydown"
          @blur="editor.onTextBlur()"
        />
      </div>

      <!-- ariaLabel in camelCase: vue-tsc does not map aria-label onto a generic component's prop -->
      <LSegmented
        :model-value="bit.status"
        :options="STATUS_OPTIONS"
        ariaLabel="Status"
        @update:model-value="setStatus"
      />

      <LDetailChips
        ref="chipsRef"
        :bit="bit"
        :today="today"
        :accent="accent"
        @set="(patch, label) => void editor.set(patch, label)"
      />

      <textarea
        ref="notesEl"
        class="detail__notes"
        :value="notes"
        rows="2"
        maxlength="10000"
        placeholder="Notes"
        aria-label="Notes"
        @input="onNotesInput"
        @blur="editor.onTextBlur()"
      />

      <slot name="focus" :bit="bit"><LFocusSection :bit="bit" /></slot>
      <slot name="dependencies" :bit="bit">
        <LDependencyList
          :bit-id="bit.id"
          @navigate="(target) => emit('focus-node', target)"
          @hover="(depId) => (sheet.hoverDependencyId = depId)"
        />
      </slot>
    </div>

    <LDetailFooter
      :created-at="bit.createdAt"
      :save-state="saveState"
      :failed="!!retryStatus"
      @retry="retry"
      @delete="remove"
    />
  </section>
</template>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

/* ── Header ─────────────────────────────────────────────────────────── */
.detail__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: none;
  padding: 14px 14px 4px 10px;
}

.detail__back {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 28px;
  padding: 0 10px 0 4px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--brand);
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 550;
  letter-spacing: -0.005em;
  cursor: pointer;
  outline: none;
}
.detail__back:hover {
  background-color: var(--fill-hover);
}

.detail__close {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background-color: var(--fill-hover);
  color: var(--text2);
  cursor: pointer;
  outline: none;
}
.detail__close:hover {
  background-color: var(--fill-press);
  color: var(--text0);
}

/* ── Body ───────────────────────────────────────────────────────────── */
.detail__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  flex: 1;
  min-height: 0;
  padding: 6px 16px 16px;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--surface3) transparent;
  /* scroll edge effect instead of hard dividers */
  mask-image: linear-gradient(
    to bottom,
    transparent 0,
    #000 8px,
    #000 calc(100% - 14px),
    transparent 100%
  );
}

/* the body scrolls instead of squashing content: no child (notes, chips, …) may shrink */
.detail__body > :deep(*) {
  flex-shrink: 0;
}

.detail__head {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.detail__title {
  flex: 1;
  min-width: 0;
  margin: 0;
  padding: 2px 4px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text0);
  font-family: inherit;
  font-size: 1.25rem;
  font-weight: 650;
  line-height: 1.25;
  letter-spacing: -0.015em;
  resize: none;
  overflow: hidden;
  outline: none;
  transition: box-shadow 0.3s ease;
}
.detail__title::placeholder,
.detail__notes::placeholder {
  color: var(--text2);
  opacity: 0.6;
}

/* empty title rejected: shake 3 × 4 px in 240 ms */
.detail__title--shake {
  animation: shake 240ms linear;
}
@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  16.6%,
  50%,
  83.3% {
    transform: translateX(-4px);
  }
  33.3%,
  66.6% {
    transform: translateX(4px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .detail__title--shake {
    animation: none;
    box-shadow: inset 0 0 0 1.5px hsl(0 72% 52%);
    transition: none;
  }
}

/* ── Notes ──────────────────────────────────────────────────────────── */
.detail__notes {
  margin: 0;
  padding: 4px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text1);
  font-family: inherit;
  font-size: 0.9375rem;
  line-height: 1.5;
  letter-spacing: -0.005em;
  resize: none;
  outline: none;
  /* grows to 12 lines, then scrolls */
  max-height: calc(12 * 1.5em + 8px);
  overflow-y: auto;
}

/* ── Focus rings ────────────────────────────────────────────────────── */
.detail__back:focus-visible,
.detail__close:focus-visible {
  box-shadow: 0 0 0 2px var(--brand);
}
.detail__title:focus-visible,
.detail__notes:focus-visible {
  box-shadow: inset 0 0 0 1px var(--material-stroke);
}
</style>
