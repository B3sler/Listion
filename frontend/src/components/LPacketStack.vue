<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type { Bit } from '@/stores/bitStore'
import type { NodeRef, Packet, PacketSummary, WorkflowState } from '@/types/flow'
import { stackGeometry } from '@/composables/useFlowLayout'
import LBitCapsule from './LBitCapsule.vue'

const props = defineProps<{
  packet: Packet
  members: Bit[]
  x: number
  y: number
  states: Map<number, WorkflowState>
  cycleBitIds: Set<number>
  summary: PacketSummary
  gapIndex: number | null
  highlighted?: boolean
  dimmed?: boolean
  dragging?: boolean
}>()

const emit = defineEmits<{
  headerPointerdown: [e: PointerEvent]
  bitPointerdown: [e: PointerEvent, bitId: number]
  bitOpen: [bitId: number]
  bitToggleDone: [bitId: number]
  linkstart: [e: PointerEvent, from: NodeRef]
  rename: [name: string]
}>()

const geometry = computed(() => stackGeometry(props.members.length, null, props.gapIndex))

const editing = ref(false)
const draft = ref('')
const input = ref<HTMLInputElement | null>(null)

async function startRename() {
  draft.value = props.packet.name
  editing.value = true
  await nextTick()
  input.value?.select()
}

function commitRename() {
  if (!editing.value) return
  const name = draft.value.trim()
  editing.value = false
  if (name && name !== props.packet.name) emit('rename', name)
}
</script>

<template>
  <div
    class="stack"
    :class="{
      'stack--highlighted': highlighted,
      'stack--dimmed': dimmed,
      'stack--dragging': dragging,
    }"
    :style="{ transform: `translate3d(${x}px, ${y}px, 0)`, height: `${geometry.height}px` }"
    data-node-type="packet"
    :data-node-id="packet.id"
    @mousedown.left.exact.stop
  >
    <div class="stack__head" @pointerdown="emit('headerPointerdown', $event)">
      <input
        v-if="editing"
        ref="input"
        v-model="draft"
        class="stack__input"
        maxlength="60"
        @pointerdown.stop
        @keydown.enter.prevent="commitRename"
        @keydown.escape.prevent="editing = false"
        @blur="commitRename"
      />
      <span v-else class="stack__name" @dblclick.stop="startRename">{{ packet.name }}</span>
      <span class="stack__count">{{ summary.done }} / {{ summary.total }}</span>
      <button
        class="stack__handle"
        type="button"
        tabindex="-1"
        aria-label="Draw a dependency from this packet"
        @pointerdown.stop.prevent="emit('linkstart', $event, { type: 'packet', id: packet.id })"
        @mousedown.left.exact.stop
      />
    </div>
    <div class="stack__bar">
      <i :style="{ transform: `scaleX(${summary.percent / 100})` }" />
    </div>

    <div
      v-for="(bit, i) in members"
      :key="bit.id"
      class="stack__row"
      :style="{ transform: `translateY(${geometry.offsets[i]}px)` }"
    >
      <span class="stack__num">{{ i + 1 }}</span>
      <LBitCapsule
        :bit="bit"
        :state="states.get(bit.id) ?? null"
        :in-cycle="cycleBitIds.has(bit.id)"
        @pointerdown="emit('bitPointerdown', $event, bit.id)"
        @open="emit('bitOpen', bit.id)"
        @toggle-done="emit('bitToggleDone', bit.id)"
        @linkstart="emit('linkstart', $event, { type: 'bit', id: bit.id })"
      />
    </div>

    <div
      v-if="geometry.gapY !== null"
      class="stack__insert"
      :style="{ transform: `translateY(${geometry.gapY - 1.5}px)` }"
    />
  </div>
</template>

<style scoped>
.stack {
  position: absolute;
  left: 0;
  top: 0;
  width: 236px;
  border-radius: 20px;
  background: color-mix(in srgb, var(--surface2) 55%, transparent);
  border: 1px solid var(--material-stroke);
  box-shadow: inset 0 1px 0 var(--material-edge);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  will-change: transform;
  transition:
    transform var(--spring-duration) var(--ease-spring),
    height var(--spring-duration) var(--ease-spring),
    box-shadow 0.2s ease,
    opacity 0.25s ease;
}
.stack--dragging {
  transition:
    height var(--spring-duration) var(--ease-spring),
    box-shadow 0.15s ease;
  box-shadow:
    inset 0 1px 0 var(--material-edge),
    0 20px 40px -14px hsl(var(--surface-shadow) / 0.5);
}
.stack--highlighted {
  box-shadow:
    inset 0 1px 0 var(--material-edge),
    0 0 0 2px color-mix(in srgb, var(--brand) 60%, transparent),
    0 0 0 6px color-mix(in srgb, var(--brand) 14%, transparent);
}
.stack--dimmed {
  opacity: 0.25;
}

.stack__head {
  position: absolute;
  left: 8px;
  right: 8px;
  top: 8px;
  height: 22px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px 0 6px;
  cursor: grab;
  touch-action: none;
}
.stack--dragging .stack__head {
  cursor: grabbing;
}
.stack__name {
  flex: 1;
  min-width: 0;
  font-size: 0.8125rem;
  font-weight: 650;
  letter-spacing: -0.01em;
  color: var(--text0);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.stack__input {
  flex: 1;
  min-width: 0;
  font-size: 0.8125rem;
  font-weight: 650;
  color: var(--text0);
  background: var(--surface1);
  border: 1px solid var(--brand);
  border-radius: 6px;
  padding: 1px 6px;
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 16%, transparent);
}
.stack__count {
  font-size: 0.6875rem;
  font-variant-numeric: tabular-nums;
  color: var(--text2);
}
.stack__handle {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--surface1);
  border: 2px solid var(--brand);
  opacity: 0;
  transform: scale(0.6);
  cursor: crosshair;
  transition:
    opacity 0.15s ease,
    transform var(--spring-duration) var(--ease-spring-bounce);
}
.stack__head:hover .stack__handle {
  opacity: 1;
  transform: scale(1);
}

.stack__bar {
  position: absolute;
  left: 14px;
  right: 14px;
  top: 33px;
  height: 3px;
  border-radius: 2px;
  background: var(--fill-press);
  overflow: hidden;
}
.stack__bar i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #10b981, #34d399);
  transform-origin: left center;
  transition: transform 0.6s var(--ease-spring);
}

.stack__row {
  position: absolute;
  left: 8px;
  top: 0;
  display: flex;
  align-items: flex-start;
  transition: transform var(--spring-duration) var(--ease-spring);
}
.stack__num {
  width: 20px;
  height: 32px;
  line-height: 32px;
  font-size: 0.6875rem;
  font-variant-numeric: tabular-nums;
  color: var(--text2);
  text-align: center;
}

.stack__insert {
  position: absolute;
  left: 34px;
  right: 14px;
  top: 0;
  height: 3px;
  border-radius: 2px;
  background: #818cf8;
  box-shadow: 0 0 10px rgba(129, 140, 248, 0.7);
  transition: transform var(--spring-duration) var(--ease-spring);
}
</style>
