<script setup lang="ts">
import { computed, inject, onMounted, ref, useTemplateRef } from 'vue'
import { CircleAlert, CircleCheck, Circle, X } from 'lucide-vue-next'
import { BIT_COMMANDS, type CreateFields } from '@/composables/useBitCommands'
import { CAPSULE_H, CAPSULE_W } from '@/composables/useFlowLayout'
import { useBitStore } from '@/stores/bitStore'
import { useSheetStore } from '@/stores/sheetStore'
import { DEFAULT_COLOR } from '@/helpers/palette'
import { uuidv7 } from '@/helpers/uuid'

const emit = defineEmits<{ close: [] }>()

const injected = inject(BIT_COMMANDS)
if (!injected) throw new Error('LCaptureView needs BIT_COMMANDS to be provided')
const commands = injected

const sheet = useSheetStore()
const bitStore = useBitStore()

const text = ref('')
const inputEl = useTemplateRef<HTMLInputElement>('inputEl')

/** The series as shown: live titles from the store; a deleted bit drops out. */
const rows = computed(() =>
  sheet.series.flatMap((entry) => {
    if (entry.failed) return [{ entry, title: entry.fields?.title ?? '', done: false }]
    const bit = bitStore.bits.find((b) => b.id === entry.id)
    return bit ? [{ entry, title: bit.title, done: bit.status === 2 }] : []
  }),
)

async function submit(openDetail: boolean) {
  const title = text.value.trim()
  if (!title) return
  const fields: CreateFields = { title, color: DEFAULT_COLOR }
  // centred on the click point, like a bit placed by hand
  const pos = { x: sheet.origin.x - CAPSULE_W / 2, y: sheet.origin.y - CAPSULE_H / 2 }
  // the series this bit belongs to, even if the sheet is reopened while the create is in flight
  const series = sheet.series
  text.value = ''
  try {
    const bit = await commands.create(fields, pos, sheet.flowId)
    series.push({ id: bit.id, failed: false })
    if (openDetail && sheet.open && sheet.series === series) sheet.openDetail(bit.id)
  } catch (e) {
    console.error('Failed to create bit:', e)
    series.push({ id: uuidv7(), failed: true, fields })
  }
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.isComposing) return
  event.preventDefault()
  void submit(event.ctrlKey || event.metaKey)
}

function openRow(id: string) {
  sheet.openDetail(id)
}

onMounted(() => inputEl.value?.focus({ preventScroll: true }))
</script>

<template>
  <section class="capture">
    <header class="capture__header">
      <h2 class="capture__title">New Bits</h2>
      <button
        type="button"
        class="capture__close pressable"
        aria-label="Close"
        @click="emit('close')"
      >
        <X :size="14" aria-hidden="true" />
      </button>
    </header>

    <div class="capture__body">
      <ol v-if="rows.length" class="capture__series" aria-label="Created bits">
        <li v-for="row in rows" :key="row.entry.id">
          <button
            v-if="!row.entry.failed"
            type="button"
            class="capture__row pressable"
            @click="openRow(row.entry.id)"
          >
            <component
              :is="row.done ? CircleCheck : Circle"
              class="capture__mark"
              :size="15"
              aria-hidden="true"
            />
            <span class="capture__row-title">{{ row.title }}</span>
          </button>
          <div v-else class="capture__row capture__row--failed">
            <CircleAlert class="capture__mark" :size="15" aria-hidden="true" />
            <span class="capture__row-title">{{ row.title }}</span>
            <span class="capture__failed">Couldn’t create</span>
          </div>
        </li>
      </ol>

      <input
        ref="inputEl"
        v-model="text"
        class="capture__input"
        type="text"
        maxlength="500"
        placeholder="What needs to be done?"
        aria-label="New bit title"
        enterkeyhint="next"
        @keydown="onKeydown"
      />
    </div>

    <footer class="capture__hints" aria-hidden="true">
      <span><kbd>↵</kbd> next</span>
      <span><kbd>⌃↵</kbd> details</span>
      <span><kbd>esc</kbd> done</span>
    </footer>
  </section>
</template>

<style scoped>
.capture {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

/* ── Header ─────────────────────────────────────────────────────────── */
.capture__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: none;
  padding: 14px 14px 4px 20px;
}

.capture__title {
  margin: 0;
  color: var(--text0);
  font-size: 1.0625rem;
  font-weight: 650;
  letter-spacing: -0.015em;
}

.capture__close {
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
.capture__close:hover {
  background-color: var(--fill-press);
  color: var(--text0);
}

/* ── Series and input ───────────────────────────────────────────────── */
.capture__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-height: 0;
  padding: 8px 12px 12px;
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

.capture__series {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.capture__row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 34px;
  padding: 6px 8px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--text1);
  font-family: inherit;
  font-size: 0.9375rem;
  letter-spacing: -0.005em;
  text-align: left;
  cursor: pointer;
  outline: none;
}
button.capture__row:hover {
  background-color: var(--fill-hover);
  color: var(--text0);
}
.capture__row--failed {
  cursor: default;
  color: hsl(0 72% 52%);
}

.capture__mark {
  flex: none;
  color: var(--c);
}
.capture__row--failed .capture__mark {
  color: inherit;
}

.capture__row-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.capture__failed {
  flex: none;
  font-size: 0.75rem;
  font-weight: 550;
}

.capture__input {
  width: 100%;
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--material-stroke);
  border-radius: 12px;
  background-color: var(--fill-hover);
  color: var(--text0);
  caret-color: var(--c);
  font-family: inherit;
  font-size: 0.9375rem;
  letter-spacing: -0.005em;
  outline: none;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
.capture__input::placeholder {
  color: var(--text2);
  opacity: 0.7;
}
.capture__input:focus-visible {
  border-color: var(--c);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--c) 16%, transparent);
}

/* ── Keyboard hints ─────────────────────────────────────────────────── */
.capture__hints {
  display: flex;
  gap: 14px;
  flex: none;
  padding: 10px 20px 16px;
  color: var(--text2);
  font-size: 0.75rem;
  letter-spacing: 0.005em;
}
.capture__hints kbd {
  margin-right: 3px;
  font-family: inherit;
  font-weight: 600;
  color: var(--text1);
}

.capture__row:focus-visible,
.capture__close:focus-visible {
  box-shadow: 0 0 0 2px var(--brand);
}
</style>
