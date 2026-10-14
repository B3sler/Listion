import { describe, it, expect } from 'vitest'
import type { Bit } from '@/stores/bitStore'
import type { Flow, Packet } from '@/types/flow'
import { computeLayout } from './useFlowLayout'
import { flowAt, flowFrames, lassoHits, pathLength, pointInPolygon } from './useFlowGroups'

const bit = (id: string, x: number, y: number, extra: Partial<Bit> = {}): Bit => ({
  id,
  title: `B${id}`,
  status: 0,
  x,
  y,
  packetId: null,
  order: 0,
  createdAt: '',
  ...extra,
})

// loose bits 1 (0,0) and 2 (300,0) in flow f5; stack p7 at (0,200) with bits 3,4 in flow 5
const bits = [
  bit('1', 0, 0, { flowId: 'f5' }),
  bit('2', 300, 0, { flowId: 'f5' }),
  bit('3', 0, 0, { packetId: 'p7' }),
  bit('4', 0, 0, { packetId: 'p7', order: 1 }),
  bit('6', 900, 900),
]
const packets: Packet[] = [{ id: 'p7', name: 'P', x: 0, y: 200, flowId: 'f5' }]
const flows: Flow[] = [{ id: 'f5', name: 'F', color: '#818cf8' }]
const layout = computeLayout({ bits, packets, expandedBitId: null })

describe('flowFrames', () => {
  it('umschließt alle Mitglieder mit Abstand und Platz für den Namen', () => {
    // members span x 0…500, y 0…316 (stack 236×116 at y 200)
    expect(flowFrames(layout, bits, packets, flows).get('f5')).toEqual({
      x: -24,
      y: -32,
      w: 548,
      h: 372,
    })
  })

  it('ohne Mitglieder kein Rahmen', () => {
    expect(
      flowFrames(layout, bits, packets, [{ id: 'f9', name: 'X', color: '#818cf8' }]).size,
    ).toBe(0)
  })
})

describe('pointInPolygon', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ]
  // a "C" shape whose opening is at x 4…10, y 4…6
  const concave = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 4 },
    { x: 4, y: 4 },
    { x: 4, y: 6 },
    { x: 10, y: 6 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ]
  it('konvex und konkav', () => {
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true)
    expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false)
    expect(pointInPolygon({ x: 2, y: 5 }, concave)).toBe(true)
    expect(pointInPolygon({ x: 7, y: 5 }, concave)).toBe(false)
  })
})

describe('lassoHits', () => {
  it('trifft lose Bits und Stapel über ihren Mittelpunkt, nicht Bits im Stapel', () => {
    const lasso = [
      { x: -10, y: -10 },
      { x: 250, y: -10 },
      { x: 250, y: 400 },
      { x: -10, y: 400 },
    ]
    expect(lassoHits(lasso, layout)).toEqual({ bitIds: ['1'], packetIds: ['p7'] })
  })
})

describe('pathLength', () => {
  it('summiert die Segmente', () => {
    expect(
      pathLength([
        { x: 0, y: 0 },
        { x: 3, y: 4 },
        { x: 3, y: 10 },
      ]),
    ).toBe(11)
  })
})

describe('flowAt', () => {
  const frames = new Map([
    ['f5', { x: 0, y: 0, w: 100, h: 100 }],
    ['f8', { x: 50, y: 50, w: 100, h: 100 }],
  ])
  const two: Flow[] = [
    { id: 'f5', name: 'A', color: '#818cf8' },
    { id: 'f8', name: 'B', color: '#818cf8' },
  ]
  it('liefert den Flow unter dem Punkt, bei Überlappung den jüngsten', () => {
    expect(flowAt({ x: 10, y: 10 }, frames, two)).toBe('f5')
    expect(flowAt({ x: 75, y: 75 }, frames, two)).toBe('f8')
    expect(flowAt({ x: 500, y: 500 }, frames, two)).toBeNull()
  })
})
