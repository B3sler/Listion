import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}))
vi.mock('@/helpers/api', () => ({ default: api }))

import type { Dependency } from '@/types/flow'
import { useBitStore, type Bit } from './bitStore'
import { usePacketStore } from './packetStore'
import { useDependencyStore } from './dependencyStore'
import { useFlowStore } from './flowStore'
import { resetPendingCreates } from './pendingCreates'

const V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

/** A POST that only answers when the test says so. */
function pendingPost<T>() {
  let resolve!: (v: { data: T }) => void
  api.post.mockReturnValueOnce(new Promise((r) => (resolve = r)))
  return (data: T) => resolve({ data })
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
  resetPendingCreates()
})

describe('flow stores', () => {
  it('updateBit ändert lokal sofort und rollt bei Fehler zurück', async () => {
    const store = useBitStore()
    store.bits = [
      { id: '1', title: 'a', status: 0, x: 0, y: 0, packetId: null, order: 0, createdAt: '' },
    ]
    let reject!: (e: Error) => void
    api.put.mockReturnValue(new Promise((_, r) => (reject = r)))
    const pending = store.updateBit('1', { x: 50 })
    expect(store.bits[0]!.x).toBe(50)
    reject(new Error('offline'))
    await expect(pending).rejects.toThrow('offline')
    expect(store.bits[0]!.x).toBe(0)
  })

  it('createPacket rundet Koordinaten, sendet eine Client-ID und speichert das Packet', async () => {
    const store = usePacketStore()
    api.post.mockResolvedValue({ data: { id: '7', name: 'Packet 1', x: 10, y: 20 } })
    await store.createPacket({ x: 10.4, y: 19.6, bitIds: ['1', '2'] })
    expect(api.post).toHaveBeenCalledWith('/api/packet', {
      id: expect.stringMatching(V7),
      x: 10,
      y: 20,
      bitIds: ['1', '2'],
    })
    expect(store.packets).toHaveLength(1)
  })

  it('createBit zeigt das Bit sofort und sendet die Client-ID', async () => {
    const store = useBitStore()
    const answer = pendingPost<Bit>()
    const created = store.createBit({ title: 'neu', x: 10.4, y: 20 })
    expect(store.bits).toHaveLength(1)
    const id = store.bits[0]!.id
    expect(id).toMatch(V7)
    expect(store.bits[0]).toMatchObject({ title: 'neu', x: 10, y: 20, status: 0, packetId: null })
    expect(api.post).toHaveBeenCalledWith('/api/bit', { id, title: 'neu', x: 10, y: 20, status: 0 })
    answer({ ...store.bits[0]!, createdAt: '2026-10-14T10:00:00Z' })
    await created
    expect(store.bits[0]!.createdAt).toBe('2026-10-14T10:00:00Z')
  })

  it('ein Reload während des Erstellens verliert das neue Bit nicht', async () => {
    const store = useBitStore()
    const answer = pendingPost<Bit>()
    const created = store.createBit({ title: 'neu', x: 0, y: 0 })
    const draft = { ...store.bits[0]! }
    // a failed neighbour operation reloads the flow before this POST is answered
    store.bits = []
    answer({ ...draft, createdAt: 'server' })
    await created
    expect(store.bits).toEqual([{ ...draft, createdAt: 'server' }])
  })

  it('createBit entfernt das Bit wieder, wenn der Server ablehnt', async () => {
    const store = useBitStore()
    api.post.mockRejectedValue(new Error('offline'))
    await expect(store.createBit({ title: 'neu', x: 0, y: 0 })).rejects.toThrow('offline')
    expect(store.bits).toHaveLength(0)
  })

  it('updateBit auf ein neues Bit wartet auf das POST und behält die lokale Position', async () => {
    const store = useBitStore()
    const answer = pendingPost<Bit>()
    api.put.mockResolvedValue({ data: {} })
    const created = store.createBit({ title: 'neu', x: 0, y: 0 })
    const id = store.bits[0]!.id
    const moved = store.updateBit(id, { x: 300 })
    await Promise.resolve()
    expect(api.put).not.toHaveBeenCalled()
    expect(store.bits[0]!.x).toBe(300)
    answer({ ...store.bits[0]!, x: 0, createdAt: 'server' })
    await created
    await moved
    expect(api.put).toHaveBeenCalledWith(`/api/bit/${id}`, { x: 300 })
    expect(store.bits[0]).toMatchObject({ x: 300, createdAt: 'server' })
  })

  it('updateBit auf ein neues Bit schlägt fehl, wenn dessen POST fehlschlägt', async () => {
    const store = useBitStore()
    let reject!: (e: Error) => void
    api.post.mockReturnValueOnce(new Promise((_, r) => (reject = r)))
    const created = store.createBit({ title: 'neu', x: 0, y: 0 })
    const moved = store.updateBit(store.bits[0]!.id, { x: 300 })
    reject(new Error('offline'))
    await expect(created).rejects.toThrow('offline')
    await expect(moved).rejects.toThrow('offline')
    expect(api.put).not.toHaveBeenCalled()
    expect(store.bits).toHaveLength(0)
  })

  it('deleteBit auf ein neues Bit wartet auf das POST', async () => {
    const store = useBitStore()
    const answer = pendingPost<Bit>()
    api.delete.mockResolvedValue({ data: {} })
    const created = store.createBit({ title: 'neu', x: 0, y: 0 })
    const id = store.bits[0]!.id
    const removed = store.deleteBit(id)
    await Promise.resolve()
    expect(api.delete).not.toHaveBeenCalled()
    answer({ ...store.bits[0]! })
    await created
    await removed
    expect(api.delete).toHaveBeenCalledWith(`/api/bit/${id}`)
    expect(store.bits).toHaveLength(0)
  })

  it('createPacket mit einem neuen Bit wartet auf dessen POST', async () => {
    const bits = useBitStore()
    const packets = usePacketStore()
    const answer = pendingPost<Bit>()
    const created = bits.createBit({ title: 'neu', x: 0, y: 0 })
    const id = bits.bits[0]!.id
    api.post.mockResolvedValueOnce({ data: { id: 'p', name: 'Packet 1', x: 0, y: 0 } })
    const packed = packets.createPacket({ x: 0, y: 0, bitIds: ['old', id] })
    await Promise.resolve()
    expect(api.post).toHaveBeenCalledTimes(1)
    answer({ ...bits.bits[0]! })
    await created
    await packed
    expect(api.post).toHaveBeenCalledTimes(2)
  })

  it('createDependency zeigt den Pfeil sofort und sendet die Client-ID', async () => {
    const store = useDependencyStore()
    const answer = pendingPost<Dependency>()
    const created = store.createDependency({ type: 'bit', id: '1' }, { type: 'packet', id: '2' })
    expect(store.dependencies).toHaveLength(1)
    const draft = store.dependencies[0]!
    expect(draft).toMatchObject({ fromType: 'bit', fromId: '1', toType: 'packet', toId: '2' })
    await vi.waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/dependency', draft))
    answer({ ...draft })
    await created
    expect(store.dependencies).toEqual([draft])
  })

  it('createDependency rollt bei Fehler zurück', async () => {
    const store = useDependencyStore()
    api.post.mockRejectedValue(new Error('nope'))
    const created = store.createDependency({ type: 'bit', id: 'b1' }, { type: 'packet', id: 'p2' })
    expect(store.dependencies).toHaveLength(1)
    await expect(created).rejects.toThrow('nope')
    expect(store.dependencies).toHaveLength(0)
  })

  it('createDependency übernimmt eine abweichende Server-ID ohne Duplikat', async () => {
    const store = useDependencyStore()
    const existing: Dependency = {
      id: 'existing',
      fromType: 'bit',
      fromId: 'b1',
      toType: 'packet',
      toId: 'p2',
    }
    store.dependencies = [existing]
    api.post.mockResolvedValue({ data: { ...existing } })
    await store.createDependency({ type: 'bit', id: 'b1' }, { type: 'packet', id: 'p2' })
    expect(store.dependencies.map((d) => d.id)).toEqual(['existing'])
  })

  it('ein Pfeil zu einem neuen Bit wartet auf dessen POST', async () => {
    const bits = useBitStore()
    const deps = useDependencyStore()
    const answer = pendingPost<Bit>()
    const created = bits.createBit({ title: 'neu', x: 0, y: 0 })
    const id = bits.bits[0]!.id
    api.post.mockImplementationOnce((_url: string, body: Dependency) =>
      Promise.resolve({ data: body }),
    )
    const linked = deps.createDependency({ type: 'bit', id }, { type: 'bit', id: 'b9' })
    await Promise.resolve()
    expect(api.post).toHaveBeenCalledTimes(1)
    answer({ ...bits.bits[0]! })
    await created
    await linked
    expect(api.post).toHaveBeenCalledTimes(2)
  })

  it('flowStore legt Flows an, benennt optimistisch um und rollt bei Fehler zurück', async () => {
    const store = useFlowStore()
    api.post.mockResolvedValue({ data: { id: '4', name: 'Flow 1', color: '#818cf8' } })
    await store.createFlow({ bitIds: ['1'], packetIds: [] })
    expect(api.post).toHaveBeenCalledWith('/api/flow', {
      id: expect.stringMatching(V7),
      bitIds: ['1'],
      packetIds: [],
    })
    let reject!: (e: Error) => void
    api.put.mockReturnValue(new Promise((_, r) => (reject = r)))
    const pending = store.updateFlow('4', { name: 'Release' })
    expect(store.flows[0]!.name).toBe('Release')
    reject(new Error('offline'))
    await expect(pending).rejects.toThrow('offline')
    expect(store.flows[0]!.name).toBe('Flow 1')
  })

  it('createFlow mit einem neuen Bit wartet auf dessen POST', async () => {
    const bits = useBitStore()
    const flows = useFlowStore()
    const answer = pendingPost<Bit>()
    const created = bits.createBit({ title: 'neu', x: 0, y: 0 })
    const id = bits.bits[0]!.id
    api.post.mockResolvedValueOnce({ data: { id: 'f', name: 'Flow 1', color: '#818cf8' } })
    const grouped = flows.createFlow({ bitIds: [id], packetIds: [] })
    await Promise.resolve()
    expect(api.post).toHaveBeenCalledTimes(1)
    answer({ ...bits.bits[0]! })
    await created
    await grouped
    expect(api.post).toHaveBeenCalledTimes(2)
  })
})
