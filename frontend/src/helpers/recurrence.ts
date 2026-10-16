import type { Bit } from '@/stores/bitStore'
import { addDays, dueToApi, toDateKey, weekdayOf } from './localDate'

export type Recurrence = 'daily' | 'weekdays' | 'weekly' | 'monthly'

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  daily: 'Daily',
  weekdays: 'Weekdays',
  weekly: 'Weekly',
  monthly: 'Monthly',
}

const SATURDAY = 5

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

/** `dueKey` shifted by `n` months; the day is clamped to the target month's last day. */
function addMonths(dueKey: string, n: number): string {
  const [y, m, d] = dueKey.split('-').map(Number)
  const index = y * 12 + (m - 1) + n
  const year = Math.floor(index / 12)
  const month = (index % 12) + 1
  const day = Math.min(d, daysInMonth(year, month))
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** One step of the rule from `key`. */
function step(key: string, rule: Recurrence): string {
  if (rule === 'daily') return addDays(key, 1)
  if (rule === 'weekly') return addDays(key, 7)
  let next = addDays(key, 1)
  while (weekdayOf(next) >= SATURDAY) next = addDays(next, 1)
  return next
}

/**
 * The first occurrence of the rule after both `dueKey` and `today`. Overdue bits catch up
 * without piling up missed occurrences; weekly and monthly keep their weekday / day of month.
 */
export function nextDue(dueKey: string, rule: Recurrence, today: string): string {
  if (rule === 'monthly') {
    // Always count from the original day so Jan 31 -> Feb 28 -> Mar 31 does not drift to the 28th.
    let months = 1
    let next = addMonths(dueKey, months)
    while (next <= today) next = addMonths(dueKey, ++months)
    return next
  }
  let next = step(dueKey, rule)
  while (next <= today) next = step(next, rule)
  return next
}

/** First due day of a newly repeating bit: today, on weekends the next Monday for `weekdays`. */
export function firstDue(rule: Recurrence, today: string): string {
  if (rule !== 'weekdays') return today
  let key = today
  while (weekdayOf(key) >= SATURDAY) key = addDays(key, 1)
  return key
}

/** Fields to change when a bit is completed: repeating bits roll forward in place. */
export function completionPatch(bit: Bit, today: string): Partial<Bit> {
  const rule = bit.recurrence
  if (!rule) return { status: 2 }
  const dueKey = bit.dueDate ? toDateKey(bit.dueDate) : today
  return {
    status: 0,
    dueDate: dueToApi(nextDue(dueKey, rule, today)) ?? undefined,
    completedCount: (bit.completedCount ?? 0) + 1,
  }
}
