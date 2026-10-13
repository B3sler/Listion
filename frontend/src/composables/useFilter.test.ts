import { describe, it, expect } from 'vitest'
import type { Bit } from '@/stores/bitStore'
import { dueMatches, matchesFilter } from './useFilter'

// Wednesday 14 Oct 2026, 15:00 local → week runs Mon 12 … Sun 18
const TODAY = new Date(2026, 9, 14, 15, 0)
const day = (d: number) => new Date(2026, 9, d, 9, 30).toISOString()
const bit = (extra: Partial<Bit> = {}): Bit => ({
  id: 1,
  title: 'B',
  status: 0,
  x: 0,
  y: 0,
  packetId: null,
  order: 0,
  createdAt: '',
  ...extra,
})
const none = { workflow: [], priority: [], due: [] }

describe('dueMatches', () => {
  it.each([
    [day(13), ['overdue'], true],
    [day(14), ['overdue'], false],
    [day(14), ['today'], true],
    [day(15), ['today'], false],
    [day(14), ['week'], true],
    [day(18), ['week'], true],
    [day(19), ['week'], false],
    [day(13), ['week'], false],
    [day(19), ['today', 'overdue'], false],
  ] as const)('%s / %o → %s', (due, kinds, expected) => {
    expect(dueMatches(due, [...kinds], TODAY)).toBe(expected)
  })

  it('ohne Datum passt kein Fälligkeitsfilter', () => {
    expect(dueMatches(undefined, ['today'], TODAY)).toBe(false)
  })
})

describe('matchesFilter', () => {
  it('ohne Auswahl passt alles', () => {
    expect(matchesFilter(bit(), null, none, TODAY)).toBe(true)
  })

  it('ODER innerhalb einer Gruppe', () => {
    const f = { ...none, priority: [3, 2] }
    expect(matchesFilter(bit({ priority: 2 }), null, f, TODAY)).toBe(true)
    expect(matchesFilter(bit({ priority: 1 }), null, f, TODAY)).toBe(false)
    expect(matchesFilter(bit(), null, f, TODAY)).toBe(false)
  })

  it('UND zwischen Gruppen', () => {
    const f = { workflow: ['ready' as const], priority: [3], due: [] }
    expect(matchesFilter(bit({ priority: 3 }), 'ready', f, TODAY)).toBe(true)
    expect(matchesFilter(bit({ priority: 3 }), 'blocked', f, TODAY)).toBe(false)
    expect(matchesFilter(bit({ priority: 1 }), 'ready', f, TODAY)).toBe(false)
    expect(matchesFilter(bit({ priority: 3 }), null, f, TODAY)).toBe(false)
  })

  it('Fälligkeit als Gruppe', () => {
    const f = { ...none, due: ['today' as const] }
    expect(matchesFilter(bit({ dueDate: day(14) }), null, f, TODAY)).toBe(true)
    expect(matchesFilter(bit({ dueDate: day(16) }), null, f, TODAY)).toBe(false)
  })
})
