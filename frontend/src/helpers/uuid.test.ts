import { describe, it, expect } from 'vitest'
import { compareIds, uuidv7 } from './uuid'

const V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('uuidv7', () => {
  it('erzeugt gültige, eindeutige UUIDv7', () => {
    const id = uuidv7()
    expect(id).toMatch(V7)
    expect(uuidv7()).not.toBe(id)
  })

  it('sortiert spätere IDs nach früheren', () => {
    const t = Date.UTC(2026, 9, 14)
    expect(compareIds(uuidv7(t), uuidv7(t + 1))).toBeLessThan(0)
    expect(compareIds('b', 'a')).toBeGreaterThan(0)
    expect(compareIds('a', 'a')).toBe(0)
  })
})
