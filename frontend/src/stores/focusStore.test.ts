import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}))
vi.mock('@/helpers/api', () => ({ default: api }))

import { useBitStore, type Bit } from './bitStore'
import { useFocusStore, FOCUS_KEY, FOCUS_PENDING_KEY } from './focusStore'

const T0 = new Date(2026, 9, 16, 10, 0, 0).getTime()

function bit(id: string, extra: Partial<Bit> = {}): Bit {
  return {
    id,
    title: `Bit ${id}`,
    status: 0,
    x: 0,
    y: 0,
    packetId: null,
    order: 0,
    createdAt: '2026-10-14T09:00:00.000Z',
    ...extra,
  }
}

function pendingInStorage(): Record<string, number> {
  return JSON.parse(localStorage.getItem(FOCUS_PENDING_KEY) ?? '{}') as Record<string, number>
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(T0)
  localStorage.clear()
  api.post.mockReset().mockResolvedValue({ data: {} })
  setActivePinia(createPinia())
  useBitStore().bits = [bit('a'), bit('b')]
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('focusStore', () => {
  it('bucht unter 5 Sekunden nichts', async () => {
    const focus = useFocusStore()
    focus.start('a')
    vi.advanceTimersByTime(4000)
    await focus.stop()
    expect(api.post).not.toHaveBeenCalled()
    expect(focus.running).toBeNull()
  })

  it('bucht nach 65 Sekunden 65 Sekunden aufs Bit', async () => {
    const focus = useFocusStore()
    focus.start('a')
    vi.advanceTimersByTime(65_000)
    await focus.stop()
    expect(api.post).toHaveBeenCalledTimes(1)
    expect(api.post).toHaveBeenCalledWith('/api/bit/a/focus', { seconds: 65 })
    expect(useBitStore().bits[0]!.focusSeconds).toBe(65)
    expect(focus.running).toBeNull()
    expect(focus.elapsed).toBe(0)
    expect(localStorage.getItem(FOCUS_KEY)).toBeNull()
  })

  it('tickt jede Sekunde, solange ein Timer läuft, und danach nicht mehr', async () => {
    const focus = useFocusStore()
    focus.start('a')
    expect(focus.elapsed).toBe(0)
    vi.advanceTimersByTime(3000)
    expect(focus.elapsed).toBe(3)
    await focus.stop()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('speichert den laufenden Timer in localStorage', () => {
    const focus = useFocusStore()
    focus.start('a')
    expect(JSON.parse(localStorage.getItem(FOCUS_KEY)!)).toEqual({ bitId: 'a', startedAt: T0 })
  })

  it('stoppt beim Start eines zweiten Timers den ersten und bucht ihn', async () => {
    const focus = useFocusStore()
    focus.start('a')
    vi.advanceTimersByTime(30_000)
    focus.start('b')
    expect(focus.running?.bitId).toBe('b')
    await vi.advanceTimersByTimeAsync(0)
    expect(api.post).toHaveBeenCalledTimes(1)
    expect(api.post).toHaveBeenCalledWith('/api/bit/a/focus', { seconds: 30 })
    expect(focus.elapsed).toBe(0)
  })

  it('lässt einen Start für dasselbe Bit unverändert weiterlaufen', () => {
    const focus = useFocusStore()
    focus.start('a')
    vi.advanceTimersByTime(10_000)
    focus.start('a')
    expect(focus.running?.startedAt).toBe(T0)
    expect(focus.elapsed).toBe(10)
  })

  it('stellt einen Timer aus localStorage wieder her', () => {
    localStorage.setItem(FOCUS_KEY, JSON.stringify({ bitId: 'a', startedAt: T0 - 100_000 }))
    const focus = useFocusStore()
    focus.restore()
    expect(focus.running).toEqual({ bitId: 'a', startedAt: T0 - 100_000 })
    expect(focus.elapsed).toBe(100)
    vi.advanceTimersByTime(2000)
    expect(focus.elapsed).toBe(102)
  })

  it('ignoriert kaputten Inhalt in localStorage beim Wiederherstellen', () => {
    localStorage.setItem(FOCUS_KEY, '{kaputt')
    const focus = useFocusStore()
    focus.restore()
    expect(focus.running).toBeNull()
    localStorage.setItem(FOCUS_KEY, JSON.stringify({ bitId: 5, startedAt: 'x' }))
    focus.restore()
    expect(focus.running).toBeNull()
  })

  it('kappt eine vergessene Sitzung beim Stopp auf 12 Stunden', async () => {
    const focus = useFocusStore()
    focus.start('a')
    vi.setSystemTime(T0 + 13 * 3600 * 1000)
    await focus.stop()
    expect(api.post).toHaveBeenCalledWith('/api/bit/a/focus', { seconds: 43200 })
  })

  it('merkt sich die Sekunden bei einem Fehler und reicht sie später nach', async () => {
    api.post.mockRejectedValueOnce(new Error('offline'))
    const focus = useFocusStore()
    focus.start('a')
    vi.advanceTimersByTime(65_000)
    await focus.stop()
    expect(pendingInStorage()).toEqual({ a: 65 })
    // die lokale Vorab-Erhöhung ist zurückgenommen
    expect(useBitStore().bits[0]!.focusSeconds ?? 0).toBe(0)

    api.post.mockClear()
    await focus.flushPending()
    expect(api.post).toHaveBeenCalledWith('/api/bit/a/focus', { seconds: 65 })
    expect(pendingInStorage()).toEqual({})
    expect(useBitStore().bits[0]!.focusSeconds).toBe(65)
  })

  it('reicht Offenes beim nächsten Stopp mit nach', async () => {
    localStorage.setItem(FOCUS_PENDING_KEY, JSON.stringify({ a: 40 }))
    const focus = useFocusStore()
    focus.start('b')
    vi.advanceTimersByTime(10_000)
    await focus.stop()
    expect(api.post).toHaveBeenCalledWith('/api/bit/b/focus', { seconds: 10 })
    expect(api.post).toHaveBeenCalledWith('/api/bit/a/focus', { seconds: 40 })
    expect(pendingInStorage()).toEqual({})
  })

  it('behält Offenes, wenn das Nachreichen wieder scheitert', async () => {
    localStorage.setItem(FOCUS_PENDING_KEY, JSON.stringify({ a: 40 }))
    api.post.mockRejectedValue(new Error('offline'))
    const focus = useFocusStore()
    await focus.flushPending()
    expect(pendingInStorage()).toEqual({ a: 40 })
  })

  it('verwirft Offenes für ein Bit, das der Server nicht mehr kennt', async () => {
    localStorage.setItem(FOCUS_PENDING_KEY, JSON.stringify({ a: 40, b: 20 }))
    api.post.mockImplementation((url: string) =>
      url.includes('/a/')
        ? Promise.reject({ response: { status: 404 } })
        : Promise.resolve({ data: {} }),
    )
    const focus = useFocusStore()
    await focus.flushPending()
    expect(pendingInStorage()).toEqual({})
  })

  it('fasst Offenes für dasselbe Bit zusammen', async () => {
    api.post.mockRejectedValue(new Error('offline'))
    const focus = useFocusStore()
    for (let i = 0; i < 2; i++) {
      focus.start('a')
      vi.advanceTimersByTime(30_000)
      await focus.stop()
    }
    expect(pendingInStorage()).toEqual({ a: 60 })
  })

  it('cancel beendet den Timer ohne Buchung', async () => {
    const focus = useFocusStore()
    focus.start('a')
    vi.advanceTimersByTime(120_000)
    focus.cancel()
    await vi.advanceTimersByTimeAsync(0)
    expect(focus.running).toBeNull()
    expect(api.post).not.toHaveBeenCalled()
    expect(localStorage.getItem(FOCUS_KEY)).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('arbeitet weiter, wenn localStorage nicht verfügbar ist', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const focus = useFocusStore()
    focus.restore()
    focus.start('a')
    vi.advanceTimersByTime(20_000)
    await focus.stop()
    expect(api.post).toHaveBeenCalledWith('/api/bit/a/focus', { seconds: 20 })
  })
})

describe('bitStore.addFocus', () => {
  it('erhöht lokal vorab und sendet die Sekunden', async () => {
    const store = useBitStore()
    store.bits = [bit('a', { focusSeconds: 100 })]
    const done = store.addFocus('a', 60)
    expect(store.bits[0]!.focusSeconds).toBe(160)
    await done
    expect(api.post).toHaveBeenCalledWith('/api/bit/a/focus', { seconds: 60 })
  })

  it('nimmt die Erhöhung bei einem Fehler zurück und wirft', async () => {
    api.post.mockRejectedValueOnce(new Error('boom'))
    const store = useBitStore()
    store.bits = [bit('a', { focusSeconds: 100 })]
    await expect(store.addFocus('a', 60)).rejects.toThrow('boom')
    expect(store.bits[0]!.focusSeconds).toBe(100)
  })
})
