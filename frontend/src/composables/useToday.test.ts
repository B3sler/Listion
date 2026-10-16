import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/** The module keeps one shared day and timer: each test gets a fresh copy. */
async function freshUseToday() {
  vi.resetModules()
  return (await import('./useToday')).useToday
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 16, 23, 0, 0))
})

afterEach(() => {
  vi.useRealTimers()
  Reflect.deleteProperty(document, 'visibilityState')
})

describe('useToday', () => {
  it('springt um Mitternacht auf den nächsten Tag', async () => {
    const today = (await freshUseToday())()
    expect(today.value).toBe('2026-10-16')
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000)
    expect(today.value).toBe('2026-10-17')
  })

  it('prüft den Tag neu, wenn die Seite nach dem Aufwachen wieder sichtbar wird', async () => {
    const today = (await freshUseToday())()
    // the machine slept past midnight: the clock moved on, the timer has not fired
    vi.setSystemTime(new Date(2026, 9, 17, 8, 0, 0))
    expect(today.value).toBe('2026-10-16')

    setVisibility('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(today.value).toBe('2026-10-16')

    setVisibility('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(today.value).toBe('2026-10-17')
  })

  it('prüft den Tag neu, wenn das Fenster den Fokus bekommt', async () => {
    const today = (await freshUseToday())()
    vi.setSystemTime(new Date(2026, 9, 17, 8, 0, 0))
    window.dispatchEvent(new Event('focus'))
    expect(today.value).toBe('2026-10-17')

    // the timer was rescheduled for the next midnight, not the stale one
    await vi.advanceTimersByTimeAsync(16 * 60 * 60 * 1000)
    expect(today.value).toBe('2026-10-18')
  })
})
