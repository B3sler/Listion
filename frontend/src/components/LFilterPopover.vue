<script setup lang="ts">
import type { FilterState } from '@/stores/toolStore'

defineProps<{ filters: FilterState }>()

const emit = defineEmits<{
  toggle: [group: keyof FilterState, value: string | number]
  reset: []
}>()

const GROUPS: {
  key: keyof FilterState
  title: string
  options: { value: string | number; label: string }[]
}[] = [
  {
    key: 'workflow',
    title: 'Workflow',
    options: [
      { value: 'ready', label: 'Ready' },
      { value: 'blocked', label: 'Blocked' },
    ],
  },
  {
    key: 'priority',
    title: 'Priority',
    options: [
      { value: 3, label: 'High' },
      { value: 2, label: 'Medium' },
      { value: 1, label: 'Low' },
    ],
  },
  {
    key: 'due',
    title: 'Due',
    options: [
      { value: 'overdue', label: 'Overdue' },
      { value: 'today', label: 'Today' },
      { value: 'week', label: 'This week' },
    ],
  },
]

function isOn(filters: FilterState, key: keyof FilterState, value: string | number): boolean {
  return (filters[key] as (string | number)[]).includes(value)
}
</script>

<template>
  <div class="filter material" role="dialog" aria-label="Filter bits">
    <section v-for="g in GROUPS" :key="g.key" class="filter__group">
      <h4 class="filter__title">{{ g.title }}</h4>
      <div class="filter__chips">
        <button
          v-for="o in g.options"
          :key="o.value"
          class="filter__chip pressable"
          type="button"
          :data-filter="`${g.key}:${o.value}`"
          :aria-pressed="isOn(filters, g.key, o.value)"
          @click="emit('toggle', g.key, o.value)"
        >
          {{ o.label }}
        </button>
      </div>
    </section>
    <button class="filter__reset" type="button" @click="emit('reset')">Reset</button>
  </div>
</template>

<style scoped>
.filter {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  width: 248px;
  padding: 12px;
  border-radius: 16px;
  transform-origin: top right;
  text-align: left;
}
.filter__group + .filter__group {
  margin-top: 10px;
}
.filter__title {
  margin: 0 0 6px 2px;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text2);
}
.filter__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.filter__chip {
  padding: 4px 10px;
  border-radius: 999px;
  border: none;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text1);
  background: var(--fill-hover);
  cursor: pointer;
}
.filter__chip:hover {
  background: var(--fill-press);
}
.filter__chip[aria-pressed='true'] {
  background: var(--brand);
  color: hsl(0 0% 100%);
}
.filter__reset {
  display: block;
  margin: 12px 0 0 auto;
  border: none;
  background: none;
  font-size: 0.8125rem;
  font-weight: 500;
  color: color-mix(in srgb, var(--brand) 75%, var(--text0));
  cursor: pointer;
}
.filter__reset:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
