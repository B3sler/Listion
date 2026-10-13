import type { Bit } from '@/stores/bitStore'
import type { NodeRef, Packet } from '@/types/flow'

export const CAPSULE_W = 200
export const CAPSULE_H = 32
export const CAPSULE_EXPANDED_EXTRA = 20
export const STEP_GAP = 4
export const STACK_PAD = 8
export const STACK_HEADER_H = 40
export const STEP_NUM_W = 20
export const STACK_W = STACK_PAD * 2 + STEP_NUM_W + CAPSULE_W
export const STEP_PITCH = CAPSULE_H + STEP_GAP
/** Space opened between steps while a capsule hovers over a stack. */
export const INSERT_GAP = STEP_PITCH

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface FlowLayout {
  bitRects: Map<number, Rect>
  packetRects: Map<number, Rect>
  /** Members of each existing packet, in step order. */
  membersOf: Map<number, Bit[]>
  looseBitIds: number[]
}

export function capsuleHeight(expanded: boolean): number {
  return CAPSULE_H + (expanded ? CAPSULE_EXPANDED_EXTRA : 0)
}

/** Vertical layout inside a stack, relative to its top edge. */
export function stackGeometry(
  count: number,
  expandedIndex: number | null,
  gapIndex: number | null,
): { offsets: number[]; gapY: number | null; height: number } {
  const offsets: number[] = []
  let gapY: number | null = null
  let y = STACK_HEADER_H
  for (let i = 0; i < count; i++) {
    if (gapIndex === i) {
      gapY = y + (INSERT_GAP - STEP_GAP) / 2
      y += INSERT_GAP
    }
    offsets.push(y)
    y += capsuleHeight(i === expandedIndex) + STEP_GAP
  }
  if (gapIndex !== null && gapIndex >= count) {
    gapY = y + (INSERT_GAP - STEP_GAP) / 2
    y += INSERT_GAP
  }
  const height =
    count === 0 && gapIndex === null ? STACK_HEADER_H + STACK_PAD : y - STEP_GAP + STACK_PAD
  return { offsets, gapY, height }
}

export function computeLayout(input: {
  bits: Bit[]
  packets: Packet[]
  expandedBitId: number | null
}): FlowLayout {
  const packetIds = new Set(input.packets.map((p) => p.id))
  const membersOf = new Map<number, Bit[]>()
  const looseBitIds: number[] = []
  for (const bit of input.bits) {
    if (bit.packetId != null && packetIds.has(bit.packetId)) {
      const list = membersOf.get(bit.packetId) ?? []
      list.push(bit)
      membersOf.set(bit.packetId, list)
    } else {
      looseBitIds.push(bit.id)
    }
  }
  for (const list of membersOf.values()) list.sort((a, b) => a.order - b.order || a.id - b.id)

  const bitRects = new Map<number, Rect>()
  const packetRects = new Map<number, Rect>()

  for (const packet of input.packets) {
    const members = membersOf.get(packet.id)
    if (!members) continue
    const expandedIndex = members.findIndex((b) => b.id === input.expandedBitId)
    const geo = stackGeometry(members.length, expandedIndex === -1 ? null : expandedIndex, null)
    packetRects.set(packet.id, { x: packet.x, y: packet.y, w: STACK_W, h: geo.height })
    members.forEach((bit, i) => {
      bitRects.set(bit.id, {
        x: packet.x + STACK_PAD + STEP_NUM_W,
        y: packet.y + geo.offsets[i]!,
        w: CAPSULE_W,
        h: capsuleHeight(bit.id === input.expandedBitId),
      })
    })
  }

  for (const bit of input.bits) {
    if (bitRects.has(bit.id)) continue
    bitRects.set(bit.id, {
      x: bit.x ?? 0,
      y: bit.y ?? 0,
      w: CAPSULE_W,
      h: capsuleHeight(bit.id === input.expandedBitId),
    })
  }

  return { bitRects, packetRects, membersOf, looseBitIds }
}

/** Arrow attachment point: right edge for "out", left edge for "in". */
export function anchor(
  layout: FlowLayout,
  ref: NodeRef,
  end: 'out' | 'in',
): { x: number; y: number } | null {
  const rect = ref.type === 'bit' ? layout.bitRects.get(ref.id) : layout.packetRects.get(ref.id)
  if (!rect) return null
  // bits attach at the middle of the (collapsed) capsule row, packets at the header row
  const y = ref.type === 'bit' ? rect.y + CAPSULE_H / 2 : rect.y + 20
  return { x: end === 'out' ? rect.x + rect.w : rect.x, y }
}

export function dependencyGeometry(
  from: { x: number; y: number },
  to: { x: number; y: number },
): { d: string; mx: number; my: number; tx: number; ty: number; angle: number } {
  const dx = Math.max(40, Math.abs(to.x - from.x) / 2)
  const c1 = { x: from.x + dx, y: from.y }
  const c2 = { x: to.x - dx, y: to.y }
  // cubic Bézier at t = 0.5
  const mx = 0.125 * from.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * to.x
  const my = 0.125 * from.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * to.y
  const angle = (Math.atan2(to.y - c2.y, to.x - c2.x) * 180) / Math.PI
  return {
    d: `M ${from.x} ${from.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${to.x} ${to.y}`,
    mx,
    my,
    tx: to.x,
    ty: to.y,
    angle,
  }
}

export function unionRect(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null
  const minX = Math.min(...rects.map((r) => r.x))
  const minY = Math.min(...rects.map((r) => r.y))
  const maxX = Math.max(...rects.map((r) => r.x + r.w))
  const maxY = Math.max(...rects.map((r) => r.y + r.h))
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}
