<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue'
import { Ungroup } from 'lucide-vue-next'
import type { Flow } from '@/types/flow'
import type { Rect } from '@/composables/useFlowLayout'
import { FLOW_COLORS } from '@/composables/useFlowGroups'

const props = defineProps<{ flow: Flow; rect: Rect; dragging?: boolean }>()

const emit = defineEmits<{
  rename: [name: string]
  recolor: [color: string]
  dissolve: []
  dragstart: [e: PointerEvent]
}>()

const COLOR_NAMES: Record<string, string> = {
  '#818cf8': 'Indigo',
  '#34d399': 'Green',
  '#fbbf24': 'Amber',
  '#f472b6': 'Pink',
  '#38bdf8': 'Sky',
  '#a3a3a3': 'Grey',
}

const editing = ref(false)
const draft = ref('')
const input = ref<HTMLInputElement | null>(null)
const toolsOpen = ref(false)
let closeTimer: ReturnType<typeof setTimeout> | null = null

async function startRename() {
  draft.value = props.flow.name
  editing.value = true
  toolsOpen.value = false
  await nextTick()
  input.value?.select()
}

function commitRename() {
  if (!editing.value) return
  const name = draft.value.trim()
  editing.value = false
  if (name && name !== props.flow.name) emit('rename', name)
}

function openTools() {
  if (closeTimer) clearTimeout(closeTimer)
  closeTimer = null
  if (!editing.value) toolsOpen.value = true
}

// a short grace period so the pointer can travel from the name to the bar
function closeToolsSoon() {
  if (closeTimer) clearTimeout(closeTimer)
  closeTimer = setTimeout(() => (toolsOpen.value = false), 200)
}

function onPointerDown(e: PointerEvent) {
  // only the empty frame area moves the flow — not the name or its tool bar
  if (e.target !== e.currentTarget) return
  emit('dragstart', e)
}

onBeforeUnmount(() => {
  if (closeTimer) clearTimeout(closeTimer)
})
</script>

<template>
  <div
    class="flow"
    :class="{ 'flow--dragging': dragging }"
    :style="{
      '--flow': flow.color,
      transform: `translate3d(${rect.x}px, ${rect.y}px, 0)`,
      width: `${rect.w}px`,
      height: `${rect.h}px`,
    }"
    :data-flow-id="flow.id"
    @pointerdown="onPointerDown"
    @mousedown.left.exact.stop
  >
    <div
      class="flow__label"
      @pointerdown.stop
      @mouseenter="openTools"
      @mouseleave="closeToolsSoon"
      @focusin="openTools"
      @focusout="closeToolsSoon"
    >
      <input
        v-if="editing"
        ref="input"
        v-model="draft"
        class="flow__input"
        maxlength="60"
        aria-label="Flow name"
        @pointerdown.stop
        @keydown.enter.prevent="commitRename"
        @keydown.escape.prevent.stop="editing = false"
        @blur="commitRename"
      />
      <button
        v-else
        class="flow__name"
        type="button"
        :aria-label="`Rename flow ${flow.name}`"
        @pointerdown.stop
        @click.stop="startRename"
      >
        {{ flow.name }}
      </button>

      <Transition name="flow-tools">
        <div v-if="toolsOpen" class="flow__tools material" role="toolbar" aria-label="Flow options">
          <button
            v-for="c in FLOW_COLORS"
            :key="c"
            class="flow__swatch"
            type="button"
            :style="{ background: c }"
            :aria-label="`Colour ${COLOR_NAMES[c]}`"
            :aria-pressed="flow.color === c"
            @pointerdown.stop
            @click.stop="emit('recolor', c)"
          />
          <span class="flow__sep" />
          <button
            class="flow__dissolve"
            type="button"
            aria-label="Dissolve flow"
            title="Dissolve flow"
            @pointerdown.stop
            @click.stop="emit('dissolve')"
          >
            <Ungroup :size="14" />
          </button>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.flow {
  position: absolute;
  left: 0;
  top: 0;
  border-radius: 22px;
  border: 1px solid color-mix(in srgb, var(--flow) 28%, transparent);
  background: color-mix(in srgb, var(--flow) 4.5%, transparent);
  cursor: grab;
  will-change: transform;
  transition:
    transform var(--spring-duration) var(--ease-spring),
    width var(--spring-duration) var(--ease-spring),
    height var(--spring-duration) var(--ease-spring),
    border-color 0.3s ease,
    background-color 0.3s ease;
}
.flow--dragging {
  cursor: grabbing;
  transition:
    width var(--spring-duration) var(--ease-spring),
    height var(--spring-duration) var(--ease-spring);
}

.flow__label {
  position: absolute;
  left: 20px;
  top: -9px;
  display: flex;
  align-items: center;
}

.flow__name,
.flow__input {
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: -0.005em;
  line-height: 18px;
  padding: 0 7px;
  border-radius: 6px;
  background: var(--surface1);
  color: color-mix(in srgb, color-mix(in srgb, var(--flow) 55%, var(--text1)) 85%, transparent);
}
.flow__name {
  border: none;
  cursor: text;
  white-space: nowrap;
  transition: color 0.2s ease;
}
.flow__name:hover {
  color: var(--text0);
}
.flow__input {
  border: 1px solid var(--brand);
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 16%, transparent);
  color: var(--text0);
}

.flow__tools {
  position: absolute;
  left: 0;
  bottom: calc(100% + 6px);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 12px;
  transform-origin: bottom left;
}
.flow__swatch {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: none;
  padding: 0;
  cursor: pointer;
  transition: transform var(--spring-duration) var(--ease-spring);
}
.flow__swatch:hover {
  transform: scale(1.15);
}
.flow__swatch[aria-pressed='true'] {
  box-shadow:
    0 0 0 2px var(--surface1),
    0 0 0 3.5px var(--text1);
}
.flow__sep {
  width: 1px;
  height: 14px;
  background: var(--separator);
}
.flow__dissolve {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 11px;
  border: none;
  background: transparent;
  color: var(--text2);
  cursor: pointer;
}
.flow__dissolve:hover {
  background: var(--fill-hover);
  color: var(--text0);
}

.flow-tools-enter-active {
  transition:
    opacity 0.15s ease,
    transform var(--spring-duration) var(--ease-spring);
}
.flow-tools-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.15s ease;
}
.flow-tools-enter-from,
.flow-tools-leave-to {
  opacity: 0;
  transform: scale(0.92);
}
</style>
