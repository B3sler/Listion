import { describe, it, expect } from 'vitest'
import type { Bit } from '@/stores/bitStore'
import { computeLayout } from './useFlowLayout'
import { findSnapTarget, insertIndex } from './useStackDrag'

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

// Stack at (100,100): rows at y 140 / 176 / 212. Loose bit 4 at (600,100).
const layout = computeLayout({
  bits: [
    bit('1', '7', 0),
    bit('2', '7', 1),
    bit('3', '7', 2),
    bit('4', null, 0, 600, 100),
    bit('5', null, 0, 900, 900),
  ],
  packets: [{ id: '7', name: 'P', x: 100, y: 100 }],
})

describe('insertIndex', () => {
  it('teilt jede Zeile in obere/untere Hälfte', () => {
    expect(insertIndex(100 + 40 + 8, 100, 3)).toBe(0)
    expect(insertIndex(100 + 40 + 24, 100, 3)).toBe(1)
    expect(insertIndex(100 + 40 + 36 * 2 + 30, 100, 3)).toBe(3)
    expect(insertIndex(0, 100, 3)).toBe(0)
    expect(insertIndex(9999, 100, 3)).toBe(3)
  })
})

describe('findSnapTarget', () => {
  it('über einem Stapel → Einfügen an Pointer-Höhe', () => {
    expect(findSnapTarget({ x: 200, y: 182 }, '5', layout)).toEqual({
      kind: 'stack',
      packetId: '7',
      index: 1,
    })
  })

  it('zählt das gezogene Bit beim Umsortieren im eigenen Stapel nicht mit', () => {
    // dragging bit 1 out of its own stack to the very bottom: only 2 remain → index 2
    expect(findSnapTarget({ x: 200, y: 260 }, '1', layout)).toEqual({
      kind: 'stack',
      packetId: '7',
      index: 2,
    })
  })

  it('eigene Stapel-Zeilen werden ohne das gezogene Bit gezählt (nach unten)', () => {
    // bit 1 dragged: rendered stack is [bit 2 (row 0, 140–172), bit 3 (row 1, 176–208)];
    // y=166 is the lower half of row 0 → insert after bit 2
    expect(findSnapTarget({ x: 200, y: 166 }, '1', layout)).toEqual({
      kind: 'stack',
      packetId: '7',
      index: 1,
    })
  })

  it('eigene Stapel-Zeilen werden ohne das gezogene Bit gezählt (nach oben)', () => {
    // bit 3 dragged upward to y=150 (upper half of row 0 of [bit 1, bit 2]) → index 0
    expect(findSnapTarget({ x: 200, y: 150 }, '3', layout)).toEqual({
      kind: 'stack',
      packetId: '7',
      index: 0,
    })
  })

  it('knapp unter einer losen Kapsel → neues Packet darunter', () => {
    expect(findSnapTarget({ x: 700, y: 100 + 32 + 20 }, '5', layout)).toEqual({
      kind: 'pair',
      bitId: '4',
      position: 'below',
    })
  })

  it('knapp über einer losen Kapsel → neues Packet darüber', () => {
    expect(findSnapTarget({ x: 700, y: 100 - 20 }, '5', layout)).toEqual({
      kind: 'pair',
      bitId: '4',
      position: 'above',
    })
  })

  it('weit weg → kein Ziel; sich selbst ignorieren', () => {
    expect(findSnapTarget({ x: 2000, y: 2000 }, '5', layout)).toBeNull()
    expect(findSnapTarget({ x: 1000, y: 916 }, '5', layout)).toBeNull()
  })
})
