import { describe, it, expect, vi } from 'vitest'
import { computed, ref } from 'vue'
import type { Bit } from '@/stores/bitStore'
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

function setup() {
  const layout = computed(() =>
    computeLayout({
      bits: [bit(1, null, 0, 0, 0), bit(2, null, 0, 0, 300)],
      packets: [],
      expandedBitId: null,
    }),
  )
  const opts = {
    toCanvas: (x: number, y: number) => ({ x, y }),
    zoom: ref(1),
    layout,
    onTapBit: vi.fn(),
    onDropBit: vi.fn().mockResolvedValue(undefined),
    onMovePacketEnd: vi.fn().mockResolvedValue(undefined),
    onCreateDependency: vi.fn(),
  }
  return { opts, g: useFlowGestures(opts) }
}

describe('useFlowGestures', () => {
  it('ein Klick ohne Bewegung ist ein Tap', () => {
    const { opts, g } = setup()
    g.startBitPointer(pointer('pointerdown', 10, 10), 1)
    window.dispatchEvent(pointer('pointerup', 11, 11))
    expect(opts.onTapBit).toHaveBeenCalledWith(1)
    expect(opts.onDropBit).not.toHaveBeenCalled()
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

  it('pointercancel beendet einen Drag sauber', async () => {
    const { g } = setup()
    g.startBitPointer(pointer('pointerdown', 10, 10), 1)
    window.dispatchEvent(pointer('pointermove', 400, 400))
    window.dispatchEvent(pointer('pointercancel', 400, 400))
    await Promise.resolve()
    await Promise.resolve()
    expect(g.bitDrag.value).toBeNull()
  })
})
