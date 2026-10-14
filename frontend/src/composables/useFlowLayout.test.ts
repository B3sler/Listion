import { describe, it, expect } from 'vitest'
import type { Bit } from '@/stores/bitStore'
import {
  anchor,
  computeLayout,
  dependencyGeometry,
  stackGeometry,
  ARROW_LEN,
  unionRect,
  STACK_W,
} from './useFlowLayout'

const bit = (id: string, packetId: string | null = null, order = 0, x = 0, y = 0): Bit => ({
  id,
  title: `B${id}`,
  status: 0,
  x,
  y,
  packetId,
  order,
  createdAt: '',
})

describe('stackGeometry', () => {
  it('stapelt Schritte unter dem Kopf', () => {
    expect(stackGeometry(3, null, null)).toEqual({
      offsets: [40, 76, 112],
      gapY: null,
      height: 152,
    })
  })
  it('schiebt Folgeschritte unter einer aufgeklappten Kapsel nach unten', () => {
    expect(stackGeometry(3, 0, null).offsets).toEqual([40, 96, 132])
  })
  it('öffnet eine Lücke an der Einfügeposition', () => {
    const g = stackGeometry(3, null, 1)
    expect(g.offsets).toEqual([40, 112, 148])
    expect(g.gapY).toBe(92)
    expect(g.height).toBe(188)
    expect(stackGeometry(2, null, 2).gapY).toBe(76 + 32 + 4 + 16)
  })
})

describe('computeLayout', () => {
  const bits = [
    bit('1', '7', 1),
    bit('2', '7', 0),
    bit('3', null, 0, 10, 20),
    bit('4', '99', 0, 5, 6),
  ]
  const layout = computeLayout({
    bits,
    packets: [{ id: '7', name: 'P', x: 100, y: 100 }],
    expandedBitId: null,
  })

  it('ordnet Stapel-Mitglieder nach order und positioniert sie im Stapel', () => {
    expect(layout.membersOf.get('7')!.map((b) => b.id)).toEqual(['2', '1'])
    expect(layout.bitRects.get('2')).toEqual({ x: 128, y: 140, w: 200, h: 32 })
    expect(layout.packetRects.get('7')).toEqual({ x: 100, y: 100, w: STACK_W, h: 116 })
  })

  it('behandelt Bits ohne existierendes Packet als lose', () => {
    expect(layout.looseBitIds).toEqual(['3', '4'])
    expect(layout.bitRects.get('4')).toEqual({ x: 5, y: 6, w: 200, h: 32 })
  })

  it('liefert Anker an rechter/linker Kante', () => {
    expect(anchor(layout, { type: 'bit', id: '3' }, 'out')).toEqual({ x: 210, y: 36 })
    expect(anchor(layout, { type: 'bit', id: '3' }, 'in')).toEqual({ x: 10, y: 36 })
    expect(anchor(layout, { type: 'packet', id: '7' }, 'out')).toEqual({ x: 336, y: 120 })
    expect(anchor(layout, { type: 'packet', id: '7' }, 'in')).toEqual({ x: 100, y: 120 })
    expect(anchor(layout, { type: 'bit', id: '404' }, 'in')).toBeNull()
  })

  it('vereinigt Rechtecke', () => {
    expect(unionRect([...layout.bitRects.values()])).toEqual({ x: 5, y: 6, w: 323, h: 202 })
    expect(unionRect([])).toBeNull()
  })
})

describe('dependencyGeometry', () => {
  it('zeichnet eine horizontale Bézier, die an der Basis der Pfeilspitze endet', () => {
    const g = dependencyGeometry({ x: 0, y: 0 }, { x: 200, y: 0 })
    // the line stops ARROW_LEN before the tip, so it never shows through the arrowhead
    expect(g.d).toBe(`M 0 0 C 100 0 100 0 ${200 - ARROW_LEN} 0`)
    expect(g.tx).toBe(200)
    expect(g.mx).toBe(100)
    expect(g.angle).toBe(0)
  })
})
