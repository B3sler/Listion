import { describe, it, expect } from 'vitest'
import { formatClock, formatTracked, formatProgress } from './focusTime'

describe('formatClock', () => {
  it('zeigt Minuten und Sekunden unter einer Stunde', () => {
    expect(formatClock(0)).toBe('0:00')
    expect(formatClock(724)).toBe('12:04')
    expect(formatClock(3599)).toBe('59:59')
  })

  it('zeigt ab einer Stunde auch Stunden', () => {
    expect(formatClock(3600)).toBe('1:00:00')
    expect(formatClock(4324)).toBe('1:12:04')
  })
})

describe('formatTracked', () => {
  it('schreibt Stunden und Minuten', () => {
    expect(formatTracked(4800)).toBe('1 h 20 m')
    expect(formatTracked(2700)).toBe('45 m')
    expect(formatTracked(7200)).toBe('2 h')
  })

  it('zeigt kleine Beträge als unter einer Minute', () => {
    expect(formatTracked(20)).toBe('<1 m')
  })
})

describe('formatProgress', () => {
  it('stellt Summe und Richtwert gegenüber', () => {
    expect(formatProgress(4800, 180)).toBe('1 h 20 of ~3 h')
    expect(formatProgress(2700, 60)).toBe('45 m of ~1 h')
    expect(formatProgress(0, 30)).toBe('0 of ~30 m')
  })
})
