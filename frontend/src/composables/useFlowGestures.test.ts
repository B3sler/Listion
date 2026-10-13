import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { computed, ref } from 'vue'
import type { Bit } from '@/stores/bitStore'
import type { Packet } from '@/types/flow'
import { computeLayout } from './useFlowLayout'
import { useFlowGestures } from './useFlowGestures'

const bit = (id: number, packetId: number | null, order: number, x = 0, y = 0): Bit => ({
  id,
  title: `B${id}`,
  status: 0,
  x,
  y,
  packetId,
  order,
  createdAt: '',
})

function pointer(type: string, x: number, y: number) {
  return new PointerEvent(type, {
    clientX: x,
    clientY: y,
    pointerId: 1,
    button: 0,
    pointerType: 'mouse',
    bubbles: true,
  })
}

// Controls performance.now(), which VelocityTracker reads for release velocity
let clock = 0

function setup(options: { zoom?: number; bits?: Bit[]; packets?: Packet[] } = {}) {
  const layout = computed(() =>
    computeLayout({
      bits: options.bits ?? [bit(1, null, 0, 0, 0), bit(2, null, 0, 0, 300)],
      packets: options.packets ?? [],
      expandedBitId: null,
    }),
  )
  const opts = {
    toCanvas: (x: number, y: number) => ({ x, y }),
    zoom: ref(options.zoom ?? 1),
    layout,
    onTapBit: vi.fn(),
    onDropBit: vi.fn().mockResolvedValue(undefined),
    onMovePacketEnd: vi.fn().mockResolvedValue(undefined),
    onCreateDependency: vi.fn(),
    onLassoEnd: vi.fn(),
    onMoveFlowEnd: vi.fn().mockResolvedValue(undefined),
  }
  return { opts, g: useFlowGestures(opts) }
}

/** Makes document.elementFromPoint report `el` under every point. */
function stubNodeUnder(el: HTMLElement) {
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => el })
}

function nodeElement(type: 'bit' | 'packet', id: number) {
  const el = document.createElement('div')
  el.dataset.nodeType = type
  el.dataset.nodeId = String(id)
  return el
}

/**
 * Drags bit 2 (loose, at y=300) right by 100px in 32ms, then releases it at rest on
 * empty canvas. Returns the arguments of the onDropBit call.
 */
function freeDropOfBit2(zoom: number) {
  const { opts, g } = setup({ zoom })
  clock = 0
  g.startBitPointer(pointer('pointerdown', 10, 300), 2)
  clock = 16
  window.dispatchEvent(pointer('pointermove', 60, 300))
  clock = 32
  window.dispatchEvent(pointer('pointermove', 110, 300))
  clock = 40
  window.dispatchEvent(pointer('pointerup', 110, 300))
  return opts.onDropBit.mock.calls[0]!
}

beforeEach(() => {
  clock = 0
  vi.spyOn(performance, 'now').mockImplementation(() => clock)
})

afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(document, 'elementFromPoint')
})

