import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { effectScope, type EffectScope } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  defaults: { baseURL: '' },
}))
vi.mock('@/helpers/api', () => ({ default: api }))

const actions = vi.hoisted(() => ({ deleteBit: vi.fn() }))
vi.mock('./useFlowActions', () => ({ useFlowActions: () => actions }))

import { useBitStore, type Bit } from '@/stores/bitStore'
import { useDependencyStore } from '@/stores/dependencyStore'
import { useHistoryStore } from '@/stores/historyStore'
import { useSheetStore } from '@/stores/sheetStore'
import { resetPendingCreates } from '@/stores/pendingCreates'
import { addDays, dueToApi, todayKey, toDateKey } from '@/helpers/localDate'
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

const scopes: EffectScope[] = []

/** Commands inside their own scope, so the pagehide listener goes away after each test. */
function makeCommands(extra: { onRemove?: (id: string) => void } = {}) {
  const scope = effectScope()
  scopes.push(scope)
  return scope.run(() => useBitCommands({ layout: () => layout, ...extra }))!
}

const visibleIds = () => useBitStore().visibleBits.map((b) => b.id)

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
  resetPendingCreates()
  api.put.mockResolvedValue({})
  // like the real one: the bit leaves the store once the server deleted it
  actions.deleteBit.mockImplementation(async (id: string) => {
    const store = useBitStore()
    store.bits = store.bits.filter((b) => b.id !== id)
  })
})

afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useBitCommands', () => {
  it('update leitet an die Warteschlange weiter', async () => {
    const store = useBitStore()
    store.bits = [bitWith()]
    const commands = makeCommands()
    await commands.update('1', { title: 'b' }, { label: 'Rename', coalesce: 'title' })
    expect(store.bits[0]!.title).toBe('b')
    expect(api.put).toHaveBeenCalledWith('/api/bit/1', { title: 'b' })
  })

  it('complete ohne Wiederholung sendet status 2', async () => {
    const store = useBitStore()
    store.bits = [bitWith()]
    const commands = makeCommands()
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
    const commands = makeCommands()
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
    const commands = makeCommands()
    const result = commands.complete('1')
    const settled = expect(result).rejects.toThrow('offline')
    await vi.advanceTimersByTimeAsync(800)
    await settled
    expect(store.bits[0]).toMatchObject({ status: 1, dueDate: today, completedCount: 2 })
  })

  it('der Roll rechnet mit dem Stand nach 800 ms, nicht mit dem beim Abhaken', async () => {
    vi.useFakeTimers()
    const store = useBitStore()
    const today = todayKey()
    store.bits = [bitWith({ recurrence: 'daily', dueDate: today, completedCount: 0 })]
    const commands = makeCommands()
    const result = commands.complete('1')
    const later = addDays(today, 5)
    await commands.update('1', { dueDate: dueToApi(later) }, { label: 'Due date' })
    api.put.mockClear()
    await vi.advanceTimersByTimeAsync(800)
    await expect(result).resolves.toEqual({ rolledTo: addDays(later, 1) })
    expect(api.put).toHaveBeenCalledTimes(1)
    expect(toDateKey(api.put.mock.calls[0]![1].dueDate)).toBe(addDays(later, 1))
  })

  it('reopen innerhalb der 800 ms verhindert das Weiterrollen', async () => {
    vi.useFakeTimers()
    const store = useBitStore()
    const today = todayKey()
    store.bits = [bitWith({ recurrence: 'daily', dueDate: today, completedCount: 0 })]
    const commands = makeCommands()
    const completed = commands.complete('1')
    await commands.reopen('1')
    await vi.advanceTimersByTimeAsync(2000)
    await expect(completed).resolves.toEqual({ rolledTo: null })
    expect(store.bits[0]).toMatchObject({ status: 0, dueDate: today, completedCount: 0 })
    for (const [, body] of api.put.mock.calls) expect(body).not.toHaveProperty('completedCount')
  })

  it('reopen nach abgebrochenem Roll fällt bei einem Fehler auf den Status vor dem Abhaken zurück', async () => {
    vi.useFakeTimers()
    const store = useBitStore()
    const today = todayKey()
    store.bits = [bitWith({ status: 1, recurrence: 'daily', dueDate: today, completedCount: 0 })]
    const commands = makeCommands()
    void commands.complete('1')
    expect(store.bits[0]!.status).toBe(2)
    api.put.mockRejectedValue(new Error('offline'))
    await expect(commands.reopen('1')).rejects.toThrow('offline')
    expect(store.bits[0]!.status).toBe(1)
  })

  it('reopen sendet status 0', async () => {
    const store = useBitStore()
    store.bits = [bitWith({ status: 2 })]
    const commands = makeCommands()
    await commands.reopen('1')
    expect(api.put).toHaveBeenCalledWith('/api/bit/1', { status: 0 })
    expect(store.bits[0]!.status).toBe(0)
  })

  it('create legt das Bit über den Store an', async () => {
    const store = useBitStore()
    api.post.mockImplementation((_url: string, body: Bit) =>
      Promise.resolve({ data: { ...body, packetId: null, order: 0, createdAt: 'server' } }),
    )
    const commands = makeCommands()
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

  it('create übernimmt eine mitgegebene Client-ID, das Bit liegt sofort im Store', async () => {
    const store = useBitStore()
    api.post.mockReturnValue(new Promise(() => {}))
    const commands = makeCommands()
    const id = '01900000-0000-7000-8000-000000000001'
    void commands.create({ id, title: 'neu' }, { x: 0, y: 0 }, null)
    expect(api.post.mock.calls[0]![1]).toMatchObject({ id, title: 'neu' })
    expect(store.bits.map((b) => b.id)).toEqual([id])
  })

  it('create ohne Flow sendet kein flowId', async () => {
    api.post.mockResolvedValue({ data: {} })
    const commands = makeCommands()
    void commands.create({ title: 'neu' }, { x: 0, y: 0 }, null)
    expect(api.post.mock.calls[0]![1]).not.toHaveProperty('flowId')
  })

  it('removeDependency löscht über den Dependency-Store', async () => {
    const deps = useDependencyStore()
    deps.dependencies = [{ id: 'd', fromType: 'bit', fromId: '1', toType: 'bit', toId: '2' }]
    api.delete.mockResolvedValue({})
    const commands = makeCommands()
    await commands.removeDependency('d')
    expect(api.delete).toHaveBeenCalledWith('/api/dependency/d')
    expect(deps.dependencies).toEqual([])
  })
})

