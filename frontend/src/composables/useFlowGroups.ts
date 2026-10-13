import type { Bit } from '@/stores/bitStore'
import type { Flow, Packet } from '@/types/flow'
import { unionRect, type FlowLayout, type Rect } from './useFlowLayout'

export const FLOW_PAD = 24
/** Extra room above the members for the name sitting on the top line. */
export const FLOW_LABEL_EXTRA = 8
/** Subtle flow colours; the first one is the default. */
export const FLOW_COLORS = [
  '#818cf8',
  '#34d399',
  '#fbbf24',
  '#f472b6',
  '#38bdf8',
  '#a3a3a3',
] as const

export interface Point {
  x: number
  y: number
}

export function rectCenter(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
}

/** Frame per flow: union of its loose bits and stacks, padded; flows without members get none. */
export function flowFrames(
  layout: FlowLayout,
  bits: Bit[],
  packets: Packet[],
  flows: Flow[],
): Map<number, Rect> {
  const loose = new Set(layout.looseBitIds)
  const frames = new Map<number, Rect>()
  for (const flow of flows) {
    const rects: Rect[] = []
    for (const b of bits) {
      if (b.flowId !== flow.id || !loose.has(b.id)) continue
      const r = layout.bitRects.get(b.id)
      if (r) rects.push(r)
    }
    for (const p of packets) {
      if (p.flowId !== flow.id) continue
      const r = layout.packetRects.get(p.id)
      if (r) rects.push(r)
    }
    const u = unionRect(rects)
    if (!u) continue
    frames.set(flow.id, {
      x: u.x - FLOW_PAD,
      y: u.y - FLOW_PAD - FLOW_LABEL_EXTRA,
      w: u.w + FLOW_PAD * 2,
      h: u.h + FLOW_PAD * 2 + FLOW_LABEL_EXTRA,
    })
  }
  return frames
}

/** Ray casting; works for concave lasso shapes. */
export function pointInPolygon(p: Point, poly: Point[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!
    const b = poly[j]!
    const crosses = a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    if (crosses) inside = !inside
  }
  return inside
}

export function pathLength(points: Point[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y)
  }
  return total
}

/** Loose bits and stacks whose centre lies inside the lasso; bits inside stacks come with their stack. */
export function lassoHits(
  poly: Point[],
  layout: FlowLayout,
): { bitIds: number[]; packetIds: number[] } {
  const bitIds = layout.looseBitIds.filter((id) => {
    const r = layout.bitRects.get(id)
    return r ? pointInPolygon(rectCenter(r), poly) : false
  })
  const packetIds = [...layout.packetRects.entries()]
    .filter(([, r]) => pointInPolygon(rectCenter(r), poly))
    .map(([id]) => id)
  return { bitIds, packetIds }
}

/** Flow whose frame contains the point; on overlap the newest (highest id) wins. */
export function flowAt(p: Point, frames: Map<number, Rect>, flows: Flow[]): number | null {
  let best: number | null = null
  for (const f of flows) {
    const r = frames.get(f.id)
    if (!r) continue
    const inside = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h
    if (inside && (best === null || f.id > best)) best = f.id
  }
  return best
}
