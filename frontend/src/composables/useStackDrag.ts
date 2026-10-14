import { CAPSULE_H, STACK_HEADER_H, STEP_PITCH, type FlowLayout } from './useFlowLayout'

export type SnapTarget =
  | { kind: 'stack'; packetId: string; index: number }
  | { kind: 'pair'; bitId: string; position: 'above' | 'below' }

export const STACK_SNAP_MARGIN = 16
export const PAIR_SNAP_DISTANCE = 24

/** Index to insert before: upper half of row i → i, lower half → i + 1. */
export function insertIndex(pointerY: number, stackTop: number, count: number): number {
  const rel = pointerY - (stackTop + STACK_HEADER_H)
  const index = Math.floor((rel + STEP_PITCH / 2) / STEP_PITCH)
  return Math.max(0, Math.min(count, index))
}

/**
 * The stack index refers to the stack as rendered during the drag — without the dragged bit —
 * so rows are counted on the reduced list.
 */
export function findSnapTarget(
  probe: { x: number; y: number },
  draggedBitId: string,
  layout: FlowLayout,
): SnapTarget | null {
  for (const [packetId, rect] of layout.packetRects) {
    const m = STACK_SNAP_MARGIN
    const inside =
      probe.x >= rect.x - m &&
      probe.x <= rect.x + rect.w + m &&
      probe.y >= rect.y - m &&
      probe.y <= rect.y + rect.h + m
    if (!inside) continue
    const count = (layout.membersOf.get(packetId) ?? []).filter((b) => b.id !== draggedBitId).length
    return { kind: 'stack', packetId, index: insertIndex(probe.y, rect.y, count) }
  }

  let best: { target: SnapTarget; distance: number } | null = null
  for (const bitId of layout.looseBitIds) {
    if (bitId === draggedBitId) continue
    const r = layout.bitRects.get(bitId)
    if (!r) continue
    if (probe.x < r.x - STACK_SNAP_MARGIN || probe.x > r.x + r.w + STACK_SNAP_MARGIN) continue
    const centerY = r.y + CAPSULE_H / 2
    const reach = PAIR_SNAP_DISTANCE + CAPSULE_H
    const distance = Math.abs(probe.y - centerY)
    if (distance > reach) continue
    const position = probe.y >= centerY ? 'below' : 'above'
    if (!best || distance < best.distance)
      best = { target: { kind: 'pair', bitId, position }, distance }
  }
  return best?.target ?? null
}
