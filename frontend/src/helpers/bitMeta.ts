import type { Bit } from '@/stores/bitStore'
import { toDateKey } from './localDate'

/** Capsule height in px per effort size (0 = no size set). */
export const SIZE_HEIGHT: Record<0 | 1 | 2 | 3 | 4, number> = { 0: 32, 1: 32, 2: 44, 3: 64, 4: 84 }

export const SIZE_MINUTES = { 1: 30, 2: 60, 3: 180, 4: 360 } as const

export const SIZE_LABEL = { 1: 'S', 2: 'M', 3: 'L', 4: 'XL' } as const

export const PRIORITY_NAME: Record<1 | 2 | 3, string> = { 1: 'Low', 2: 'Medium', 3: 'High' }

/** Snoozed only strictly before the target day; on the day itself the bit is back. */
export function isSnoozed(bit: Pick<Bit, 'snoozedUntil'>, today: string): boolean {
  return !!bit.snoozedUntil && bit.snoozedUntil > today
}

/** Open (not done) with a due day before today. */
export function isOverdue(bit: Pick<Bit, 'status' | 'dueDate'>, today: string): boolean {
  if (bit.status === 2 || !bit.dueDate) return false
  return toDateKey(bit.dueDate) < today
}
