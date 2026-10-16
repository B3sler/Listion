<script setup lang="ts">
import LMiniCalendar from './LMiniCalendar.vue'

interface QuickPick {
  label: string
  key: string | null
}

interface Props {
  modelValue: string | null
  today: string
  accent: string
  quick: QuickPick[]
}

defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [key: string | null] }>()
</script>

<template>
  <div class="picker">
    <div class="picker__quicks">
      <button
        v-for="(pick, i) in quick"
        :key="i"
        type="button"
        class="picker__quick pressable"
        :class="{ 'picker__quick--active': pick.key === modelValue }"
        :aria-pressed="pick.key === modelValue"
        @click="emit('update:modelValue', pick.key)"
      >
        {{ pick.label }}
      </button>
    </div>
    <LMiniCalendar
      :model-value="modelValue"
      :today="today"
      :accent="accent"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </div>
</template>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 2px 4px;
}

.picker__quicks {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.picker__quick {
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--material-stroke);
  border-radius: 999px;
  background-color: var(--fill-hover);
  color: var(--text1);
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 550;
  white-space: nowrap;
  cursor: pointer;
  outline: none;
}
.picker__quick:hover {
  color: var(--text0);
}
.picker__quick--active {
  background-color: var(--fill-press);
  color: var(--text0);
}
.picker__quick:focus-visible {
  box-shadow: 0 0 0 2px var(--brand);
}
</style>
