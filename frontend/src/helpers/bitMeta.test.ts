import { describe, it, expect } from 'vitest'
import { isOverdue, isSnoozed, SIZE_HEIGHT, SIZE_LABEL, SIZE_MINUTES } from './bitMeta'
import { colorByName, DEFAULT_COLOR, PALETTE } from './palette'

describe('bitMeta', () => {
  it('gesnoozt ist ein Bit nur vor dem Zieltag', () => {
    expect(isSnoozed({ snoozedUntil: '2026-10-17' }, '2026-10-16')).toBe(true)
    expect(isSnoozed({ snoozedUntil: '2026-10-16' }, '2026-10-16')).toBe(false)
    expect(isSnoozed({ snoozedUntil: '2026-10-15' }, '2026-10-16')).toBe(false)
    expect(isSnoozed({ snoozedUntil: null }, '2026-10-16')).toBe(false)
    expect(isSnoozed({}, '2026-10-16')).toBe(false)
  })

  it('überfällig ist nur ein offenes Bit mit Fälligkeit vor heute', () => {
    const today = '2026-10-16'
    expect(isOverdue({ status: 0, dueDate: new Date(2026, 9, 15, 12).toISOString() }, today)).toBe(
      true,
    )
    expect(isOverdue({ status: 1, dueDate: new Date(2026, 9, 1, 12) }, today)).toBe(true)
    expect(isOverdue({ status: 0, dueDate: new Date(2026, 9, 16, 12) }, today)).toBe(false)
    expect(isOverdue({ status: 0, dueDate: new Date(2026, 9, 20, 12) }, today)).toBe(false)
    expect(isOverdue({ status: 2, dueDate: new Date(2026, 9, 1, 12) }, today)).toBe(false)
    expect(isOverdue({ status: 0 }, today)).toBe(false)
  })

  it('liefert Höhen, Minuten und Labels je Aufwand', () => {
    expect(SIZE_HEIGHT).toEqual({ 0: 32, 1: 32, 2: 44, 3: 64, 4: 84 })
    expect(SIZE_MINUTES).toEqual({ 1: 30, 2: 60, 3: 180, 4: 360 })
    expect(SIZE_LABEL).toEqual({ 1: 'S', 2: 'M', 3: 'L', 4: 'XL' })
  })
})

describe('palette', () => {
  it('hat zwölf Farben in Spec-Reihenfolge', () => {
    expect(PALETTE).toHaveLength(12)
    expect(PALETTE[0]).toEqual({ hex: '#ef4444', en: 'red', de: 'rot' })
    expect(PALETTE[11]).toEqual({ hex: '#64748b', en: 'gray', de: 'grau' })
    expect(PALETTE.map((c) => c.en)).toEqual([
      'red',
      'orange',
      'yellow',
      'lime',
      'green',
      'teal',
      'cyan',
      'blue',
      'indigo',
      'violet',
      'pink',
      'gray',
    ])
  })

  it('findet Farben nach deutschem oder englischem Namen', () => {
    expect(DEFAULT_COLOR).toBe('#6366f1')
    expect(colorByName('rot')).toBe('#ef4444')
    expect(colorByName('Red')).toBe('#ef4444')
    expect(colorByName('GRÜN')).toBe('#22c55e')
    expect(colorByName('türkis')).toBe('#14b8a6')
    expect(colorByName('magenta')).toBeUndefined()
  })
})