describe('useBitCommands: History', () => {
  const title = { label: 'Rename', coalesce: 'title' } as const

  it('drei Titel-Updates innerhalb von 1,5 s ergeben einen Eintrag, nach 1,5 s Pause entsteht ein zweiter', async () => {
    vi.useFakeTimers()
    const store = useBitStore()
    store.bits = [bitWith()]
    const history = useHistoryStore()
    const commands = makeCommands()

    await commands.update('1', { title: 'ab' }, title)
    const first = history.top()
    await vi.advanceTimersByTimeAsync(1000)
    await commands.update('1', { title: 'abc' }, title)
    await vi.advanceTimersByTimeAsync(1000)
    await commands.update('1', { title: 'abcd' }, title)
    expect(history.top()).toBe(first)
    expect(first!.patch).toEqual({ before: { title: 'a' }, after: { title: 'abcd' } })

    await vi.advanceTimersByTimeAsync(1500)
    await commands.update('1', { title: 'abcde' }, title)
    expect(history.top()).not.toBe(first)

    await history.undo()
    expect(history.top()).toBe(first)
    await history.undo()
    expect(history.canUndo).toBe(false)
    expect(store.bits[0]!.title).toBe('a')
  })

  it('Updates ohne coalesce oder mit anderem Schlüssel fassen nicht zusammen', async () => {
    const store = useBitStore()
    store.bits = [bitWith()]
    const history = useHistoryStore()
    const commands = makeCommands()
    await commands.update('1', { title: 'b' }, title)
    const first = history.top()
    await commands.update('1', { notes: 'n' }, { label: 'Edit notes', coalesce: 'notes' })
    expect(history.top()).not.toBe(first)
    const second = history.top()
    await commands.update('1', { priority: 2 }, { label: 'Priority' })
    expect(history.top()).not.toBe(second)
    expect(first!.sealed).toBe(true)
  })

  it('undo eines Updates sendet die alten Werte, redo die neuen', async () => {
    const store = useBitStore()
    store.bits = [bitWith({ title: 'a', priority: 1 })]
    const history = useHistoryStore()
    const commands = makeCommands()
    await commands.update('1', { title: 'b', priority: 3 }, { label: 'Edit' })
    api.put.mockClear()

    await history.undo()
    expect(api.put).toHaveBeenCalledWith('/api/bit/1', { title: 'a', priority: 1 })
    expect(store.bits[0]).toMatchObject({ title: 'a', priority: 1 })

    await history.redo()
    expect(api.put).toHaveBeenLastCalledWith('/api/bit/1', { title: 'b', priority: 3 })
    expect(store.bits[0]).toMatchObject({ title: 'b', priority: 3 })
  })

  it('undo eines vorher leeren Felds sendet null bzw. den leeren Text', async () => {
    const store = useBitStore()
    store.bits = [bitWith()]
    const history = useHistoryStore()
    const commands = makeCommands()
    await commands.update('1', { color: '#f00', notes: 'x' }, { label: 'Edit' })
    api.put.mockClear()
    await history.undo()
    expect(api.put).toHaveBeenCalledWith('/api/bit/1', { color: null, notes: '' })
  })

  it('complete zeigt den Toast „Done“, Undo über den Toast setzt den alten Status', async () => {
    const store = useBitStore()
    store.bits = [bitWith({ status: 1 })]
    const history = useHistoryStore()
    const commands = makeCommands()
    await commands.complete('1')
    expect(history.toast).toMatchObject({ message: 'Done', undoable: true })
    expect(history.toast!.entryId).toBe(history.top()!.id)
    expect(history.top()!.patch).toEqual({ before: { status: 1 }, after: { status: 2 } })

    await history.undoToast()
    expect(api.put).toHaveBeenLastCalledWith('/api/bit/1', { status: 1 })
    expect(store.bits[0]!.status).toBe(1)
    expect(history.toast).toBeNull()

    await history.redo()
    expect(api.put).toHaveBeenLastCalledWith('/api/bit/1', { status: 2 })
  })

  it('Abhaken mit Wiederholung zeigt „↻ Next: <Tag>“', async () => {
    vi.useFakeTimers()
    const store = useBitStore()
    store.bits = [bitWith({ recurrence: 'daily', dueDate: todayKey() })]
    const history = useHistoryStore()
    const commands = makeCommands()
    void commands.complete('1')
    expect(history.toast).toMatchObject({ message: '↻ Next: Tomorrow', undoable: true })
  })

  it.each([
    ['mit Fälligkeit heute', todayKey()],
    ['ohne Fälligkeit', undefined],
    ['mit lange vergangener Fälligkeit', addDays(todayKey(), -30)],
  ])(
    'Abhaken mit Wiederholung %s rollt auf morgen, Undo stellt status, dueDate und completedCount wieder her',
    async (_name, dueDate) => {
      vi.useFakeTimers()
      const store = useBitStore()
      store.bits = [bitWith({ status: 1, recurrence: 'daily', dueDate, completedCount: 2 })]
      const history = useHistoryStore()
      const commands = makeCommands()
      const done = commands.complete('1')
      await vi.advanceTimersByTimeAsync(800)
      await expect(done).resolves.toEqual({ rolledTo: addDays(todayKey(), 1) })
      expect(store.bits[0]).toMatchObject({ status: 0, completedCount: 3 })

      api.put.mockClear()
      await history.undo()
      expect(api.put).toHaveBeenCalledWith('/api/bit/1', {
        status: 1,
        dueDate: dueDate ?? null,
        completedCount: 2,
      })
      expect(store.bits[0]).toMatchObject({ status: 1, completedCount: 2 })
      expect(store.bits[0]!.dueDate ?? null).toBe(dueDate ?? null)

      await history.redo()
      expect(store.bits[0]).toMatchObject({ status: 0, completedCount: 3 })
      expect(toDateKey(store.bits[0]!.dueDate!)).toBe(addDays(todayKey(), 1))
    },
  )

  it('Undo innerhalb der 800 ms bricht den Roll ohne Request ab', async () => {
    vi.useFakeTimers()
    const store = useBitStore()
    store.bits = [bitWith({ status: 1, recurrence: 'daily', dueDate: todayKey() })]
    const history = useHistoryStore()
    const commands = makeCommands()
    const done = commands.complete('1')
    await history.undoToast()
    await vi.advanceTimersByTimeAsync(2000)
    await expect(done).resolves.toEqual({ rolledTo: null })
    expect(api.put).not.toHaveBeenCalled()
    expect(store.bits[0]!.status).toBe(1)
  })

  it('reopen legt einen Eintrag an, Undo hakt wieder ab', async () => {
    const store = useBitStore()
    store.bits = [bitWith({ status: 2 })]
    const history = useHistoryStore()
    const commands = makeCommands()
    await commands.reopen('1')
    await history.undo()
    expect(api.put).toHaveBeenLastCalledWith('/api/bit/1', { status: 2 })
    expect(store.bits[0]!.status).toBe(2)
  })

  it('create: Undo löscht sofort über deleteBit, Redo legt mit derselben ID neu an', async () => {
    const store = useBitStore()
    api.post.mockImplementation((_url: string, body: Bit) =>
      Promise.resolve({ data: { ...body, packetId: null, order: 0, createdAt: 'server' } }),
    )
    const history = useHistoryStore()
    const commands = makeCommands()
    const bit = await commands.create({ title: 'neu', size: 2 }, { x: 10, y: 20 }, null)

    await history.undo()
    expect(actions.deleteBit).toHaveBeenCalledWith(bit.id, layout)
    expect(store.bits).toEqual([])
    expect(history.toast).toBeNull()

    await history.redo()
    expect(api.post).toHaveBeenLastCalledWith(
      '/api/bit',
      expect.objectContaining({ id: bit.id, title: 'neu', size: 2, x: 10, y: 20 }),
    )
    expect(store.bits.map((b) => b.id)).toEqual([bit.id])
  })

  it('ein fehlgeschlagenes create hinterlässt keinen Eintrag', async () => {
    api.post.mockRejectedValue(new Error('offline'))
    const history = useHistoryStore()
    const commands = makeCommands()
    await expect(commands.create({ title: 'neu' }, { x: 0, y: 0 }, null)).rejects.toThrow()
    expect(history.canUndo).toBe(false)
  })

  it('removeDependency und dann Undo legt den Pfeil mit derselben ID neu an', async () => {
    useBitStore().bits = [bitWith()]
    const deps = useDependencyStore()
    deps.dependencies = [{ id: 'd', fromType: 'bit', fromId: '1', toType: 'packet', toId: '7' }]
    api.delete.mockResolvedValue({})
    api.post.mockImplementation((_url: string, body: unknown) => Promise.resolve({ data: body }))
    const history = useHistoryStore()
    const commands = makeCommands()
    await commands.removeDependency('d')

    await history.undo()
    expect(api.post).toHaveBeenCalledWith(
      '/api/dependency',
      expect.objectContaining({ id: 'd', fromId: '1', toType: 'packet', toId: '7' }),
    )
    expect(deps.dependencies.map((d) => d.id)).toEqual(['d'])

    await history.redo()
    expect(api.delete).toHaveBeenLastCalledWith('/api/dependency/d')
    expect(deps.dependencies).toEqual([])
  })

  it('Undo eines entfernten Pfeils zu einem inzwischen gelöschten Bit tut nichts', async () => {
    const deps = useDependencyStore()
    deps.dependencies = [{ id: 'd', fromType: 'bit', fromId: 'gone', toType: 'packet', toId: '7' }]
    api.delete.mockResolvedValue({})
    const history = useHistoryStore()
    const commands = makeCommands()
    await commands.removeDependency('d')
    await history.undo()
    expect(api.post).not.toHaveBeenCalled()
    expect(history.canUndo).toBe(false)
  })
})

