import { describe, it, expect } from 'vitest'
import {
  addDays,
  dueToApi,
  formatDayShort,
  fromDateKey,
  toDateKey,
  todayKey,
  weekdayOf,
} from './localDate'

describe('localDate', () => {
  it('bildet lokale Tage ab, nicht UTC', () => {
    expect(toDateKey(new Date(2026, 9, 16, 23, 30))).toBe('2026-10-16')
    expect(toDateKey(new Date(2026, 9, 16, 0, 5))).toBe('2026-10-16')
    expect(todayKey(new Date(2026, 0, 1, 0, 0, 1))).toBe('2026-01-01')
  })

  it('übersteht den Tag der Zeitumstellung', () => {
    expect(toDateKey(fromDateKey('2026-03-29'))).toBe('2026-03-29')
    expect(toDateKey(fromDateKey('2026-10-25'))).toBe('2026-10-25')
    expect(toDateKey(fromDateKey('2026-03-08'))).toBe('2026-03-08')
    expect(fromDateKey('2026-10-16').getHours()).toBe(12)
  })

  it('nimmt bei Strings nur den Datumsteil oder parst das ISO-Datum lokal', () => {
    expect(toDateKey('2026-10-20')).toBe('2026-10-20')
    expect(toDateKey(fromDateKey('2026-10-20').toISOString())).toBe('2026-10-20')
  })

  it('rechnet Tage über Monats- und Jahresgrenzen', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30')
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26')
  })

  it('zählt Wochentage ab Montag', () => {
    expect(weekdayOf('2026-10-19')).toBe(0)
    expect(weekdayOf('2026-10-16')).toBe(4)
    expect(weekdayOf('2026-10-18')).toBe(6)
  })

  it('formatiert Tage kurz', () => {
    const today = '2026-10-16'
    expect(formatDayShort('2026-10-16', today)).toBe('Today')
    expect(formatDayShort('2026-10-17', today)).toBe('Tomorrow')
    expect(formatDayShort('2026-10-15', today)).toBe('Yesterday')
    expect(formatDayShort('2026-10-19', today)).toBe('Mon 19')
    expect(formatDayShort('2026-10-22', today)).toBe('Thu 22')
    expect(formatDayShort('2026-10-10', today)).toBe('Sat 10')
    expect(formatDayShort('2026-10-23', today)).toBe('23 Oct')
    expect(formatDayShort('2026-10-26', today)).toBe('26 Oct')
    expect(formatDayShort('2026-10-09', today)).toBe('9 Oct')
  })

  it('schreibt Fälligkeiten als ISO, die lokal denselben Tag ergeben', () => {
    const iso = dueToApi('2026-10-20')
    expect(iso).not.toBeNull()
    expect(toDateKey(new Date(iso as string))).toBe('2026-10-20')
    expect(dueToApi(null)).toBeNull()
  })
})
