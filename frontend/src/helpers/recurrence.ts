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
  if (rule === 'monthly') return addMonths(key, 1)
  let next = addDays(key, 1)
  while (weekdayOf(next) >= SATURDAY) next = addDays(next, 1)
  return next
}

/**
 * Repeats one step of the rule until the result is after both `dueKey` and `today`, so overdue
 * bits catch up without piling up missed occurrences. Weekly keeps its weekday. Monthly steps one
 * month at a time and does not remember the original day, so it drifts after short months
 * (31 Jan -> 28 Feb -> 28 Mar); this is accepted.
 */
export function nextDue(dueKey: string, rule: Recurrence, today: string): string {
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
