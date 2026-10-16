const pad = (n: number) => String(n).padStart(2, '0')

/** Stopwatch face: 724 -> '12:04', 4324 -> '1:12:04'. */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

function split(minutes: number): { h: number; m: number } {
  return { h: Math.floor(minutes / 60), m: minutes % 60 }
}

/** Tracked total: 4800 -> '1 h 20 m', 2700 -> '45 m', 7200 -> '2 h', 20 -> '<1 m'. */
export function formatTracked(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  if (minutes < 1) return '<1 m'
  const { h, m } = split(minutes)
  if (h === 0) return `${m} m`
  return m === 0 ? `${h} h` : `${h} h ${m} m`
}

/** Bar label: total against the size's guide time, e.g. '1 h 20 of ~3 h'. */
export function formatProgress(seconds: number, targetMinutes: number): string {
  const minutes = Math.round(seconds / 60)
  const { h, m } = split(minutes)
  const total = minutes === 0 ? '0' : h === 0 ? `${m} m` : m === 0 ? `${h} h` : `${h} h ${m}`
  const target = split(targetMinutes)
  const guide =
    target.h === 0 ? `${target.m} m` : target.m === 0 ? `${target.h} h` : `${targetMinutes} m`
  return `${total} of ~${guide}`
}
