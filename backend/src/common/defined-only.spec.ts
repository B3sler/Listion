import { describe, it, expect } from 'vitest'
import { definedOnly } from './defined-only.js'

describe('definedOnly', () => {
  it('drops undefined values but keeps null, false, 0 and empty strings', () => {
    expect(definedOnly({ a: undefined, b: null, c: false, d: 0, e: '', f: 'x' })).toEqual({
      b: null,
      c: false,
      d: 0,
      e: '',
      f: 'x',
    })
  })

  it('leaves no keys for an object with only undefined values', () => {
    expect(Object.keys(definedOnly({ a: undefined, b: undefined }))).toEqual([])
  })
})
