import type { Bit } from '@/stores/bitStore'
import type { WorkflowState } from '@/types/flow'
import type { DueFilter, FilterState } from '@/stores/toolStore'

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Due-date groups in local time; weeks run Monday … Sunday. */
export function dueMatches(
  due: Date | string | undefined,
  kinds: DueFilter[],
  today: Date,
): boolean {
  if (!due) return false
  const d = startOfDay(new Date(due))
  const t0 = startOfDay(today)
  const mondayIndex = (today.getDay() + 6) % 7
  const sunday = startOfDay(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + (6 - mondayIndex)),
  )
  return kinds.some((k) =>
    k === 'overdue' ? d < t0 : k === 'today' ? d === t0 : d >= t0 && d <= sunday,
  )
}

/** OR within a group, AND across groups; an empty group does not restrict. */
export function matchesFilter(
  bit: Bit,
  state: WorkflowState,
  filters: FilterState,
  today: Date = new Date(),
): boolean {
  if (filters.workflow.length > 0 && !(state && filters.workflow.includes(state))) return false
  if (filters.priority.length > 0 && !(bit.priority && filters.priority.includes(bit.priority)))
    return false
  if (filters.due.length > 0 && !dueMatches(bit.dueDate, filters.due, today)) return false
  return true
}
