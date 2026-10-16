import { readonly, ref, type Ref } from 'vue'
import { todayKey } from '@/helpers/localDate'

const today = ref(todayKey())
let timer: ReturnType<typeof setTimeout> | null = null

function msUntilMidnight(now = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0)
  return Math.max(1000, next.getTime() - now.getTime())
}

function schedule(): void {
  if (timer !== null) clearTimeout(timer)
  timer = setTimeout(() => {
    today.value = todayKey()
    schedule()
  }, msUntilMidnight())
}

/**
 * A machine waking from sleep after midnight may not have fired the timer yet (or fires it
 * late): look at the clock again when the page comes back, and aim the timer anew.
 */
function recheck(): void {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
  today.value = todayKey()
  schedule()
}

/** Local calendar day as `YYYY-MM-DD`; flips at local midnight. Shared by all callers. */
export function useToday(): Readonly<Ref<string>> {
  if (timer === null) {
    today.value = todayKey()
    schedule()
    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', recheck)
      window.addEventListener('focus', recheck)
    }
  }
  return readonly(today)
}