describe('useFlowGestures', () => {
  it('ein Klick ohne Bewegung ist ein Tap', () => {
    const { opts, g } = setup()
    g.startBitPointer(pointer('pointerdown', 10, 10), 1)
    window.dispatchEvent(pointer('pointerup', 11, 11))
    expect(opts.onTapBit).toHaveBeenCalledWith(1)
    expect(opts.onDropBit).not.toHaveBeenCalled()
  })

  it('pointercancel ohne Bewegung ist kein Tap', () => {
    const { opts, g } = setup()
    g.startBitPointer(pointer('pointerdown', 10, 10), 1)
    window.dispatchEvent(pointer('pointercancel', 10, 10))
    expect(opts.onTapBit).not.toHaveBeenCalled()
    expect(opts.onDropBit).not.toHaveBeenCalled()
    expect(g.bitDrag.value).toBeNull()
  })

  it('ziehen folgt dem Pointer mit Greif-Versatz und erkennt Snap auf lose Kapsel', async () => {
    const { opts, g } = setup()
    g.startBitPointer(pointer('pointerdown', 10, 300), 2)
    // grabbed 10px from the left edge, at the top edge → grab offset (10, 0)
    window.dispatchEvent(pointer('pointermove', 60, 100))
    window.dispatchEvent(pointer('pointermove', 60, 40))
    expect(g.bitDrag.value).toMatchObject({ bitId: 2, x: 50, y: 40 })
    // probe = capsule centre (150, 56) is 40px below bit 1's centre → pair snap
    expect(g.bitDrag.value!.target).toEqual({ kind: 'pair', bitId: 1, position: 'below' })
    window.dispatchEvent(pointer('pointerup', 60, 40))
    await Promise.resolve()
    expect(opts.onDropBit).toHaveBeenCalledWith(
      2,
      { kind: 'pair', bitId: 1, position: 'below' },
      { x: 50, y: 40 },
    )
  })

  it('ein freier Drop gleitet in Wurfrichtung weiter', () => {
    // release velocity 100px / 32ms = 3125 px/s → glide 3125 * 0.985 / 15 ≈ 205px
    const [bitId, target, pos] = freeDropOfBit2(1)
    expect(bitId).toBe(2)
    expect(target).toBeNull()
    // raw drag position is x = 100, y = 300; the glide moves it further right only
    expect(pos.x).toBeCloseTo(305.21, 1)
    expect(pos.y).toBeCloseTo(300, 5)
  })

  it('der Zoom teilt die Wurfgeschwindigkeit, der Gleitweg wird kürzer', () => {
    const [, , atZoom1] = freeDropOfBit2(1)
    const [, , atZoom2] = freeDropOfBit2(2)
    expect(atZoom2.x).toBeLessThan(atZoom1.x)
    expect(atZoom2.x).toBeCloseTo(202.6, 1)
  })

  it('ziehen eines Stacks folgt dem Pointer und ruft onMovePacketEnd beim Loslassen', () => {
    const { opts, g } = setup({
      bits: [bit(1, 7, 0), bit(2, 7, 1)],
      packets: [{ id: 7, name: 'P', x: 100, y: 100 }],
    })
    g.startPacketPointer(pointer('pointerdown', 110, 110), 7)
    clock = 10
    window.dispatchEvent(pointer('pointermove', 160, 150))
    // grab offset (10, 10) from the stack's top-left corner at (100, 100)
    expect(g.packetDrag.value).toEqual({ packetId: 7, x: 150, y: 140 })
    // release after the pointer rested: no momentum, so the stack stays where dropped
    clock = 100
    window.dispatchEvent(pointer('pointerup', 160, 150))
    expect(opts.onMovePacketEnd).toHaveBeenCalledWith(7, 150, 140)
    expect(g.packetDrag.value).toBeNull()
  })

  it('ein Pfeil von einer Kapsel zu einem Stack erzeugt eine Abhängigkeit', () => {
    const { opts, g } = setup()
    stubNodeUnder(nodeElement('packet', 7))
    g.startLinkPointer(pointer('pointerdown', 10, 10), { type: 'bit', id: 1 })
    clock = 10
    window.dispatchEvent(pointer('pointermove', 60, 60))
    expect(g.linkDrag.value).toEqual({ from: { type: 'bit', id: 1 }, x: 60, y: 60 })
    window.dispatchEvent(pointer('pointerup', 60, 60))
    expect(opts.onCreateDependency).toHaveBeenCalledWith(
      { type: 'bit', id: 1 },
      { type: 'packet', id: 7 },
    )
    expect(g.linkDrag.value).toBeNull()
  })

  it('ein Klick auf einen Pfeil ohne Bewegung erzeugt keine Abhängigkeit', () => {
    const { opts, g } = setup()
    stubNodeUnder(nodeElement('packet', 7))
    g.startLinkPointer(pointer('pointerdown', 10, 10), { type: 'bit', id: 1 })
    window.dispatchEvent(pointer('pointerup', 10, 10))
    expect(opts.onCreateDependency).not.toHaveBeenCalled()
    expect(g.linkDrag.value).toBeNull()
  })

  it('ein Pfeil auf denselben Knoten erzeugt keine Abhängigkeit', () => {
    const { opts, g } = setup()
    stubNodeUnder(nodeElement('bit', 1))
    g.startLinkPointer(pointer('pointerdown', 10, 10), { type: 'bit', id: 1 })
    window.dispatchEvent(pointer('pointermove', 60, 60))
    window.dispatchEvent(pointer('pointerup', 60, 60))
    expect(opts.onCreateDependency).not.toHaveBeenCalled()
  })

  it('pointercancel beendet einen Drag sauber ohne Callbacks', async () => {
    const { opts, g } = setup()
    g.startBitPointer(pointer('pointerdown', 10, 10), 1)
    window.dispatchEvent(pointer('pointermove', 400, 400))
    window.dispatchEvent(pointer('pointercancel', 400, 400))
    await Promise.resolve()
    await Promise.resolve()
    expect(g.bitDrag.value).toBeNull()
    expect(opts.onTapBit).not.toHaveBeenCalled()
    expect(opts.onDropBit).not.toHaveBeenCalled()
  })

  it('Lasso sammelt die Spur in Canvas-Koordinaten und meldet sie beim Loslassen', () => {
    const { opts, g } = setup()
    g.startLasso(pointer('pointerdown', 0, 0))
    window.dispatchEvent(pointer('pointermove', 20, 0))
    window.dispatchEvent(pointer('pointermove', 20, 20))
    expect(g.lasso.value).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
    ])
    window.dispatchEvent(pointer('pointerup', 20, 20))
    expect(g.lasso.value).toBeNull()
    expect(opts.onLassoEnd).toHaveBeenCalledWith([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
    ])
  })

  it('cancelLasso bricht ab, ohne etwas zu melden', () => {
    const { opts, g } = setup()
    g.startLasso(pointer('pointerdown', 0, 0))
    window.dispatchEvent(pointer('pointermove', 30, 30))
    g.cancelLasso()
    window.dispatchEvent(pointer('pointerup', 30, 30))
    expect(g.lasso.value).toBeNull()
    expect(opts.onLassoEnd).not.toHaveBeenCalled()
  })

  it('Rahmen ziehen liefert den Versatz und meldet ihn beim Loslassen', async () => {
    const { opts, g } = setup()
    g.startFlowPointer(pointer('pointerdown', 100, 100), 5)
    window.dispatchEvent(pointer('pointermove', 140, 130))
    expect(g.flowDrag.value).toEqual({ flowId: 5, dx: 40, dy: 30 })
    clock = 10_000 // released after resting: no glide
    window.dispatchEvent(pointer('pointerup', 140, 130))
    await Promise.resolve()
    expect(g.flowDrag.value).toBeNull()
    expect(opts.onMoveFlowEnd).toHaveBeenCalledWith(5, 40, 30)
  })
})
