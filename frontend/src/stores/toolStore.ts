import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type Tool = 'select' | 'flow'
export type WorkflowFilter = 'ready' | 'blocked'
export type DueFilter = 'overdue' | 'today' | 'week'

export interface FilterState {
  workflow: WorkflowFilter[]
  priority: number[]
  due: DueFilter[]
}

export const FILTER_STORAGE_KEY = 'listion-filter'

const WORKFLOW: readonly WorkflowFilter[] = ['ready', 'blocked']
const PRIORITY: readonly number[] = [1, 2, 3]
const DUE: readonly DueFilter[] = ['overdue', 'today', 'week']

function emptyFilters(): FilterState {
  return { workflow: [], priority: [], due: [] }
}

function pick<T>(value: unknown, allowed: readonly T[]): T[] {
  return Array.isArray(value) ? allowed.filter((a) => value.includes(a)) : []
}

/** Per-viewer convenience: anything unreadable simply means "no filters". */
function loadFilters(): FilterState {
  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY)
    if (!raw) return emptyFilters()
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      workflow: pick(parsed.workflow, WORKFLOW),
      priority: pick(parsed.priority, PRIORITY),
      due: pick(parsed.due, DUE),
    }
  } catch {
    return emptyFilters()
  }
}

function saveFilters(filters: FilterState): void {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters))
  } catch {
    /* storage may be unavailable */
  }
}

export function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable ||
    target.contentEditable === 'true'
  )
}

export const useToolStore = defineStore('tool', () => {
  const activeTool = ref<Tool>('select')
  const filterOpen = ref(false)
  const filters = ref<FilterState>(loadFilters())

  const activeFilterCount = computed(
    () => filters.value.workflow.length + filters.value.priority.length + filters.value.due.length,
  )

  function setTool(tool: Tool) {
    activeTool.value = tool
  }

  function toggleFilter<K extends keyof FilterState>(group: K, value: FilterState[K][number]) {
    const list = filters.value[group] as FilterState[K][number][]
    const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
    filters.value = { ...filters.value, [group]: next }
    saveFilters(filters.value)
  }

  function resetFilters() {
    filters.value = emptyFilters()
    saveFilters(filters.value)
  }

  /** Returns true when the key was a tool shortcut and has been handled. */
  function handleShortcut(e: KeyboardEvent): boolean {
    if (e.ctrlKey || e.metaKey || e.altKey || isEditable(e.target)) return false
    const k = e.key.toLowerCase()
    if (k === 'v') setTool('select')
    else if (k === 'f') setTool('flow')
    else if (k === 'escape') {
      setTool('select')
      filterOpen.value = false
    } else return false
    return true
  }

  return {
    activeTool,
    filterOpen,
    filters,
    activeFilterCount,
    setTool,
    toggleFilter,
    resetFilters,
    handleShortcut,
  }
})
