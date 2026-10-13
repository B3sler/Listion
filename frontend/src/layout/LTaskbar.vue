<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Lasso, ListFilter, MousePointer2 } from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme.ts'
import { useToolStore } from '@/stores/toolStore'
import LFilterPopover from '@/components/LFilterPopover.vue'

const { isDark } = useTheme()
const toolStore = useToolStore()

// Dark taskbar in light mode → light logo; light taskbar in dark mode → dark logo
const logoSrc = computed(() =>
  isDark.value ? '/listion/listion_written_dark.svg' : '/listion/listion_written_light.svg',
)

const filterGroup = ref<HTMLElement | null>(null)

// a click anywhere outside the filter button/popover closes it
function onDocumentPointerDown(e: PointerEvent) {
  if (!toolStore.filterOpen) return
  if (filterGroup.value && !filterGroup.value.contains(e.target as Node)) {
    toolStore.filterOpen = false
  }
}

// capture phase: canvas gestures stop propagation, so a bubble listener would miss their presses
onMounted(() => document.addEventListener('pointerdown', onDocumentPointerDown, true))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocumentPointerDown, true))
</script>

<template>
  <div class="fixed top-0 left-0 w-full h-14 flex z-60">
    <div class="flex flex-1 justify-end z-60">
      <svg
        class="h-6"
        style="color: var(--taskbar)"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1024 1024"
      >
        <path d="M1024,1024C1024,458,566,0,0,0h1024v1024Z" fill="currentColor" />
      </svg>
    </div>
    <div
      class="flex-[0.7] grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center rounded-b-2xl bg-taskbar shadow-lg px-3"
    >
      <div class="flex items-center gap-1">
        <button
          class="tool pressable"
          :class="{ 'tool--active': toolStore.activeTool === 'select' }"
          type="button"
          aria-label="Select"
          title="Select (V)"
          :aria-pressed="toolStore.activeTool === 'select'"
          @click="toolStore.setTool('select')"
        >
          <MousePointer2 :size="17" />
        </button>
        <button
          class="tool pressable"
          :class="{ 'tool--active': toolStore.activeTool === 'flow' }"
          type="button"
          aria-label="Flow"
          title="Flow (F)"
          :aria-pressed="toolStore.activeTool === 'flow'"
          @click="toolStore.setTool('flow')"
        >
          <Lasso :size="17" />
        </button>
      </div>
      <img :src="logoSrc" alt="Listion Logo" class="h-8" />
      <div ref="filterGroup" class="relative flex items-center justify-end">
        <button
          class="tool pressable"
          :class="{ 'tool--active': toolStore.filterOpen }"
          type="button"
          aria-label="Filter"
          title="Filter"
          aria-haspopup="dialog"
          :aria-expanded="toolStore.filterOpen"
          @click="toolStore.filterOpen = !toolStore.filterOpen"
        >
          <ListFilter :size="17" />
          <span v-if="toolStore.activeFilterCount > 0" class="tool__badge">
            {{ toolStore.activeFilterCount }}
          </span>
        </button>
        <Transition name="filter-pop">
          <LFilterPopover
            v-if="toolStore.filterOpen"
            :filters="toolStore.filters"
            @toggle="(group, value) => toolStore.toggleFilter(group, value as never)"
            @reset="toolStore.resetFilters()"
          />
        </Transition>
      </div>
    </div>
    <div class="flex-1">
      <svg
        class="h-6"
        style="color: var(--taskbar)"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1024 1024"
      >
        <path d="M0,0h1024C458,0,0,458,0,1024V0Z" fill="currentColor" />
      </svg>
    </div>
  </div>
</template>

<style scoped>
/* Tool icons take the logo's contrast: light on the dark tab, dark on the light tab */
.tool {
  position: relative;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--surface1);
  background: transparent;
  cursor: pointer;
}
.tool:hover {
  background: color-mix(in srgb, var(--surface1) 10%, transparent);
}
.tool--active,
.tool--active:hover {
  background: color-mix(in srgb, var(--surface1) 16%, transparent);
}
.tool__badge {
  position: absolute;
  top: 1px;
  right: 0;
  min-width: 15px;
  height: 15px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--brand);
  color: hsl(0 0% 100%);
  font-size: 9.5px;
  font-weight: 700;
  line-height: 15px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.filter-pop-enter-active {
  transition:
    opacity 0.15s ease,
    transform var(--spring-duration) var(--ease-spring);
}
.filter-pop-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.15s ease;
}
.filter-pop-enter-from,
.filter-pop-leave-to {
  opacity: 0;
  transform: scale(0.92);
}
</style>
