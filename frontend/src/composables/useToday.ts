import { readonly, ref, type Ref } from 'vue'
import { todayKey } from '@/helpers/localDate'

const today = ref(todayKey())
let timer: ReturnType<typeof setTimeout> | null = null

function msUntilMidnight(now = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0)
  return Math.max(1000, next.getTime() - now.getTime())
}

function schedule(): void {
  timer = setTimeout(() => {
    today.value = todayKey()
    schedule()
  }, msUntilMidnight())
}

/** Local calendar day as `YYYY-MM-DD`; flips at local midnight. Shared by all callers. */
export function useToday(): Readonly<Ref<string>> {
  if (timer === null) {
    today.value = todayKey()
    schedule()
  }
  return readonly(today)
}
