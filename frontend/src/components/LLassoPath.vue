<script setup lang="ts">
import { computed } from 'vue'
import type { Point } from '@/composables/useFlowGroups'

const props = defineProps<{ points: Point[] }>()

const polyline = computed(() => props.points.map((p) => `${p.x},${p.y}`).join(' '))
</script>

<template>
  <svg class="lasso" aria-hidden="true">
    <polyline :points="polyline" />
  </svg>
</template>

<style scoped>
.lasso {
  position: absolute;
  inset: 0;
  /* Not 0x0: Chrome does not paint the contents of a zero-size svg. */
  width: 1px;
  height: 1px;
  overflow: visible;
  pointer-events: none;
}
.lasso polyline {
  fill: rgba(165, 180, 252, 0.06);
  stroke: #a5b4fc;
  stroke-width: 1.5;
  stroke-dasharray: 5 4;
  stroke-linejoin: round;
  stroke-linecap: round;
}
</style>
