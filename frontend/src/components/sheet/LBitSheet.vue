<script setup lang="ts">
import { computed, onMounted, onUnmounted, useTemplateRef, watch } from 'vue'
import { SHEET_WIDTH, useSheetGesture } from '@/composables/useSheetGesture'
import { useBitStore } from '@/stores/bitStore'
import { useSheetStore } from '@/stores/sheetStore'
import { useToolStore } from '@/stores/toolStore'
import { DEFAULT_COLOR } from '@/helpers/palette'
import LCaptureView from './LCaptureView.vue'
import LBitDetailView from './LBitDetailView.vue'

const sheet = useSheetStore()
const bitStore = useBitStore()
const toolStore = useToolStore()

const root = useTemplateRef<HTMLElement>('root')
const detail = useTemplateRef<InstanceType<typeof LBitDetailView>>('detail')

// The sheet only leaves the store once it has slid out, so its content stays put on the way
const { x, open, close, onPointerDown } = useSheetGesture({ onClosed: () => sheet.close() })

// The canvas makes room live, finger and spring included (not the rubber band past open)
watch(
  x,
  (v) => {
    sheet.revealed = Math.min(SHEET_WIDTH, Math.max(0, SHEET_WIDTH + v))
  },
  { immediate: true },
)

// Every open request slides in, also one that catches the sheet on its way out. Switching
// between bits of an already open sheet leaves it where it is (only the content cross-fades).
const stopActions = sheet.$onAction(({ name, after }) => {
  if (name === 'openCapture' || name === 'openDetail') after(() => open())
})

const bit = computed(() =>
  sheet.view === 'detail' ? (bitStore.bits.find((b) => b.id === sheet.bitId) ?? null) : null,
)

const label = computed(() => (bit.value ? `Bit: ${bit.value.title}` : 'New Bits'))

/** Header tint: the bit's colour, in capture the colour the next bit gets. */
const tint = computed(() => bit.value?.color ?? DEFAULT_COLOR)

/** Content key: a different bit (or view) cross-fades instead of sliding the sheet again. */
const paneKey = computed(() => (sheet.view === 'detail' ? `bit-${sheet.bitId}` : 'capture'))

function isEditable(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('input, textarea, select, [contenteditable]')
}

// Esc closes an open chip first, then the sheet. A picker with focus inside handles its Esc
// itself (and stops it); this covers focus anywhere else, also outside the sheet. Registered
// before LWorkspace's own keydown, so the tool state is still the one Esc was meant for.
function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.isComposing || event.defaultPrevented || !sheet.open) return
  const target = event.target instanceof Node ? event.target : null
  const inside = !!target && !!root.value?.contains(target)
  if (!inside) {
    // there, Esc belongs to the flow tool, the filter or the field being edited
    if (toolStore.activeTool === 'flow' || toolStore.filterOpen || isEditable(event.target)) return
  }
  if (detail.value?.closeOpenChip()) return
  close()
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  // a store opened before this sheet existed still slides in
  if (sheet.open) open()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  stopActions()
  sheet.revealed = 0
})
</script>

<template>
  <Transition name="sheet-fade">
    <aside
      v-if="sheet.open"
      ref="root"
      class="sheet material--thick"
      role="dialog"
      aria-modal="false"
      :aria-label="label"
      :style="{ '--c': tint, transform: `translateX(${x}px)` }"
      @pointerdown="onPointerDown"
    >
      <Transition name="sheet-swap">
        <LBitDetailView
          v-if="sheet.view === 'detail' && sheet.bitId !== null"
          ref="detail"
          :key="paneKey"
          class="sheet__pane"
          :bit-id="sheet.bitId"
          :can-go-back="sheet.series.length > 0"
          @back="sheet.backToCapture()"
          @close="close()"
          @open-bit="sheet.openDetail"
        />
        <LCaptureView v-else :key="paneKey" class="sheet__pane" @close="close()" />
      </Transition>
    </aside>
  </Transition>
</template>

<style scoped>
/* Docked left, full height; a parallel layer without a scrim, so the canvas stays usable */
.sheet {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  width: 320px;
  border: 1px solid var(--material-stroke);
  border-left: none;
  border-radius: 0 22px 22px 0;
  overflow: hidden;
  /* vertical scrolling stays native; horizontal drags belong to the swipe gesture */
  touch-action: pan-y;
  will-change: transform;
}

/* Colour tint: the header picks up the bit's colour and fades out below it */
.sheet::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 120px;
  background: linear-gradient(to bottom, color-mix(in srgb, var(--c) 8%, transparent), transparent);
  pointer-events: none;
}

.sheet__pane {
  position: relative;
  flex: 1;
  min-height: 0;
}

/* Another bit (or capture ↔ detail): the content cross-fades, the sheet stays */
.sheet-swap-enter-active,
.sheet-swap-leave-active {
  transition: opacity 150ms ease;
}
.sheet-swap-leave-active {
  position: absolute;
  inset: 0;
}
.sheet-swap-enter-from,
.sheet-swap-leave-to {
  opacity: 0;
}

/* Reduced motion: the gesture jumps instead of sliding, the sheet fades in and out instead */
@media (prefers-reduced-motion: reduce) {
  .sheet-fade-enter-active,
  .sheet-fade-leave-active {
    transition: opacity 200ms ease;
  }
  .sheet-fade-enter-from,
  .sheet-fade-leave-to {
    opacity: 0;
  }
}

@media (prefers-reduced-transparency: reduce) {
  .sheet {
    background-color: var(--surface1);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}

@media (prefers-contrast: more) {
  .sheet {
    background-color: var(--surface1);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    border-color: var(--text2);
  }
}
</style>
