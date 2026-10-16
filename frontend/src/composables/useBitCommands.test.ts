import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}))
vi.mock('@/helpers/api', () => ({ default: api }))

const actions = vi.hoisted(() => ({ deleteBit: vi.fn() }))
vi.mock('./useFlowActions', () => ({ useFlowActions: () => actions }))

import { useBitStore, type Bit } from '@/stores/bitStore'
import { useDependencyStore } from '@/stores/dependencyStore'
import { resetPendingCreates } from '@/stores/pendingCreates'
import { addDays, todayKey, toDateKey } from '@/helpers/localDate'
import type { FlowLayout } from './useFlowLayout'
import { useBitCommands } from './useBitCommands'

const layout = { tag: 'layout' } as unknown as FlowLayout

function bitWith(extra: Partial<Bit> = {}): Bit {
  return {
    id: '1',
    title: 'a',
    status: 0,
    x: 0,
    y: 0,
    packetId: null,
    order: 0,
    createdAt: '',
    ...extra,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
  resetPendingCreates()
  api.put.mockResolvedValue({})
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useBitCommands', () => {
  it('update leitet an die Warteschlange weiter und ignoriert meta', async () => {
    const store = useBitStore()
    store.bits = [bitWith()]
    const commands = useBitCommands({ layout: () => layout })
    await commands.update('1', { title: 'b' }, { label: 'Rename', coalesce: 'title' })
    expect(store.bits[0]!.title).toBe('b')
    expect(api.put).toHaveBeenCalledWith('/api/bit/1', { title: 'b' })
  })

  it('complete ohne Wiederholung sendet status 2', async () => {
    const store = useBitStore()
    store.bits = [bitWith()]
    const commands = useBitCommands({ layout: () => layout })
    const result = await commands.complete('1')
    expect(result).toEqual({ rolledTo: null })
    expect(api.put).toHaveBeenCalledTimes(1)
    expect(api.put).toHaveBeenCalledWith('/api/bit/1', { status: 2 })
    expect(store.bits[0]!.status).toBe(2)
  })

  it('complete mit Wiederholung setzt sofort status 2 und rollt nach 800 ms mit genau einem PUT', async () => {
    vi.useFakeTimers()
    const store = useBitStore()
    const today = todayKey()
    store.bits = [bitWith({ recurrence: 'daily', dueDate: today, completedCount: 0 })]
    const commands = useBitCommands({ layout: () => layout })
    const result = commands.complete('1')
    expect(store.bits[0]!.status).toBe(2)
    expect(api.put).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(799)
    expect(api.put).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(api.put).toHaveBeenCalledTimes(1)
    const [url, body] = api.put.mock.calls[0]!
    expect(url).toBe('/api/bit/1')
    expect(body).toEqual({
      status: 0,
      dueDate: expect.any(String),
      completedCount: 1,
    })
    const tomorrow = addDays(today, 1)
    expect(toDateKey(body.dueDate)).toBe(tomorrow)
    await expect(result).resolves.toEqual({ rolledTo: tomorrow })
    expect(store.bits[0]).toMatchObject({ status: 0, completedCount: 1 })
  })

  it('ein fehlgeschlagener Roll stellt den Stand vor dem Abhaken wieder her', async () => {
    vi.useFakeTimers()
    const store = useBitStore()
    const today = todayKey()
    store.bits = [bitWith({ status: 1, recurrence: 'daily', dueDate: today, completedCount: 2 })]
    api.put.mockRejectedValue(new Error('offline'))
    const commands = useBitCommands({ layout: () => layout })
    const result = commands.complete('1')
    const settled = expect(result).rejects.toThrow('offline')
    await vi.advanceTimersByTimeAsync(800)
    await settled
    expect(store.bits[0]).toMatchObject({ status: 1, dueDate: today, completedCount: 2 })
  })

  it('reopen innerhalb der 800 ms verhindert das Weiterrollen', async () => {
    vi.useFakeTimers()
    const store = useBitStore()
    const today = todayKey()
    store.bits = [bitWith({ recurrence: 'daily', dueDate: today, completedCount: 0 })]
    const commands = useBitCommands({ layout: () => layout })
    const completed = commands.complete('1')
    await commands.reopen('1')
    await vi.advanceTimersByTimeAsync(2000)
    await expect(completed).resolves.toEqual({ rolledTo: null })
    expect(store.bits[0]).toMatchObject({ status: 0, dueDate: today, completedCount: 0 })
    for (const [, body] of api.put.mock.calls) expect(body).not.toHaveProperty('completedCount')
  })

  it('reopen sendet status 0', async () => {
    const store = useBitStore()
    store.bits = [bitWith({ status: 2 })]
    const commands = useBitCommands({ layout: () => layout })
    await commands.reopen('1')
    expect(api.put).toHaveBeenCalledWith('/api/bit/1', { status: 0 })
    expect(store.bits[0]!.status).toBe(0)
  })

  it('remove löscht über die Flow-Actions mit dem aktuellen Layout', () => {
    const commands = useBitCommands({ layout: () => layout })
    commands.remove('1')
    expect(actions.deleteBit).toHaveBeenCalledWith('1', layout)
  })

  it('create legt das Bit über den Store an', async () => {
    const store = useBitStore()
    api.post.mockImplementation((_url: string, body: Bit) =>
      Promise.resolve({ data: { ...body, packetId: null, order: 0, createdAt: 'server' } }),
    )
    const commands = useBitCommands({ layout: () => layout })
    const bit = await commands.create(
      { title: 'neu', size: 2, recurrence: 'weekly' },
      { x: 10, y: 20 },
      'f1',
    )
    expect(bit).toMatchObject({ title: 'neu', size: 2, recurrence: 'weekly', x: 10, y: 20 })
    expect(api.post).toHaveBeenCalledWith(
      '/api/bit',
      expect.objectContaining({ title: 'neu', flowId: 'f1', size: 2, recurrence: 'weekly' }),
    )
    expect(store.bits).toHaveLength(1)
  })

  it('create ohne Flow sendet kein flowId', async () => {
    api.post.mockResolvedValue({ data: {} })
    const commands = useBitCommands({ layout: () => layout })
    void commands.create({ title: 'neu' }, { x: 0, y: 0 }, null)
    expect(api.post.mock.calls[0]![1]).not.toHaveProperty('flowId')
  })

  it('removeDependency löscht über den Dependency-Store', async () => {
    const deps = useDependencyStore()
    deps.dependencies = [{ id: 'd', fromType: 'bit', fromId: '1', toType: 'bit', toId: '2' }]
    api.delete.mockResolvedValue({})
    const commands = useBitCommands({ layout: () => layout })
    await commands.removeDependency('d')
    expect(api.delete).toHaveBeenCalledWith('/api/dependency/d')
    expect(deps.dependencies).toEqual([])
  })
})
