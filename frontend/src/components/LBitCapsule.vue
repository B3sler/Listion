<script setup lang="ts">
import { computed } from 'vue'
import { Check, Flag, Lock } from 'lucide-vue-next'
import type { Bit } from '@/stores/bitStore'
import type { WorkflowState } from '@/types/flow'

const props = defineProps<{
  bit: Bit
  state: WorkflowState
  inCycle?: boolean
  lifted?: boolean
  dimmed?: boolean
  snapHint?: 'above' | 'below' | null
}>()

const emit = defineEmits<{
  pointerdown: [e: PointerEvent]
  open: []
  toggleDone: []
  linkstart: [e: PointerEvent]
}>()

const PRIORITY_LABEL: Record<number, string> = { 1: 'Low', 2: 'Medium', 3: 'High' }
const STATUS_LABEL: Record<number, string> = { 0: 'Open', 1: 'In progress', 2: 'Done' }

const color = computed(() => props.bit.color ?? '#6366f1')
const isDone = computed(() => props.bit.status === 2)
const priorityLabel = computed(() =>
  props.bit.priority ? PRIORITY_LABEL[props.bit.priority] : undefined,
)

const ariaLabel = computed(() => {
  const parts = [props.bit.title, STATUS_LABEL[props.bit.status] ?? 'Open']
  if (priorityLabel.value) parts.push(`${priorityLabel.value} priority`)
  if (props.state === 'blocked') parts.push('blocked')
  if (props.state === 'ready') parts.push('ready')
  if (props.inCycle) parts.push('in a cycle')
  return parts.join(', ')
})
</script>

<template>
  <div
    class="capsule"
    :class="{
      'capsule--ready': state === 'ready',
      'capsule--blocked': state === 'blocked',
      'capsule--cycle': inCycle,
      'capsule--lifted': lifted,
      'capsule--dimmed': dimmed,
      [`capsule--snap-${snapHint}`]: !!snapHint,
    }"
    :style="{ '--c': color }"
    data-node-type="bit"
    :data-node-id="bit.id"
    tabindex="0"
    role="button"
    :aria-label="ariaLabel"
    @pointerdown="emit('pointerdown', $event)"
    @mousedown.left.exact.stop
    @keydown.enter.prevent="emit('open')"
  >
    <div class="capsule__row">
      <!-- the status dot is its own control: tick it off without opening or dragging -->
      <button
        class="capsule__check pressable"
        :class="`capsule__check--s${bit.status}`"
        type="button"
        :aria-label="isDone ? 'Mark as open' : 'Mark as done'"
        :aria-pressed="isDone"
        @pointerdown.stop
        @mousedown.left.exact.stop
        @click.stop="emit('toggleDone')"
        @keydown.enter.stop
      >
        <Check v-if="isDone" :size="10" :stroke-width="3" />
      </button>
      <span class="capsule__title">{{ bit.title }}</span>
      <Lock v-if="state === 'blocked'" :size="11" class="capsule__lock" aria-hidden="true" />
      <Flag
        v-if="priorityLabel"
        :size="12"
        :stroke-width="2.25"
        fill="currentColor"
        class="capsule__prio"
        :class="`capsule__prio--${bit.priority}`"
        aria-hidden="true"
      />
    </div>
    <button
      class="capsule__handle"
      type="button"
      tabindex="-1"
      aria-label="Draw a dependency from this bit"
      @pointerdown.stop.prevent="emit('linkstart', $event)"
      @mousedown.left.exact.stop
    />
  </div>
</template>

