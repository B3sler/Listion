import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { TOAST_MS, useHistoryStore, type HistoryEntry, type Toast } from './historyStore'

let seq = 0

function entry(over: Partial<HistoryEntry> = {}): HistoryEntry {
  seq++
  return {
    id: `e${seq}`,
    bitId: 'bit-1',
    label: `Eintrag ${seq}`,
    sealed: false,
    undo: vi.fn(async () => {}),
    redo: vi.fn(async () => {}),
    ...over,
  }
}

function toastOf(over: Partial<Toast> = {}): Toast {
  seq++
  return { id: `t${seq}`, message: 'Bit deleted', undoable: true, ...over }
}

beforeEach(() => {
  seq = 0
  vi.useFakeTimers()
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('historyStore: Stapel', () => {
  it('undo ruft undo des obersten Eintrags auf und schiebt ihn auf den Redo-Stapel', async () => {
    const h = useHistoryStore()
    const a = entry()
    const b = entry()
    h.push(a)
    h.push(b)
    expect(h.canUndo).toBe(true)
    expect(h.canRedo).toBe(false)

    await h.undo()
    expect(b.undo).toHaveBeenCalledTimes(1)
    expect(a.undo).not.toHaveBeenCalled()
    expect(h.top()).toBe(a)
    expect(h.canRedo).toBe(true)

    await h.redo()
    expect(b.redo).toHaveBeenCalledTimes(1)
    expect(h.top()).toBe(b)
    expect(h.canRedo).toBe(false)
  })

  it('undo und redo ohne Einträge tun nichts', async () => {
    const h = useHistoryStore()
    await expect(h.undo()).resolves.toBe(false)
    await expect(h.redo()).resolves.toBe(false)
    expect(h.canUndo).toBe(false)
  })

  it('leert den Redo-Stapel bei push nach undo', async () => {
    const h = useHistoryStore()
    h.push(entry())
    await h.undo()
    expect(h.canRedo).toBe(true)
    h.push(entry())
    expect(h.canRedo).toBe(false)
  })

  it('der 51. Eintrag verdrängt den ersten', async () => {
    const h = useHistoryStore()
    const all = Array.from({ length: 51 }, () => entry())
    all.forEach((e) => h.push(e))

    const seen: string[] = []
    all.forEach((e) => {
      e.undo = vi.fn(async () => {
        seen.push(e.id)
      })
    })
    while (h.canUndo) await h.undo()
    expect(seen).toHaveLength(50)
    expect(seen).not.toContain(all[0]!.id)
    expect(seen[49]).toBe(all[1]!.id)
  })

  it('seal versiegelt den obersten Eintrag', () => {
    const h = useHistoryStore()
    const a = entry()
    const b = entry()
    h.push(a)
    h.push(b)
    h.seal()
    expect(b.sealed).toBe(true)
    expect(a.sealed).toBe(false)
  })

  it('seal ohne Einträge wirft nicht', () => {
    const h = useHistoryStore()
    expect(() => h.seal()).not.toThrow()
    expect(h.top()).toBeUndefined()
  })

  it('drop entfernt einen Eintrag aus Undo- und Redo-Stapel', async () => {
    const h = useHistoryStore()
    const a = entry()
    const b = entry()
    const c = entry()
    h.push(a)
    h.push(b)
    h.push(c)
    await h.undo() // c -> Redo
    h.drop(b.id)
    h.drop(c.id)
    expect(h.top()).toBe(a)
    expect(h.canRedo).toBe(false)
    await h.undo()
    expect(b.undo).not.toHaveBeenCalled()
    expect(a.undo).toHaveBeenCalledTimes(1)
  })

  it('undoEntry macht nur einen Eintrag rückgängig, der noch im Stapel liegt', async () => {
    const h = useHistoryStore()
    const a = entry()
    const b = entry()
    h.push(a)
    h.push(b)

    await expect(h.undoEntry(a.id)).resolves.toBe(true)
    expect(a.undo).toHaveBeenCalledTimes(1)
    expect(b.undo).not.toHaveBeenCalled()
    expect(h.top()).toBe(b)
    expect(h.canRedo).toBe(true)

    await expect(h.undoEntry(a.id)).resolves.toBe(false) // schon auf dem Redo-Stapel
    await expect(h.undoEntry('unbekannt')).resolves.toBe(false)
    expect(a.undo).toHaveBeenCalledTimes(1)

    await h.redo()
    expect(a.redo).toHaveBeenCalledTimes(1)
  })

  it('legt den Eintrag zurück und wirft weiter, wenn undo fehlschlägt', async () => {
    const h = useHistoryStore()
    const a = entry()
    const b = entry({ undo: vi.fn(async () => Promise.reject(new Error('kaputt'))) })
    h.push(a)
    h.push(b)

    await expect(h.undo()).rejects.toThrow('kaputt')
    expect(h.top()).toBe(b)
    expect(h.canRedo).toBe(false)

    await expect(h.undoEntry(a.id)).resolves.toBe(true)
    expect(h.top()).toBe(b)
  })

  it('legt den Eintrag an seine Stelle zurück, wenn undoEntry fehlschlägt', async () => {
    const h = useHistoryStore()
    const a = entry({ undo: vi.fn(async () => Promise.reject(new Error('kaputt'))) })
    const b = entry()
    h.push(a)
    h.push(b)

    await expect(h.undoEntry(a.id)).rejects.toThrow('kaputt')
    await h.undo()
    expect(b.undo).toHaveBeenCalledTimes(1)
    await expect(h.undo()).rejects.toThrow('kaputt') // a liegt weiter unter b
    expect(h.canRedo).toBe(true) // nur b
  })

  it('legt den Eintrag zurück und wirft weiter, wenn redo fehlschlägt', async () => {
    const h = useHistoryStore()
    const a = entry({ redo: vi.fn(async () => Promise.reject(new Error('kaputt'))) })
    h.push(a)
    await h.undo()
    await expect(h.redo()).rejects.toThrow('kaputt')
    expect(h.canRedo).toBe(true)
    expect(h.canUndo).toBe(false)
  })

  it('ignoriert ein zweites undo, solange eines läuft', async () => {
    const h = useHistoryStore()
    let release: () => void = () => {}
    const a = entry()
    const b = entry({
      undo: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            release = resolve
          }),
      ),
    })
    h.push(a)
    h.push(b)

    const first = h.undo()
    await expect(h.undo()).resolves.toBe(false)
    await expect(h.redo()).resolves.toBe(false)
    expect(a.undo).not.toHaveBeenCalled()

    release()
    await expect(first).resolves.toBe(true)
    expect(b.undo).toHaveBeenCalledTimes(1)
    expect(h.top()).toBe(a)

    await expect(h.undo()).resolves.toBe(true) // danach wieder möglich
  })

  it('verwirft den Redo-Eintrag, wenn während undo eine neue Aktion kam', async () => {
    const h = useHistoryStore()
    let release: () => void = () => {}
    const a = entry({
      undo: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            release = resolve
          }),
      ),
    })
    h.push(a)
    const pending = h.undo()
    h.push(entry())
    release()
    await pending
    expect(h.canRedo).toBe(false)
  })
})

