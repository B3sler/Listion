<script setup lang="ts">
import type { DependencyItem } from '@/types/flow'

defineProps<{
  items: DependencyItem[]
  preview: string | null
  selectedId: number | null
}>()

const emit = defineEmits<{
  select: [id: number]
  remove: [id: number]
}>()

const COLORS: Record<DependencyItem['state'], string> = {
  pending: 'rgba(148,163,184,0.7)',
  done: 'rgba(52,211,153,0.85)',
  cycle: 'rgba(249,115,22,0.9)',
}

function onArrowKey(e: KeyboardEvent, id: number) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    e.stopPropagation()
    emit('select', id)
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    e.stopPropagation()
    emit('remove', id)
  }
}

function onDeleteKey(e: KeyboardEvent, id: number) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    e.stopPropagation()
    emit('remove', id)
  }
}
</script>

<template>
  <svg class="deps">
    <g
      v-for="item in items"
      :key="item.id"
      class="dep"
      :class="{ 'dep--dimmed': item.dimmed, 'dep--selected': selectedId === item.id }"
    >
      <path
        :d="item.d"
        class="dep__line"
        :class="`dep__line--${item.state}`"
        :stroke="COLORS[item.state]"
      />
      <polygon
        points="0,0 -9,-4.5 -9,4.5"
        :transform="`translate(${item.tx},${item.ty}) rotate(${item.angle})`"
        :fill="COLORS[item.state]"
      />
      <path
        :d="item.d"
        class="dep__hit"
        tabindex="0"
        role="button"
        aria-label="Dependency, select"
        @click.stop="emit('select', item.id)"
        @keydown="onArrowKey($event, item.id)"
        @mousedown.stop
      />
      <g
        v-if="selectedId === item.id"
        class="dep__delete"
        role="button"
        tabindex="0"
        aria-label="Delete dependency"
        :transform="`translate(${item.mx},${item.my})`"
        @click.stop="emit('remove', item.id)"
        @keydown="onDeleteKey($event, item.id)"
        @mousedown.stop
      >
        <circle r="12" class="dep__delete-bg" />
        <line x1="-4" y1="-4" x2="4" y2="4" />
        <line x1="4" y1="-4" x2="-4" y2="4" />
      </g>
    </g>
    <path v-if="preview" :d="preview" class="dep__preview" />
  </svg>
</template>

<style scoped>
.deps {
  position: absolute;
  inset: 0;
  width: 0;
  height: 0;
  overflow: visible;
  pointer-events: none;
}
.dep {
  transition: opacity 0.25s ease;
}
.dep--dimmed {
  opacity: 0.08;
}
.dep__line {
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  transition: stroke 0.3s ease;
}
.dep--selected .dep__line {
  stroke-width: 3;
}
.dep__line--pending {
  stroke-dasharray: 6 5;
}
.dep__hit {
  fill: none;
  stroke: transparent;
  stroke-width: 20;
  pointer-events: stroke;
  cursor: pointer;
  outline: none;
}
.dep__hit:focus-visible {
  stroke: color-mix(in srgb, var(--brand) 22%, transparent);
}
.dep__delete {
  pointer-events: all;
  cursor: pointer;
  outline: none;
}
.dep__delete:focus-visible .dep__delete-bg {
  stroke-width: 3;
}
.dep__delete-bg {
  fill: var(--surface1);
  stroke: #ef4444;
  stroke-width: 1.5;
}
.dep__delete line {
  stroke: #ef4444;
  stroke-width: 2;
  stroke-linecap: round;
}
.dep__preview {
  fill: none;
  stroke: #818cf8;
  stroke-width: 2;
  stroke-dasharray: 4 4;
  stroke-linecap: round;
}
</style>
