<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { CAPSULE_W } from '@/composables/useFlowLayout'
import { Spring } from '@/helpers/motion'
import type { Ghost } from '@/stores/sheetStore'

/**
 * Where the next captured bit lands: a translucent, dashed capsule in canvas coordinates. It
 * glides to each new slot and grows with the chosen size on springs, so a quick series of Enters
 * retargets mid-flight instead of jumping. Reduced motion: `Spring.to` jumps to the target.
 */
const props = defineProps<{ ghost: Ghost }>()

const x = ref(props.ghost.x)
const y = ref(props.ghost.y)
const h = ref(props.ghost.h)
const springs = [
  new Spring(props.ghost.x, (v) => (x.value = v)),
  new Spring(props.ghost.y, (v) => (y.value = v)),
  new Spring(props.ghost.h, (v) => (h.value = v)),
] as const

watch(
  () => [props.ghost.x, props.ghost.y, props.ghost.h] as const,
  (targets) => targets.forEach((t, i) => springs[i].to(t)),
)

onBeforeUnmount(() => springs.forEach((s) => s.stop()))
</script>

<template>
  <div
    class="ghost"
    aria-hidden="true"
    :style="{
      '--c': ghost.color,
      width: `${CAPSULE_W}px`,
      height: `${h}px`,
      transform: `translate3d(${x}px, ${y}px, 0)`,
    }"
  >
    <span class="ghost__dot" />
    <span class="ghost__title" :class="{ 'ghost__title--placeholder': !ghost.title }">{{
      ghost.title || 'New Bit'
    }}</span>
  </div>
</template>

<style scoped>
/* Mirrors the capsule's box and title row, so the real one appears exactly in its place */
.ghost {
  position: absolute;
  left: 0;
  top: 0;
  box-sizing: border-box;
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 0 12px 0 7px;
  border: 1.5px dashed var(--c);
  border-radius: 16px;
  background-color: color-mix(in srgb, var(--c) 10%, transparent);
  color: var(--text0);
  opacity: 0.45;
  pointer-events: none;
  will-change: transform, height;
}

.ghost__dot {
  flex: none;
  width: 17px;
  height: 17px;
  /* centred on the title row, like the capsule's status dot (row centre = CAPSULE_H / 2) */
  margin-top: calc(16px - 1.5px - 8.5px);
  border: 1.5px solid var(--c);
  border-radius: 50%;
}

.ghost__title {
  flex: 1;
  min-width: 0;
  /* line box centred on the row centre: 16 px from the outer top */
  line-height: 29px;
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ghost__title--placeholder {
  color: var(--text2);
}
</style>
