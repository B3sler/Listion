<script setup lang="ts">
import { computed } from 'vue'
import { PALETTE } from '@/helpers/palette'

interface Props {
  modelValue: string | null
}

const props = defineProps<Props>()
const emit = defineEmits<{ 'update:modelValue': [hex: string] }>()

const current = computed(() => props.modelValue?.toLowerCase() ?? null)
// a colour from before the palette (or set elsewhere) stays pickable as a 13th swatch in front
const custom = computed(() =>
  current.value && !PALETTE.some((c) => c.hex === current.value) ? props.modelValue : null,
)

function name(en: string): string {
  return en.charAt(0).toUpperCase() + en.slice(1)
}
</script>

<template>
  <div class="colors" role="group" aria-label="Color">
    <button
      v-if="custom"
      type="button"
      class="swatch swatch--custom"
      :style="{ backgroundColor: custom, color: custom }"
      :aria-label="`Custom ${custom}`"
      :title="custom"
      aria-pressed="true"
      @click="emit('update:modelValue', custom)"
    />
    <div class="colors__grid">
      <button
        v-for="c in PALETTE"
        :key="c.hex"
        type="button"
        class="swatch"
        :class="{ 'swatch--active': current === c.hex }"
        :style="{ backgroundColor: c.hex, color: c.hex }"
        :aria-label="name(c.en)"
        :title="name(c.en)"
        :aria-pressed="current === c.hex"
        @click="emit('update:modelValue', c.hex)"
      />
    </div>
  </div>
</template>

<style scoped>
.colors {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 4px 6px;
}

.colors__grid {
  display: grid;
  grid-template-columns: repeat(6, 1.75rem);
  gap: 10px;
}

.swatch {
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  outline: none;
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.12);
  transition:
    transform var(--spring-duration) var(--ease-spring),
    box-shadow 0.2s ease;
}
.swatch:hover {
  transform: scale(1.1);
}
.swatch:active {
  transform: scale(0.9);
  transition-duration: var(--press-duration);
}
/* selection ring sits outside the swatch, like the system colour well */
.swatch--active,
.swatch--custom {
  box-shadow:
    0 0 0 2px var(--surface1),
    0 0 0 4px currentColor;
}
.swatch:focus-visible {
  box-shadow:
    0 0 0 2px var(--surface1),
    0 0 0 4px var(--brand);
}

@media (prefers-reduced-motion: reduce) {
  .swatch,
  .swatch:hover,
  .swatch:active {
    transform: none;
    transition: box-shadow 0.2s ease;
  }
}
</style>
