import { describe, it, expect, beforeEach } from 'vitest'
import { resetPendingCreates, trackCreate, whenCreated } from './pendingCreates'

function deferred() {
  let resolve!: () => void
  let reject!: (e: Error) => void
  const promise = new Promise<void>((res, rej) => ((resolve = res), (reject = rej)))
  return { promise, resolve, reject }
}

beforeEach(() => resetPendingCreates())

describe('pendingCreates', () => {
  it('löst sofort auf für unbekannte oder leere IDs', async () => {
    await expect(whenCreated('x', null, undefined)).resolves.toBeUndefined()
  })

  it('wartet, bis das Erstellen fertig ist', async () => {
    const d = deferred()
    trackCreate('a', d.promise)
    let done = false
    const waiting = whenCreated('a').then(() => (done = true))
    await Promise.resolve()
    expect(done).toBe(false)
    d.resolve()
    await waiting
    expect(done).toBe(true)
    await expect(whenCreated('a')).resolves.toBeUndefined()
  })

  it('wirft, wenn das Erstellen fehlschlug', async () => {
    const d = deferred()
    trackCreate('a', d.promise)
    const waiting = whenCreated('a')
    d.reject(new Error('offline'))
    await expect(waiting).rejects.toThrow('offline')
  })
})
