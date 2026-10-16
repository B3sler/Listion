/**
 * Calendar days as local `YYYY-MM-DD` keys. Everything here uses local Date getters only —
 * `toISOString().split('T')` would shift the day near midnight in any non-UTC timezone.
 */

const KEY = /^(\d{4})-(\d{2})-(\d{2})$/
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0')
}

function parseKey(key: string): [number, number, number] {
  const m = KEY.exec(key)
  if (!m) throw new Error(`Invalid date key: ${key}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

/** Local `YYYY-MM-DD` of a Date, or of an ISO string (a plain date key passes through). */
export function toDateKey(d: Date | string): string {
  if (typeof d === 'string' && KEY.test(d)) return d
  const date = typeof d === 'string' ? new Date(d) : d
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Local noon of the day: far enough from midnight that DST shifts never change the date. */
export function fromDateKey(key: string): Date {
  const [y, m, d] = parseKey(key)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

export function todayKey(now: Date = new Date()): string {
  return toDateKey(now)
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = parseKey(key)
  return toDateKey(new Date(y, m - 1, d + n, 12, 0, 0, 0))
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayOf(key: string): number {
  return (fromDateKey(key).getDay() + 6) % 7
}

function dayDiff(key: string, from: string): number {
  const [y1, m1, d1] = parseKey(key)
  const [y2, m2, d2] = parseKey(from)
  return Math.round((Date.UTC(y1, m1 - 1, d1) - Date.UTC(y2, m2 - 1, d2)) / 86_400_000)
}

/** 'Today' / 'Tomorrow' / 'Yesterday', within ±6 days 'Fri 20', otherwise '20 Oct'. */
export function formatDayShort(key: string, today: string): string {
  const diff = dayDiff(key, today)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  const [, m, d] = parseKey(key)
  if (Math.abs(diff) <= 6) return `${WEEKDAYS[weekdayOf(key)]} ${d}`
  return `${d} ${MONTHS[m - 1]}`
}

/** Due date for the API: local noon as ISO, so it maps back to the same local day. */
export function dueToApi(key: string | null): string | null {
  return key === null ? null : fromDateKey(key).toISOString()
}
