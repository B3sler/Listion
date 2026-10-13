import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}))
vi.mock('@/helpers/api', () => ({ default: api }))

import { useBitStore } from './bitStore'
import { usePacketStore } from './packetStore'
import { useDependencyStore } from './dependencyStore'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
})

describe('flow stores', () => {
  it('updateBit ändert lokal sofort und rollt bei Fehler zurück', async () => {
    const store = useBitStore()
    store.bits = [
      { id: 1, title: 'a', status: 0, x: 0, y: 0, packetId: null, order: 0, createdAt: '' },
    ]
    let reject!: (e: Error) => void
    api.put.mockReturnValue(new Promise((_, r) => (reject = r)))
    const pending = store.updateBit(1, { x: 50 })
    expect(store.bits[0]!.x).toBe(50)
    reject(new Error('offline'))
    await expect(pending).rejects.toThrow('offline')
    expect(store.bits[0]!.x).toBe(0)
  })

  it('createPacket rundet Koordinaten und speichert das Packet', async () => {
    const store = usePacketStore()
    api.post.mockResolvedValue({ data: { id: 7, name: 'Packet 1', x: 10, y: 20 } })
    await store.createPacket({ x: 10.4, y: 19.6, bitIds: [1, 2] })
    expect(api.post).toHaveBeenCalledWith('/api/packet', { x: 10, y: 20, bitIds: [1, 2] })
    expect(store.packets).toHaveLength(1)
  })

  it('createDependency sendet Typen/IDs und dupliziert nicht', async () => {
    const store = useDependencyStore()
    const dep = { id: 3, fromType: 'bit', fromId: 1, toType: 'packet', toId: 2 }
    api.post.mockResolvedValue({ data: dep })
    await store.createDependency({ type: 'bit', id: 1 }, { type: 'packet', id: 2 })
    await store.createDependency({ type: 'bit', id: 1 }, { type: 'packet', id: 2 })
    expect(api.post).toHaveBeenCalledWith('/api/dependency', {
      fromType: 'bit',
      fromId: 1,
      toType: 'packet',
      toId: 2,
    })
    expect(store.dependencies).toHaveLength(1)
  })
})