describe('useBitCommands: verzögertes Löschen', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useBitStore().bits = [bitWith(), bitWith({ id: '2' }), bitWith({ id: '3' })]
  })

  it('remove versteckt das Bit sofort, ohne DELETE, und zeigt „Bit deleted“', () => {
    const commands = makeCommands()
    commands.remove('1')
    expect(visibleIds()).toEqual(['2', '3'])
    expect(useBitStore().bits).toHaveLength(3)
    expect(actions.deleteBit).not.toHaveBeenCalled()
    expect(api.delete).not.toHaveBeenCalled()
    const history = useHistoryStore()
    expect(history.toast).toMatchObject({ message: 'Bit deleted', undoable: true })
    expect(history.toast!.entryId).toBe(history.top()!.id)
  })

  it('Undo über den Toast vor 6 s macht das Bit wieder sichtbar, ohne DELETE', async () => {
    const commands = makeCommands()
    const history = useHistoryStore()
    commands.remove('1')
    await vi.advanceTimersByTimeAsync(3000)
    await history.undoToast()
    expect(visibleIds()).toEqual(['1', '2', '3'])
    expect(history.toast).toBeNull()
    await vi.advanceTimersByTimeAsync(20000)
    expect(actions.deleteBit).not.toHaveBeenCalled()
  })

  it('Strg+Z (history.undo) vor 6 s macht das Bit wieder sichtbar und nimmt den Toast weg', async () => {
    const commands = makeCommands()
    const history = useHistoryStore()
    commands.remove('1')
    await history.undo()
    expect(visibleIds()).toEqual(['1', '2', '3'])
    expect(history.toast).toBeNull()
    await vi.advanceTimersByTimeAsync(20000)
    expect(actions.deleteBit).not.toHaveBeenCalled()

    // redo deletes again, with a fresh grace period
    await history.redo()
    expect(visibleIds()).toEqual(['2', '3'])
    expect(history.toast).toMatchObject({ message: 'Bit deleted' })
    await vi.advanceTimersByTimeAsync(6000)
    expect(actions.deleteBit).toHaveBeenCalledTimes(1)
  })

  it('nach 6 s löscht genau ein deleteBit-Aufruf mit dem aktuellen Layout, der Eintrag verschwindet', async () => {
    const commands = makeCommands()
    const history = useHistoryStore()
    await commands.update('2', { title: 'z' }, { label: 'Rename' })
    await commands.update('1', { title: 'y' }, { label: 'Rename' })
    commands.remove('1')
    await vi.advanceTimersByTimeAsync(5999)
    expect(actions.deleteBit).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(actions.deleteBit).toHaveBeenCalledTimes(1)
    expect(actions.deleteBit).toHaveBeenCalledWith('1', layout)
    await vi.advanceTimersByTimeAsync(0)
    expect(visibleIds()).toEqual(['2', '3'])
    expect(useBitStore().hiddenIds.size).toBe(0)
    // the delete and the deleted bit's older entries are gone; Ctrl+Z reaches the next one
    api.put.mockClear()
    await history.undo()
    expect(api.put).toHaveBeenCalledWith('/api/bit/2', { title: 'a' })
    expect(history.canUndo).toBe(false)
  })

  it('ein zweites Löschen ersetzt den Toast und löscht das erste Bit sofort', async () => {
    const commands = makeCommands()
    commands.remove('1')
    commands.remove('2')
    await vi.advanceTimersByTimeAsync(0)
    expect(actions.deleteBit).toHaveBeenCalledTimes(1)
    expect(actions.deleteBit).toHaveBeenCalledWith('1', layout)
    expect(visibleIds()).toEqual(['3'])
    await vi.advanceTimersByTimeAsync(6000)
    expect(actions.deleteBit).toHaveBeenCalledTimes(2)
  })

  it('Undo während des laufenden Commits stellt das Bit nicht wieder her', async () => {
    let finish!: () => void
    actions.deleteBit.mockReturnValue(new Promise<void>((r) => (finish = r)))
    const commands = makeCommands()
    const history = useHistoryStore()
    commands.remove('1')
    await vi.advanceTimersByTimeAsync(6000)
    expect(actions.deleteBit).toHaveBeenCalledTimes(1)
    expect(history.canUndo).toBe(false)
    await history.undo()
    expect(visibleIds()).toEqual(['2', '3'])
    finish()
  })

  it('Undo über den Toast, wenn der Eintrag schon verdrängt ist, löscht trotzdem', async () => {
    const commands = makeCommands()
    const history = useHistoryStore()
    commands.remove('1')
    // 50 newer entries push the delete off the stack while its toast is still up
    for (let i = 0; i < 50; i++) await commands.update('2', { priority: i }, { label: 'Priority' })
    await history.undoToast()
    await vi.advanceTimersByTimeAsync(0)
    expect(actions.deleteBit).toHaveBeenCalledTimes(1)
    expect(history.toast).toBeNull()
  })

  it('Löschen eines Bits, das im Sheet offen ist, schließt das Sheet, ein anderes nicht', () => {
    const commands = makeCommands()
    const sheet = useSheetStore()
    sheet.openDetail('2')
    commands.remove('1')
    expect(sheet.open).toBe(true)
    commands.remove('2')
    expect(sheet.open).toBe(false)
  })

  it('Undo nach dem Löschen eines offenen Bits lässt das Sheet zu', async () => {
    const commands = makeCommands()
    const sheet = useSheetStore()
    sheet.openDetail('1')
    commands.remove('1')
    await useHistoryStore().undoToast()
    expect(visibleIds()).toContain('1')
    expect(sheet.open).toBe(false)
  })

  it('remove ruft den onRemove-Hook mit der ID auf (Fokus-Timer)', () => {
    const onRemove = vi.fn()
    const commands = makeCommands({ onRemove })
    commands.remove('1')
    expect(onRemove).toHaveBeenCalledWith('1')
  })

  it("ein Commit-Fehler macht das Bit wieder sichtbar und zeigt „Couldn't delete“", async () => {
    actions.deleteBit.mockRejectedValue(new Error('offline'))
    const commands = makeCommands()
    const history = useHistoryStore()
    commands.remove('1')
    await vi.advanceTimersByTimeAsync(6000)
    expect(visibleIds()).toEqual(['1', '2', '3'])
    expect(history.toast).toMatchObject({ message: "Couldn't delete", undoable: false })
    expect(history.toast!.entryId).toBeUndefined()
  })

  it('remove eines schon versteckten Bits tut nichts', () => {
    const commands = makeCommands()
    const history = useHistoryStore()
    commands.remove('1')
    const toast = history.toast
    commands.remove('1')
    expect(history.toast).toBe(toast)
  })

  it('pagehide bei offenem Lösch-Toast sendet ein DELETE mit keepalive und keinen zweiten', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const commands = makeCommands()
    const history = useHistoryStore()
    commands.remove('1')
    window.dispatchEvent(new Event('pagehide'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/bit/1', {
      method: 'DELETE',
      keepalive: true,
      credentials: 'include',
    })
    expect(history.toast).toBeNull()
    expect(useBitStore().bits.map((b) => b.id)).toEqual(['2', '3'])
    await vi.advanceTimersByTimeAsync(6000)
    expect(actions.deleteBit).not.toHaveBeenCalled()
  })

  it('pagehide ohne Lösch-Toast sendet nichts', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    makeCommands()
    useBitStore().bits = [bitWith({ status: 0 })]
    window.dispatchEvent(new Event('pagehide'))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
