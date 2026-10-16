<script setup lang="ts">
import { computed } from 'vue'
import { Play, Square } from 'lucide-vue-next'
import type { Bit } from '@/stores/bitStore'
import { useFocusStore } from '@/stores/focusStore'
import { SIZE_MINUTES } from '@/helpers/bitMeta'
import { formatClock, formatProgress, formatTracked } from '@/helpers/focusTime'

interface Props {
  bit: Bit
}

const props = defineProps<Props>()
const focus = useFocusStore()

const running = computed(() => focus.running?.bitId === props.bit.id)
/** Booked time plus the running stopwatch. */
const total = computed(() => (props.bit.focusSeconds ?? 0) + (running.value ? focus.elapsed : 0))
const target = computed(() => (props.bit.size ? SIZE_MINUTES[props.bit.size] : null))
const fraction = computed(() => (target.value ? total.value / (target.value * 60) : 0))
const over = computed(() => fraction.value > 1)
const barLabel = computed(() => (target.value ? formatProgress(total.value, target.value) : ''))
/** The bar needs something to compare: a running timer or booked time. */
const showBar = computed(() => target.value !== null && (running.value || total.value > 0))
</script>

<template>
  <section class="focus" aria-label="Focus">
    <div class="focus__row">
      <div class="focus__main">
        <span v-if="running" class="focus__clock" role="timer">{{
          formatClock(focus.elapsed)
        }}</span>
        <span v-else-if="(bit.focusSeconds ?? 0) > 0" class="focus__total">
          {{ formatTracked(bit.focusSeconds ?? 0) }} tracked
        </span>
        <span v-else class="focus__total focus__total--empty">No focus time yet</span>
      </div>
      <button
        v-if="running"
        type="button"
        class="focus__btn focus__btn--stop pressable"
        aria-label="Stop focus"
        title="Stop focus"
        @click="focus.stop()"
      >
        <Square :size="13" fill="currentColor" aria-hidden="true" />
      </button>
      <button
        v-else
        type="button"
        class="focus__btn pressable"
        aria-label="Start focus"
        title="Start focus"
        @click="focus.start(bit.id)"
      >
        <Play :size="14" fill="currentColor" aria-hidden="true" />
      </button>
    </div>

    <div v-if="showBar" class="focus__bar" :class="{ 'focus__bar--over': over }">
      <div class="focus__bar-track" aria-hidden="true">
        <div class="focus__bar-fill" :style="{ width: Math.min(100, fraction * 100) + '%' }" />
      </div>
      <span class="focus__bar-label">{{ barLabel }}</span>
    </div>
  </section>
</template>

<style scoped>
.focus {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--material-stroke);
  border-radius: 14px;
  background-color: var(--fill-hover);
}

.focus__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.focus__clock {
  color: var(--text0);
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.focus__total {
  color: var(--text1);
  font-size: 0.9375rem;
  font-weight: 550;
  letter-spacing: -0.005em;
}
.focus__total--empty {
  color: var(--text2);
  font-weight: 450;
}

.focus__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex: none;
  border: none;
  border-radius: 999px;
  background-color: var(--brand);
  color: hsl(0 0% 100%);
  cursor: pointer;
  outline: none;
}
.focus__btn--stop {
  background-color: hsl(0 72% 52%);
}
.focus__btn:focus-visible {
  box-shadow:
    0 0 0 2px var(--surface1),
    0 0 0 4px var(--brand);
}

/* ── Progress against the size's guide time ─────────────────────────── */
.focus__bar {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.focus__bar-track {
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background-color: var(--fill-press);
}
.focus__bar-fill {
  height: 100%;
  border-radius: inherit;
  background-color: var(--brand);
  transition: width 0.4s ease;
}
.focus__bar--over .focus__bar-fill {
  background-color: hsl(32 95% 48%);
}
.focus__bar-label {
  color: var(--text2);
  font-size: 0.75rem;
  letter-spacing: 0.005em;
  font-variant-numeric: tabular-nums;
}
.focus__bar--over .focus__bar-label {
  color: hsl(32 90% 38%);
}

@media (prefers-reduced-motion: reduce) {
  .focus__bar-fill {
    transition: none;
  }
}
</style>