describe('historyStore: Toast', () => {
  it('führt onCommit nach 6000 ms genau einmal aus, nicht nach 5999 ms', async () => {
    const h = useHistoryStore()
    const onCommit = vi.fn(async () => {})
    h.showToast(toastOf({ onCommit }))
    expect(TOAST_MS).toBe(6000)

    await vi.advanceTimersByTimeAsync(5999)
    expect(onCommit).not.toHaveBeenCalled()
    expect(h.toast).not.toBeNull()

    await vi.advanceTimersByTimeAsync(1)
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(h.toast).toBeNull()

    await vi.advanceTimersByTimeAsync(20000)
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('pause bei 3000 ms, resume nach 10 s: Commit erst 3000 ms nach resume', async () => {
    const h = useHistoryStore()
    const onCommit = vi.fn(async () => {})
    h.showToast(toastOf({ onCommit }))

    await vi.advanceTimersByTimeAsync(3000)
    h.pauseToast()
    await vi.advanceTimersByTimeAsync(10000)
    expect(onCommit).not.toHaveBeenCalled()
    expect(h.toast).not.toBeNull()

    h.resumeToast()
    await vi.advanceTimersByTimeAsync(2999)
    expect(onCommit).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('mehrfaches pause und resume verfälscht die Restzeit nicht', async () => {
    const h = useHistoryStore()
    const onCommit = vi.fn(async () => {})
    h.showToast(toastOf({ onCommit }))

    await vi.advanceTimersByTimeAsync(1000)
    h.pauseToast()
    h.pauseToast()
    await vi.advanceTimersByTimeAsync(500)
    h.resumeToast()
    h.resumeToast()
    await vi.advanceTimersByTimeAsync(4999)
    expect(onCommit).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('ein neuer showToast committet den alten sofort und startet die Zeit neu', async () => {
    const h = useHistoryStore()
    const first = vi.fn(async () => {})
    const second = vi.fn(async () => {})
    h.showToast(toastOf({ onCommit: first }))
    await vi.advanceTimersByTimeAsync(4000)

    const next = toastOf({ onCommit: second })
    h.showToast(next)
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()
    expect(h.toast).toEqual(next)

    await vi.advanceTimersByTimeAsync(5999)
    expect(second).not.toHaveBeenCalled()
    expect(first).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('ein neuer showToast während pause startet mit voller Zeit und läuft', async () => {
    const h = useHistoryStore()
    h.showToast(toastOf())
    h.pauseToast()
    const onCommit = vi.fn(async () => {})
    h.showToast(toastOf({ onCommit }))
    await vi.advanceTimersByTimeAsync(6000)
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('undoToast ruft undo des Eintrags auf und keinen Commit', async () => {
    const h = useHistoryStore()
    const e = entry()
    h.push(e)
    const onCommit = vi.fn(async () => {})
    h.showToast(toastOf({ entryId: e.id, onCommit }))

    await h.undoToast()
    expect(e.undo).toHaveBeenCalledTimes(1)
    expect(onCommit).not.toHaveBeenCalled()
    expect(h.toast).toBeNull()

    await vi.advanceTimersByTimeAsync(20000)
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('undoToast ohne Toast oder ohne entryId tut nichts', async () => {
    const h = useHistoryStore()
    await expect(h.undoToast()).resolves.toBeUndefined()
    const onCommit = vi.fn(async () => {})
    h.showToast(toastOf({ undoable: false, onCommit }))
    await h.undoToast()
    expect(h.toast).not.toBeNull()
    await vi.advanceTimersByTimeAsync(6000)
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('undoToast tut nichts, solange ein anderes undo läuft, und lässt den Toast stehen', async () => {
    const h = useHistoryStore()
    let release: () => void = () => {}
    const e = entry()
    const slow = entry({
      undo: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            release = resolve
          }),
      ),
    })
    h.push(e)
    h.push(slow)
    const onCommit = vi.fn(async () => {})
    h.showToast(toastOf({ entryId: e.id, onCommit }))

    const running = h.undo()
    await h.undoToast()
    expect(e.undo).not.toHaveBeenCalled()
    expect(h.toast).not.toBeNull()
    release()
    await running

    await vi.advanceTimersByTimeAsync(6000)
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('wirft weiter und lässt den Toast samt Commit-Frist stehen, wenn undoToast fehlschlägt', async () => {
    const h = useHistoryStore()
    const e = entry({ undo: vi.fn(async () => Promise.reject(new Error('kaputt'))) })
    h.push(e)
    const onCommit = vi.fn(async () => {})
    h.showToast(toastOf({ entryId: e.id, onCommit }))

    await vi.advanceTimersByTimeAsync(2000)
    await expect(h.undoToast()).rejects.toThrow('kaputt')
    expect(h.toast).not.toBeNull()
    await vi.advanceTimersByTimeAsync(3999)
    expect(onCommit).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('dismissToast entfernt den Toast ohne Commit', async () => {
    const h = useHistoryStore()
    const onCommit = vi.fn(async () => {})
    h.showToast(toastOf({ onCommit }))
    h.dismissToast()
    expect(h.toast).toBeNull()
    await vi.advanceTimersByTimeAsync(20000)
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('pause und resume ohne Toast tun nichts', () => {
    const h = useHistoryStore()
    expect(() => {
      h.pauseToast()
      h.resumeToast()
    }).not.toThrow()
    expect(h.toast).toBeNull()
  })

  it('meldet fehlschlagende onCommit mit console.error statt sie zu verschlucken', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const h = useHistoryStore()
    const boom = new Error('Commit kaputt')
    h.showToast(toastOf({ onCommit: async () => Promise.reject(boom) }))
    await vi.advanceTimersByTimeAsync(6000)
    expect(error).toHaveBeenCalledWith(expect.any(String), boom)
    expect(h.toast).toBeNull()

    h.showToast(
      toastOf({
        onCommit: () => {
          throw boom
        },
      }),
    )
    h.showToast(toastOf()) // Ersetzen committet den alten
    expect(error).toHaveBeenCalledTimes(2)
    expect(h.toast).not.toBeNull()
  })
})

describe('historyStore: Toast-Undo ohne Eintrag, dropBit', () => {
  it('undoToast committet, wenn der Eintrag nicht mehr auf dem Stapel liegt', async () => {
    const h = useHistoryStore()
    const e = entry()
    h.push(e)
    const onCommit = vi.fn(async () => {})
    h.showToast(toastOf({ entryId: e.id, onCommit }))
    h.drop(e.id)

    await h.undoToast()
    expect(e.undo).not.toHaveBeenCalled()
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(h.toast).toBeNull()
    await vi.advanceTimersByTimeAsync(20000)
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('dropBit entfernt alle Einträge eines Bits aus beiden Stapeln', async () => {
    const h = useHistoryStore()
    const a = entry({ bitId: 'x' })
    const b = entry({ bitId: 'y' })
    const c = entry({ bitId: 'x' })
    h.push(a)
    h.push(b)
    h.push(c)
    await h.undo()
    h.dropBit('x')
    expect(h.canRedo).toBe(false)
    expect(h.top()).toBe(b)
    await h.undo()
    expect(h.canUndo).toBe(false)
    expect(a.undo).not.toHaveBeenCalled()
  })
})

describe('historyStore: Abmelden und Verlassen', () => {
  it('commitToast führt onCommit sofort aus, wartet darauf und räumt den Toast ab', async () => {
    const h = useHistoryStore()
    let finish!: () => void
    const onCommit = vi.fn(() => new Promise<void>((r) => (finish = r)))
    h.showToast(toastOf({ onCommit }))

    let done = false
    const committing = h.commitToast().then(() => (done = true))
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(h.toast).toBeNull()
    await Promise.resolve()
    expect(done).toBe(false)
    finish()
    await committing
    expect(done).toBe(true)

    // its expiry does not commit a second time
    await vi.advanceTimersByTimeAsync(TOAST_MS * 2)
    expect(onCommit).toHaveBeenCalledTimes(1)
  })

  it('commitToast ohne Toast oder ohne onCommit löst sofort auf', async () => {
    const h = useHistoryStore()
    await expect(h.commitToast()).resolves.toBeUndefined()
    h.showToast(toastOf())
    await expect(h.commitToast()).resolves.toBeUndefined()
    expect(h.toast).toBeNull()
  })

  it('commitToast meldet ein fehlschlagendes onCommit und löst trotzdem auf', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const h = useHistoryStore()
    h.showToast(toastOf({ onCommit: () => Promise.reject(new Error('offline')) }))
    await expect(h.commitToast()).resolves.toBeUndefined()
    expect(error).toHaveBeenCalled()
  })

  it('clear leert beide Stapel und nimmt den Toast ohne Commit weg', async () => {
    const h = useHistoryStore()
    const onCommit = vi.fn(async () => {})
    h.push(entry())
    h.push(entry())
    await h.undo()
    h.showToast(toastOf({ onCommit }))
    expect(h.canUndo).toBe(true)
    expect(h.canRedo).toBe(true)

    h.clear()
    expect(h.canUndo).toBe(false)
    expect(h.canRedo).toBe(false)
    expect(h.toast).toBeNull()
    await vi.advanceTimersByTimeAsync(TOAST_MS * 2)
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('ein undo, das während clear noch läuft, landet danach auf keinem Stapel', async () => {
    const h = useHistoryStore()
    let finish!: () => void
    h.push(entry({ undo: () => new Promise<void>((r) => (finish = r)) }))
    const running = h.undo()
    h.clear()
    finish()
    await running
    expect(h.canUndo).toBe(false)
    expect(h.canRedo).toBe(false)
  })
})
