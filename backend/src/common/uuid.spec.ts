import { describe, it, expect } from 'vitest'
import { isUUID } from 'class-validator'
import { uuidv7 } from './uuid.js'

describe('uuidv7', () => {
  it('erzeugt gültige UUIDs der Version 7', () => {
    const id = uuidv7()
    expect(isUUID(id, '7')).toBe(true)
    expect(uuidv7()).not.toBe(id)
  })

  it('kodiert den Zeitstempel vorne, sodass spätere IDs als String größer sind', () => {
    const t = Date.UTC(2026, 9, 14, 12, 0, 0)
    expect(uuidv7(t).replace(/-/g, '').slice(0, 12)).toBe(t.toString(16).padStart(12, '0'))
    expect(uuidv7(t + 1) > uuidv7(t)).toBe(true)
  })
})
