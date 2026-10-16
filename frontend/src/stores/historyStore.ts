import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import type { Bit } from '@/stores/bitStore'

export const HISTORY_LIMIT = 50
export const TOAST_MS = 6000

export interface HistoryEntry {
  id: string
  bitId: string
  label: string
  /** Entries with the same key merge while open (typing steps); the owner decides when. */
  coalesceKey?: string
  /** A sealed entry accepts no further merges. */
  sealed: boolean
  patch?: { before: Partial<Bit>; after: Partial<Bit> }
  undo(): Promise<void>
  redo(): Promise<void>
}

export interface Toast {
  id: string
  message: string
  undoable: boolean
  entryId?: string
  /** Runs once when the toast expires or is replaced, never after undo or dismiss. */
  onCommit?: () => Promise<void>
}

/**
 * Bit-scoped undo/redo history plus the state of the single undo toast. Pure state: it knows
 * nothing about bitStore or sheetStore, the commands put their behaviour into the entries.
 * Entries are plain objects, hence shallow refs (identity must survive for `drop`/`undoEntry`).
 */
export const useHistoryStore = defineStore('history', () => {
  const undoStack = shallowRef<HistoryEntry[]>([])
  const redoStack = shallowRef<HistoryEntry[]>([])
  /** Bumped by every push, so an undo/redo that finishes later can tell it is stale. */
  let epoch = 0
  /** Bumped by `clear`, so an undo/redo still running puts its entry on no stack afterwards. */
  let generation = 0
  let busy = false

  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)

  function push(entry: HistoryEntry) {
    epoch++
    redoStack.value = []
    const next = [...undoStack.value, entry]
    undoStack.value = next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next
  }

  function top(): HistoryEntry | undefined {
    return undoStack.value[undoStack.value.length - 1]
  }

  function seal() {
    const entry = top()
    if (entry) entry.sealed = true
  }

  function drop(id: string) {
    undoStack.value = undoStack.value.filter((e) => e.id !== id)
    redoStack.value = redoStack.value.filter((e) => e.id !== id)
  }

  /** Forgets every entry of a bit that no longer exists, so Ctrl+Z goes on with the next one. */
  function dropBit(bitId: string) {
    undoStack.value = undoStack.value.filter((e) => e.bitId !== bitId)
    redoStack.value = redoStack.value.filter((e) => e.bitId !== bitId)
  }

  function insertAt(stack: HistoryEntry[], index: number, entry: HistoryEntry): HistoryEntry[] {
    const at = Math.min(index, stack.length)
    return [...stack.slice(0, at), entry, ...stack.slice(at)]
  }

  /**
   * Moves the entry at `index` from `from` to `to` around its `run`. A failure puts it back where
   * it was and rethrows. While one is running, further calls are ignored (return false): double
   * key presses or a click during the await must not run two undos over the same state.
   */
  async function transfer(
    from: typeof undoStack,
    to: typeof undoStack,
    toRedo: boolean,
    index: number,
    run: (entry: HistoryEntry) => Promise<void>,
  ): Promise<boolean> {
    if (busy) return false
    const entry = from.value[index]
    if (!entry) return false
    busy = true
    const startEpoch = epoch
    const startGeneration = generation
    from.value = from.value.filter((e) => e !== entry)
    try {
      await run(entry)
    } catch (e) {
      if (generation === startGeneration) from.value = insertAt(from.value, index, entry)
      throw e
    } finally {
      busy = false
    }
    if (generation !== startGeneration) return true
    // A new action while we were waiting already cleared Redo; do not resurrect an outdated entry.
    if (toRedo && epoch !== startEpoch) return true
    to.value = [...to.value, entry]
    return true
  }

  function undo(): Promise<boolean> {
    return transfer(undoStack, redoStack, true, undoStack.value.length - 1, (e) => e.undo())
  }

  function redo(): Promise<boolean> {
    return transfer(redoStack, undoStack, false, redoStack.value.length - 1, (e) => e.redo())
  }

  /** Undoes one specific entry (the toast's), but only while it is still on the undo stack. */
  function undoEntry(id: string): Promise<boolean> {
    const index = undoStack.value.findIndex((e) => e.id === id)
    return transfer(undoStack, redoStack, true, index, (e) => e.undo())
  }

  // --- Toast ---------------------------------------------------------------------------------

  const toast = ref<Toast | null>(null)
  let timer: ReturnType<typeof setTimeout> | null = null
  let remaining = TOAST_MS
  let startedAt = 0
  let paused = false

  function clearTimer() {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  async function commit(t: Toast) {
    if (!t.onCommit) return
    try {
      await t.onCommit()
    } catch (e) {
      console.error('Toast commit failed', e)
    }
  }

  function startTimer() {
    clearTimer()
    startedAt = Date.now()
    timer = setTimeout(expire, remaining)
  }

  function expire() {
    timer = null
    const t = toast.value
    toast.value = null
    if (t) void commit(t)
  }

  function showToast(next: Toast) {
    clearTimer()
    const previous = toast.value
    toast.value = next
    remaining = TOAST_MS
    paused = false
    startTimer()
    if (previous) void commit(previous)
  }

  function pauseToast() {
    if (!toast.value || paused) return
    paused = true
    remaining = Math.max(0, remaining - (Date.now() - startedAt))
    clearTimer()
  }

  function resumeToast() {
    if (!toast.value || !paused) return
    paused = false
    startTimer()
  }

  function dismissToast() {
    clearTimer()
    toast.value = null
    paused = false
  }

  /**
   * Commits the toast's action now and waits for it (e.g. before logging out, while the session
   * still allows the request). The toast goes away; its expiry does not commit a second time.
   */
  async function commitToast(): Promise<void> {
    const t = toast.value
    dismissToast()
    if (t) await commit(t)
  }

  /** Forgets everything (leaving the workspace): no entries, the toast goes without a commit. */
  function clear() {
    generation++
    epoch++
    undoStack.value = []
    redoStack.value = []
    dismissToast()
  }

  /**
   * Undo via the toast: no commit. If the undo fails the toast stays and its clock keeps going.
   * If its entry is gone (dropped, or pushed off the stack), nothing was undone, so the action
   * stands and the toast commits like on expiry — a deferred delete must not stay pending forever.
   */
  async function undoToast() {
    const t = toast.value
    if (!t?.entryId || busy) return
    const wasPaused = paused
    pauseToast()
    let undone: boolean
    try {
      undone = await undoEntry(t.entryId)
    } catch (e) {
      if (toast.value === t && !wasPaused) resumeToast()
      throw e
    }
    // Replaced meanwhile: showToast already ran this toast's commit, so leave the new one alone.
    if (toast.value !== t) return
    dismissToast()
    if (!undone) void commit(t)
  }

  return {
    canUndo,
    canRedo,
    push,
    top,
    seal,
    drop,
    dropBit,
    undo,
    redo,
    undoEntry,
    toast,
    showToast,
    pauseToast,
    resumeToast,
    undoToast,
    dismissToast,
    commitToast,
    clear,
  }
})
