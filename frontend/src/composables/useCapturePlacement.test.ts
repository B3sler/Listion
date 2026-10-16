import { describe, it, expect } from 'vitest'
import type { Bit } from '@/stores/bitStore'
import type { Packet } from '@/types/flow'
import { CAPSULE_H, CAPSULE_W, computeLayout } from './useFlowLayout'
import { nextSlot } from './useCapturePlacement'

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

const layoutOf = (bits: Bit[] = [], packets: Packet[] = []) => computeLayout({ bits, packets })

describe('nextSlot', () => {
  it('legt den ersten Slot zentriert auf den Klickpunkt', () => {
    expect(nextSlot({ x: 300, y: 200 }, null, CAPSULE_H, layoutOf())).toEqual({
      x: 300 - CAPSULE_W / 2,
      y: 200 - CAPSULE_H / 2,
    })
  })

  it('zentriert auch eine höhere Capsule auf den Klickpunkt', () => {
    expect(nextSlot({ x: 300, y: 200 }, null, 64, layoutOf())).toEqual({ x: 200, y: 168 })
  })

  it('legt den zweiten Slot 12 px unter das vorige Rechteck', () => {
    const prev = { x: 200, y: 184, w: CAPSULE_W, h: 44 }
    const layout = layoutOf([bit('1', 200, 184, { size: 2 })])
    expect(nextSlot({ x: 300, y: 200 }, prev, CAPSULE_H, layout)).toEqual({ x: 200, y: 240 })
  })

  it('rutscht unter ein Bit, das direkt im Weg liegt', () => {
    const layout = layoutOf([bit('1', 150, 190)])
    // the slot (200, 184) overlaps the bit 150…350 × 190…222
    expect(nextSlot({ x: 300, y: 200 }, null, CAPSULE_H, layout)).toEqual({ x: 200, y: 230 })
  })

  it('hält 8 px Abstand: ein Bit knapp darüber schiebt den Slot ebenfalls', () => {
    // bottom edge 180, the slot starts at 184: closer than 8 px
    const layout = layoutOf([bit('1', 200, 148)])
    expect(nextSlot({ x: 300, y: 200 }, null, CAPSULE_H, layout)).toEqual({ x: 200, y: 188 })
  })

  it('lässt ein Bit mit genug Abstand daneben in Ruhe', () => {
    const layout = layoutOf([bit('1', 200 + CAPSULE_W + 8, 184)])
    expect(nextSlot({ x: 300, y: 200 }, null, CAPSULE_H, layout)).toEqual({ x: 200, y: 184 })
  })

  it('landet bei zwei Hindernissen hintereinander unter beiden', () => {
    const layout = layoutOf([bit('1', 200, 184), bit('2', 120, 224, { size: 3 })])
    // under bit 1 (216 + 8 = 224) the slot still hits bit 2 (224…288), so under that one
    expect(nextSlot({ x: 300, y: 200 }, null, CAPSULE_H, layout)).toEqual({ x: 200, y: 296 })
  })

  it('weicht auch einem Stapel aus', () => {
    const packets: Packet[] = [{ id: 'p', name: 'Stack', x: 180, y: 150 }]
    const layout = layoutOf([bit('1', 0, 0, { packetId: 'p' })], packets)
    const stack = layout.packetRects.get('p')!
    expect(nextSlot({ x: 300, y: 200 }, null, CAPSULE_H, layout)).toEqual({
      x: 200,
      y: stack.y + stack.h + 8,
    })
  })
})
