import { describe, it, expect } from 'vitest'
import type { Bit } from '@/stores/bitStore'
import { RECURRENCE_LABEL, completionPatch, firstDue, nextDue, type Recurrence } from './recurrence'
import { dueToApi } from './localDate'

function makeBit(overrides: Partial<Bit> = {}): Bit {
  return {
    id: 'b1',
    title: 'Bit',
    status: 1,
    x: 0,
    y: 0,
    packetId: null,
    order: 0,
    createdAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  }
}

describe('recurrence', () => {
  const cases: [string, Recurrence, string, string][] = [
    ['2026-10-16', 'daily', '2026-10-16', '2026-10-17'],
    ['2026-10-01', 'daily', '2026-10-16', '2026-10-17'],
    ['2026-10-16', 'weekdays', '2026-10-16', '2026-10-19'],
    ['2026-10-16', 'weekly', '2026-10-16', '2026-10-23'],
    ['2026-09-04', 'weekly', '2026-10-16', '2026-10-23'],
    ['2028-01-31', 'monthly', '2028-01-31', '2028-02-29'],
    ['2028-02-29', 'monthly', '2028-02-29', '2028-03-29'],
    ['2027-01-31', 'monthly', '2027-01-31', '2027-02-28'],
  ]

  it.each(cases)('nextDue(%s, %s, %s) = %s', (due, rule, today, expected) => {
    expect(nextDue(due, rule, today)).toBe(expected)
  })

  it('springt bei Wochentagen über das Wochenende', () => {
    expect(nextDue('2026-10-14', 'weekdays', '2026-10-14')).toBe('2026-10-15')
    expect(nextDue('2026-10-10', 'weekdays', '2026-10-10')).toBe('2026-10-12')
  })

  it('steppt beim monatlichen Aufholen Monat für Monat (Drift nach kurzen Monaten ist gewollt)', () => {
    expect(nextDue('2027-01-31', 'monthly', '2027-03-01')).toBe('2027-03-28')
  })

  it('liefert nie ein Datum in der Vergangenheit oder heute', () => {
    expect(nextDue('2026-01-01', 'monthly', '2026-10-16') > '2026-10-16').toBe(true)
  })

  it('beschriftet jede Regel', () => {
    expect(RECURRENCE_LABEL).toEqual({
      daily: 'Daily',
      weekdays: 'Weekdays',
      weekly: 'Weekly',
      monthly: 'Monthly',
    })
  })

  it('firstDue ist heute, bei Wochentagen am Wochenende der nächste Montag', () => {
    expect(firstDue('daily', '2026-10-17')).toBe('2026-10-17')
    expect(firstDue('weekdays', '2026-10-16')).toBe('2026-10-16')
    expect(firstDue('weekdays', '2026-10-17')).toBe('2026-10-19')
    expect(firstDue('weekdays', '2026-10-18')).toBe('2026-10-19')
  })

  it('completionPatch erledigt ein Bit ohne Regel', () => {
    expect(completionPatch(makeBit(), '2026-10-16')).toEqual({ status: 2 })
    expect(completionPatch(makeBit({ recurrence: null }), '2026-10-16')).toEqual({ status: 2 })
  })

  it('completionPatch rollt ein wiederkehrendes Bit weiter', () => {
    const bit = makeBit({ recurrence: 'daily', dueDate: '2026-10-16', completedCount: 2 })
    expect(completionPatch(bit, '2026-10-16')).toEqual({
      status: 0,
      dueDate: dueToApi('2026-10-17'),
      completedCount: 3,
    })
  })

  it('completionPatch startet ohne Fälligkeit bei heute', () => {
    const bit = makeBit({ recurrence: 'weekly' })
    expect(completionPatch(bit, '2026-10-16')).toEqual({
      status: 0,
      dueDate: dueToApi('2026-10-23'),
      completedCount: 1,
    })
  })
})
