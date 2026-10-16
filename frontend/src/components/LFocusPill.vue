<script setup lang="ts">
import { computed } from 'vue'
import { Square } from 'lucide-vue-next'
import { useBitStore } from '@/stores/bitStore'
import { useFocusStore } from '@/stores/focusStore'
import { useSheetStore } from '@/stores/sheetStore'
import { formatClock } from '@/helpers/focusTime'
import { DEFAULT_COLOR } from '@/helpers/palette'

/** Longest title shown in the pill, ellipsis included. */
const TITLE_MAX = 18

const focus = useFocusStore()
const bitStore = useBitStore()
const sheet = useSheetStore()

const bit = computed(() => bitStore.bits.find((b) => b.id === focus.running?.bitId))
const fullTitle = computed(() => bit.value?.title ?? 'Bit')
const title = computed(() =>
  fullTitle.value.length > TITLE_MAX
    ? fullTitle.value.slice(0, TITLE_MAX - 1).trimEnd() + '…'
    : fullTitle.value,
)
</script>

<template>
  <div
    v-if="focus.running"
    class="focus-pill"
    :style="{ '--pill-color': bit?.color ?? DEFAULT_COLOR }"
  >
    <span class="focus-pill__dot" aria-hidden="true">●</span>
    <button
      type="button"
      class="focus-pill__title"
      :title="fullTitle"
      @click="sheet.openDetail(focus.running.bitId)"
    >
      {{ title }}
    </button>
    <span class="focus-pill__time" role="timer">{{ formatClock(focus.elapsed) }}</span>
    <button
      type="button"
      class="focus-pill__stop pressable"
      aria-label="Stop focus"
      title="Stop focus"
      @click="focus.stop()"
    >
      <Square :size="11" fill="currentColor" aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
/* Sits on the taskbar tab: light on the dark tab, dark on the light tab (like the tools) */
.focus-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  height: 28px;
  padding: 0 4px 0 10px;
  margin-right: 4px;
  border-radius: 999px;
  background-color: color-mix(in srgb, var(--surface1) 14%, transparent);
  color: var(--surface1);
  font-size: 0.8125rem;
  line-height: 1;
}

.focus-pill__dot {
  flex: none;
  color: var(--pill-color);
  font-size: 0.625rem;
}

.focus-pill__title {
  min-width: 0;
  padding: 2px 0;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
  cursor: pointer;
  outline: none;
}
.focus-pill__title:hover {
  text-decoration: underline;
}

.focus-pill__time {
  flex: none;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.focus-pill__stop {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  outline: none;
}
.focus-pill__stop:hover {
  background-color: color-mix(in srgb, var(--surface1) 18%, transparent);
}
.focus-pill__title:focus-visible,
.focus-pill__stop:focus-visible {
  box-shadow: 0 0 0 2px var(--brand);
  border-radius: 6px;
}
</style>