<style scoped>
.capsule {
  position: relative;
  width: 200px;
  min-height: 32px;
  border-radius: 16px;
  padding: 0 12px 0 7px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background-color: var(--material-regular);
  backdrop-filter: blur(20px) saturate(170%);
  -webkit-backdrop-filter: blur(20px) saturate(170%);
  border: 1px solid var(--material-stroke);
  box-shadow:
    inset 0 1px 0 var(--material-edge),
    0 6px 16px -8px hsl(var(--surface-shadow) / calc(var(--shadow-strength) + 0.1));
  color: var(--text0);
  cursor: grab;
  user-select: none;
  touch-action: none;
  outline: none;
  transition:
    transform var(--spring-duration) var(--ease-spring),
    box-shadow 0.2s ease,
    opacity 0.25s ease;
}
.capsule:hover {
  transform: scale(1.02);
}
.capsule:focus-visible {
  box-shadow:
    inset 0 1px 0 var(--material-edge),
    0 0 0 3px color-mix(in srgb, var(--brand) 45%, transparent);
}
.capsule--ready {
  box-shadow:
    inset 0 1px 0 var(--material-edge),
    0 0 0 1.5px rgba(52, 211, 153, 0.7),
    0 6px 16px -8px hsl(var(--surface-shadow) / 0.4);
}
.capsule--blocked {
  opacity: 0.6;
}
.capsule--cycle {
  box-shadow:
    inset 0 1px 0 var(--material-edge),
    0 0 0 1.5px rgba(249, 115, 22, 0.85),
    0 6px 16px -8px hsl(var(--surface-shadow) / 0.4);
}
.capsule--lifted {
  cursor: grabbing;
  transform: scale(1.05) rotate(-1.5deg);
  box-shadow:
    inset 0 1px 0 var(--material-edge),
    0 18px 32px -10px hsl(var(--surface-shadow) / 0.55);
  transition:
    transform 0.15s ease-out,
    box-shadow 0.15s ease-out;
}
.capsule--dimmed {
  opacity: 0.2;
}

.capsule__row {
  height: 30px;
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.capsule__check {
  position: relative;
  width: 17px;
  height: 17px;
  flex-shrink: 0;
  padding: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid var(--c);
  background: transparent;
  color: #fff;
  cursor: pointer;
  transition:
    background 0.2s ease,
    transform var(--press-duration) ease-out;
}
/* a larger invisible hit area around the 17px dot */
.capsule__check::after {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: 50%;
}
.capsule__check:hover {
  background: color-mix(in srgb, var(--c) 22%, transparent);
}
.capsule__check--s1 {
  background: conic-gradient(var(--c) 0 50%, transparent 50% 100%);
}
.capsule__check--s2,
.capsule__check--s2:hover {
  background: var(--c);
}
.capsule__check:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--brand) 70%, transparent);
  outline-offset: 2px;
}

.capsule__prio {
  flex-shrink: 0;
}
.capsule__prio--1 {
  color: #3b82f6;
}
.capsule__prio--2 {
  color: #f59e0b;
}
.capsule__prio--3 {
  color: #ef4444;
}

.capsule__title {
  flex: 1;
  min-width: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.capsule__lock {
  flex-shrink: 0;
  color: #f87171;
}

/* arrow handle: appears on hover at the right edge */
.capsule__handle {
  position: absolute;
  right: -6px;
  top: 9px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--surface1);
  border: 2px solid var(--c);
  opacity: 0;
  transform: scale(0.6);
  cursor: crosshair;
  transition:
    opacity 0.15s ease,
    transform var(--spring-duration) var(--ease-spring-bounce);
}
.capsule:hover .capsule__handle,
.capsule:focus-visible .capsule__handle {
  opacity: 1;
  transform: scale(1);
}
.capsule--lifted .capsule__handle {
  display: none;
}

/* snap hint: insert line above/below a loose capsule */
.capsule--snap-above::before,
.capsule--snap-below::before {
  content: '';
  position: absolute;
  left: 12px;
  right: 12px;
  height: 3px;
  border-radius: 2px;
  background: #818cf8;
  box-shadow: 0 0 10px rgba(129, 140, 248, 0.7);
}
.capsule--snap-above::before {
  top: -8px;
}
.capsule--snap-below::before {
  bottom: -8px;
}
</style>
