import { computed, type ComputedRef } from 'vue'
import { useBitStore } from '@/stores/bitStore'
import { usePacketStore } from '@/stores/packetStore'
import { useSheetStore } from '@/stores/sheetStore'
import { CAPSULE_W, computeLayout, type FlowLayout, type Rect } from './useFlowLayout'

/** Space between two bits of a series. */
const SERIES_GAP = 12
/** Clearance a slot keeps around existing bits and stacks. */
const CLEARANCE = 8

function overlaps(a: Rect, b: Rect, margin: number): boolean {
  return (
    a.x - margin < b.x + b.w &&
    a.x + a.w + margin > b.x &&
    a.y - margin < b.y + b.h &&
    a.y + a.h + margin > b.y
  )
}

/**
 * Where the next captured bit lands (top-left corner). The first one is centred on the click
 * point, each further one sits 12 px below the previous. A slot that comes closer than 8 px to a
 * bit or stack slides below it, until it is free. Every step moves down, so this ends.
 */
export function nextSlot(
  origin: { x: number; y: number },
  prev: Rect | null,
  height: number,
  layout: FlowLayout,
): { x: number; y: number } {
  const slot: Rect = prev
    ? { x: prev.x, y: prev.y + prev.h + SERIES_GAP, w: CAPSULE_W, h: height }
    : { x: origin.x - CAPSULE_W / 2, y: origin.y - height / 2, w: CAPSULE_W, h: height }
  const obstacles = [...layout.bitRects.values(), ...layout.packetRects.values()]
  let moved = true
  while (moved) {
    moved = false
    for (const rect of obstacles) {
      if (overlaps(slot, rect, CLEARANCE)) {
        slot.y = rect.y + rect.h + CLEARANCE
        moved = true
      }
    }
  }
  return { x: slot.x, y: slot.y }
}

/** The live slot of the next bit of the open capture series, for a capsule of `height`. */
export function useCapturePlacement(height: () => number): ComputedRef<{ x: number; y: number }> {
  const bitStore = useBitStore()
  const packetStore = usePacketStore()
  const sheet = useSheetStore()
  const layout = computed(() =>
    computeLayout({ bits: bitStore.visibleBits, packets: packetStore.packets }),
  )
  return computed(() => nextSlot(sheet.origin, sheet.lastRect, height(), layout.value))
}
