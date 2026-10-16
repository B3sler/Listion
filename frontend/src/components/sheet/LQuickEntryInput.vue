<script setup lang="ts">
import { computed, useTemplateRef, watch } from 'vue'
import type { QuickEntry, TokenKind } from '@/helpers/quickEntry'

/**
 * Text field of the capture view. A native input sits on top of a mirrored layer that repeats the
 * text in transparent ink and paints a soft background behind every token the smart entry
 * recognised. The parent owns the parsing; this component only renders `modelValue` and
 * `entry.tokens`.
 */

interface Props {
  modelValue: string
  entry: QuickEntry
  placeholder?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  submit: [opts: { details: boolean }]
}>()

interface Segment {
  text: string
  kind?: TokenKind
}

/** The text cut into plain and token runs. Tolerates tokens that are stale or out of range. */
const segments = computed<Segment[]>(() => {
  const text = props.modelValue
  const tokens = [...props.entry.tokens].sort((a, b) => a.start - b.start)
  const out: Segment[] = []
  let pos = 0
  for (const t of tokens) {
    const start = Math.max(t.start, pos)
    const end = Math.min(t.end, text.length)
    if (start >= end) continue
    if (start > pos) out.push({ text: text.slice(pos, start) })
    out.push({ text: text.slice(start, end), kind: t.kind })
    pos = end
  }
  if (pos < text.length) out.push({ text: text.slice(pos) })
  return out
})

const inputEl = useTemplateRef<HTMLInputElement>('inputEl')
const mirrorEl = useTemplateRef<HTMLDivElement>('mirrorEl')

/** Keeps the mirror horizontally aligned with the (possibly scrolled) input text. */
function syncScroll() {
  if (inputEl.value && mirrorEl.value) mirrorEl.value.scrollLeft = inputEl.value.scrollLeft
}

watch(() => props.modelValue, syncScroll, { flush: 'post' })

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
  syncScroll()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Enter' || e.isComposing) return
  e.preventDefault()
  emit('submit', { details: e.ctrlKey || e.metaKey })
}

defineExpose({ focus: () => inputEl.value?.focus() })
</script>

<template>
  <div class="qe">
    <div ref="mirrorEl" class="qe__mirror" aria-hidden="true">
      <template v-for="(seg, i) in segments" :key="i"
        ><mark v-if="seg.kind" :class="['qe__token', `qe__token--${seg.kind}`]">{{ seg.text }}</mark
        ><template v-else>{{ seg.text }}</template></template
      >
    </div>
    <input
      ref="inputEl"
      class="qe__input"
      type="text"
      autocomplete="off"
      spellcheck="false"
      :value="modelValue"
      :placeholder="placeholder"
      @input="onInput"
      @scroll="syncScroll"
      @keyup="syncScroll"
      @select="syncScroll"
      @keydown="onKeydown"
    />
  </div>
</template>

<style scoped>
/* Mirror and input share font, size, letter-spacing, padding and box-sizing, so the highlights
   sit exactly behind the glyphs. The box (background, border, ring) belongs to the wrapper. */
.qe {
  --qe-font-size: 0.9375rem;
  --qe-line-height: 1.375rem;
  --qe-pad-x: 12px;
  --qe-pad-y: 9px;

  position: relative;
  border: 1px solid var(--material-stroke);
  border-radius: 10px;
  background-color: var(--fill-hover);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    background-color 0.15s ease;
}
.qe:hover {
  background-color: var(--fill-press);
}
.qe:focus-within {
  border-color: var(--brand);
  background-color: var(--surface1);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--brand) 16%, transparent);
}

.qe__mirror,
.qe__input {
  box-sizing: border-box;
  margin: 0;
  padding: var(--qe-pad-y) var(--qe-pad-x);
  border: 0;
  font-family: inherit;
  font-size: var(--qe-font-size);
  font-weight: 400;
  line-height: var(--qe-line-height);
  letter-spacing: -0.005em;
  font-variant-ligatures: none;
  text-indent: 0;
  text-transform: none;
  word-spacing: 0;
}

.qe__mirror {
  position: absolute;
  inset: 0;
  overflow: hidden;
  white-space: pre;
  color: transparent;
  pointer-events: none;
}

.qe__input {
  position: relative;
  display: block;
  width: 100%;
  border-radius: inherit;
  background: transparent;
  color: var(--text0);
  outline: none;
}
.qe__input::placeholder {
  color: var(--text2);
  opacity: 0.7;
}

/* no padding or border: a token must not shift any glyph */
.qe__token {
  border-radius: 4px;
  padding: 0;
  color: transparent;
  background-color: var(--qe-tint);
}
.qe__token--due {
  --qe-tint: hsl(212 90% 55% / 0.22);
}
.qe__token--priority {
  --qe-tint: hsl(10 85% 55% / 0.22);
}
.qe__token--color {
  --qe-tint: hsl(165 55% 42% / 0.22);
}
.qe__token--size {
  --qe-tint: hsl(220 8% 55% / 0.25);
}
.qe__token--recurrence {
  --qe-tint: hsl(268 70% 60% / 0.22);
}
</style>
