import { describe, it, expect, vi, beforeEach } from 'vitest'
import { watch } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }))
vi.mock('@/helpers/api', () => ({ default: api }))

import type { Bit } from '@/stores/bitStore'
import { useBitStore } from '@/stores/bitStore'
import { usePacketStore } from '@/stores/packetStore'
import { computeLayout } from './useFlowLayout'
import { useFlowActions } from './useFlowActions'

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

let server: { bits: Bit[]; packets: { id: number; name: string; x: number; y: number }[] }

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
  server = { bits: [], packets: [] }
  api.get.mockImplementation((url: string) =>
    Promise.resolve({
      data: url === '/api/bit' ? server.bits : url === '/api/packet' ? server.packets : [],
    }),
  )
  api.put.mockResolvedValue({ data: {} })
  api.post.mockResolvedValue({ data: { id: 50, name: 'Packet 1', x: 0, y: 0 } })
})

function seed(bits: Bit[], packets: { id: number; name: string; x: number; y: number }[]) {
  useBitStore().bits = bits.map((b) => ({ ...b }))
  usePacketStore().packets = packets.map((p) => ({ ...p }))
  return computeLayout({ bits, packets, expandedBitId: null })
}

describe('useFlowActions.dropBit', () => {
  it('Stack-Ziel: setzt die neue Reihenfolge inkl. eingefügtem Bit', async () => {
    const layout = seed(
      [bit(1, 7, 0), bit(2, 7, 1), bit(3, null, 0)],
      [{ id: 7, name: 'P', x: 100, y: 100 }],
    )
    await useFlowActions().dropBit(
      3,
      { kind: 'stack', packetId: 7, index: 1 },
      { x: 0, y: 0 },
      layout,
    )
    expect(api.put).toHaveBeenCalledWith('/api/packet/7/bits', { bitIds: [1, 3, 2] })
  })

  it('Pair-Ziel: legt ein Packet so an, dass die Ziel-Kapsel an ihrem Platz bleibt', async () => {
    const layout = seed([bit(1, null, 0, 500, 300), bit(2, null, 0)], [])
    await useFlowActions().dropBit(
      2,
      { kind: 'pair', bitId: 1, position: 'below' },
      { x: 0, y: 0 },
      layout,
    )
    expect(api.post).toHaveBeenCalledWith('/api/packet', { x: 472, y: 260, bitIds: [1, 2] })
  })

  it('Herausziehen bis zur Auflösung: das übrige Bit behält seine Bildschirmposition', async () => {
    const layout = seed(
      [bit(1, 7, 0, 5, 5), bit(2, 7, 1, 5, 5)],
      [{ id: 7, name: 'P', x: 100, y: 100 }],
    )
    server.bits = [bit(1, null, 0, 700, 700), bit(2, null, 0, 5, 5)]
    server.packets = []
    await useFlowActions().dropBit(1, null, { x: 700, y: 700 }, layout)
    expect(api.put).toHaveBeenCalledWith('/api/bit/1', { packetId: null, x: 700, y: 700 })
    // bit 2 was the second step: rect y = 100 + 76
    expect(api.put).toHaveBeenCalledWith('/api/bit/2', { x: 128, y: 176 })
  })

  it('befreites Bit wird nie mit veralteten Server-Koordinaten gerendert, auch wenn die GETs gestaffelt eintreffen', async () => {
    const layout = seed(
      [bit(1, 7, 0, 5, 5), bit(2, 7, 1, 5, 5)],
      [{ id: 7, name: 'P', x: 100, y: 100 }],
    )
    const gate = () => {
      let resolve!: (v: { data: unknown }) => void
      const promise = new Promise<{ data: unknown }>((r) => (resolve = r))
      return { promise, resolve }
    }
    const bitsGet = gate()
    const packetsGet = gate()
    const depsGet = gate()
    api.get.mockImplementation((url: string) =>
      url === '/api/bit'
        ? bitsGet.promise
        : url === '/api/packet'
          ? packetsGet.promise
          : depsGet.promise,
    )
    const seen: { x: number; y: number }[] = []
    watch(
      () => useBitStore().bits,
      (bits) => {
        const b = bits.find((x) => x.id === 2)
        if (b) seen.push({ x: b.x, y: b.y })
      },
      { deep: true, flush: 'sync' },
    )

    const done = useFlowActions().dropBit(1, null, { x: 700, y: 700 }, layout)
    await vi.waitFor(() => expect(api.get).toHaveBeenCalledTimes(3))
    // bits arrive first with a stale DB position for the freed bit 2, packets much later
    bitsGet.resolve({ data: [bit(1, null, 0, 700, 700), bit(2, null, 0, 999, 999)] })
    await Promise.resolve()
    await Promise.resolve()
    packetsGet.resolve({ data: [] })
    depsGet.resolve({ data: [] })
    await done

    expect(seen.length).toBeGreaterThan(0)
    expect(seen).not.toContainEqual({ x: 999, y: 999 })
    expect(useBitStore().bits.find((b) => b.id === 2)).toMatchObject({ x: 128, y: 176 })
    expect(api.put).toHaveBeenCalledWith('/api/bit/2', { x: 128, y: 176 })
  })

  it('Drop auf den eigenen Platz im Stapel sendet nichts', async () => {
    const layout = seed(
      [bit(1, 7, 0), bit(2, 7, 1), bit(3, 7, 2)],
      [{ id: 7, name: 'P', x: 100, y: 100 }],
    )
    await useFlowActions().dropBit(
      2,
      { kind: 'stack', packetId: 7, index: 1 },
      { x: 0, y: 0 },
      layout,
    )
    expect(api.put).not.toHaveBeenCalled()
    expect(api.get).not.toHaveBeenCalled()
  })

  it('freies Verschieben einer losen Kapsel speichert nur x/y', async () => {
    const layout = seed([bit(1, null, 0)], [])
    await useFlowActions().dropBit(1, null, { x: 40.4, y: 80.6 }, layout)
    expect(api.put).toHaveBeenCalledWith('/api/bit/1', { x: 40, y: 81 })
    expect(api.get).not.toHaveBeenCalled()
  })

  it('ungültige Pfeile werden gar nicht erst gesendet', async () => {
    seed([bit(1, null, 0)], [])
    await useFlowActions().createDependency({ type: 'bit', id: 1 }, { type: 'bit', id: 1 })
    expect(api.post).not.toHaveBeenCalled()
  })
})
