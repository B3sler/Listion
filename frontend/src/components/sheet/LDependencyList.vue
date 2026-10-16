<script setup lang="ts">
import { computed, inject } from 'vue'
import { ChevronRight, Layers, X } from 'lucide-vue-next'
import type { NodeRef } from '@/types/flow'
import { BIT_COMMANDS } from '@/composables/useBitCommands'
import { useBitStore } from '@/stores/bitStore'
import { useDependencyStore } from '@/stores/dependencyStore'
import { usePacketStore } from '@/stores/packetStore'
import { DEFAULT_COLOR } from '@/helpers/palette'

interface Props {
  bitId: string
}

interface Row {
  /** The arrow this row stands for. */
  depId: string
  /** The node at the other end. */
  node: NodeRef
  title: string
  /** Bits only: 0 open, 1 in progress, 2 done. */
  status: number
  color: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  navigate: [ref: NodeRef]
  hover: [depId: string | null]
}>()

const injected = inject(BIT_COMMANDS)
if (!injected) throw new Error('LDependencyList needs BIT_COMMANDS to be provided')
const commands = injected

const bitStore = useBitStore()
const packetStore = usePacketStore()
const dependencyStore = useDependencyStore()

/** One row for the other end of an arrow; null when that end is gone or pending deletion. */
function rowFor(depId: string, node: NodeRef): Row | null {
  if (node.type === 'packet') {
    const packet = packetStore.packets.find((p) => p.id === node.id)
    return packet ? { depId, node, title: packet.name, status: 0, color: DEFAULT_COLOR } : null
  }
  const bit = bitStore.visibleBits.find((b) => b.id === node.id)
  return bit
    ? { depId, node, title: bit.title, status: bit.status, color: bit.color ?? DEFAULT_COLOR }
    : null
}

function rows(pick: (d: (typeof dependencyStore.dependencies)[number]) => Row | null): Row[] {
  return dependencyStore.dependencies.map(pick).filter((row): row is Row => row !== null)
}

/** "to waits for from": what this bit waits for sits at the `from` end of its incoming arrows. */
const waitingFor = computed(() =>
  rows((d) =>
    d.toType === 'bit' && d.toId === props.bitId
      ? rowFor(d.id, { type: d.fromType, id: d.fromId })
      : null,
  ),
)
const blocking = computed(() =>
  rows((d) =>
    d.fromType === 'bit' && d.fromId === props.bitId
      ? rowFor(d.id, { type: d.toType, id: d.toId })
      : null,
  ),
)

const groups = computed(() =>
  [
    { key: 'waiting', heading: 'Waiting for', rows: waitingFor.value },
    { key: 'blocking', heading: 'Blocking', rows: blocking.value },
  ].filter((g) => g.rows.length > 0),
)

function remove(row: Row) {
  // the row goes away with its arrow, so no mouseleave will clear the highlight
  emit('hover', null)
  void commands.removeDependency(row.depId).catch((e) => {
    console.error('Failed to remove dependency:', e)
  })
}

function statusLabel(status: number) {
  return status === 2 ? 'done' : status === 1 ? 'in progress' : 'open'
}
</script>

<template>
  <section v-if="groups.length > 0" class="deplist" aria-label="Dependencies">
    <div v-for="group in groups" :key="group.key" class="deplist__group">
      <h3 class="deplist__heading">{{ group.heading }}</h3>
      <ul class="deplist__rows">
        <li
          v-for="row in group.rows"
          :key="row.depId"
          class="deplist__row"
          data-no-swipe
          @mouseenter="emit('hover', row.depId)"
          @mouseleave="emit('hover', null)"
          @focusin="emit('hover', row.depId)"
          @focusout="emit('hover', null)"
        >
          <button type="button" class="deplist__main pressable" @click="emit('navigate', row.node)">
            <Layers
              v-if="row.node.type === 'packet'"
              class="deplist__stack"
              :size="15"
              aria-hidden="true"
            />
            <span
              v-else
              class="deplist__dot"
              :class="`deplist__dot--s${row.status}`"
              :style="{ '--c': row.color }"
              role="img"
              :aria-label="statusLabel(row.status)"
            />
            <span class="deplist__title">{{ row.title || 'Untitled' }}</span>
            <ChevronRight class="deplist__chevron" :size="14" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="deplist__remove pressable"
            :aria-label="`Remove dependency on ${row.title}`"
            @click="remove(row)"
          >
            <X :size="13" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.deplist {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.deplist__group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.deplist__heading {
  margin: 0;
  padding: 0 4px;
  color: var(--text2);
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.deplist__rows {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.deplist__row {
  position: relative;
}

.deplist__main {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 36px;
  /* room for the remove button and the chevron on the right */
  padding: 6px 52px 6px 8px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--text0);
  font: inherit;
  font-size: 0.9375rem;
  text-align: left;
  cursor: pointer;
  outline: none;
}
.deplist__main:hover,
.deplist__row:focus-within .deplist__main {
  background-color: var(--fill-hover);
}
.deplist__main:focus-visible {
  box-shadow: 0 0 0 2px var(--brand);
}

.deplist__dot {
  flex: none;
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border: 1.5px solid var(--c);
  border-radius: 50%;
}
.deplist__dot--s1 {
  background: conic-gradient(var(--c) 0 50%, transparent 50% 100%);
}
.deplist__dot--s2 {
  background: var(--c);
}

.deplist__stack {
  flex: none;
  color: var(--text2);
}

.deplist__title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.deplist__chevron {
  position: absolute;
  right: 10px;
  top: 50%;
  translate: 0 -50%;
  color: var(--text2);
  pointer-events: none;
}

.deplist__remove {
  position: absolute;
  right: 28px;
  top: 50%;
  translate: 0 -50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--text2);
  cursor: pointer;
  outline: none;
}
.deplist__remove:hover {
  background-color: var(--fill-hover);
  color: var(--text0);
}
.deplist__remove:focus-visible {
  box-shadow: 0 0 0 2px var(--brand);
}
</style>
