import { getCurrentScope, onScopeDispose, type InjectionKey } from 'vue'
import api from '@/helpers/api'
import { useBitStore, type Bit } from '@/stores/bitStore'
import { useDependencyStore } from '@/stores/dependencyStore'
import { useHistoryStore, type HistoryEntry } from '@/stores/historyStore'
import { useSheetStore } from '@/stores/sheetStore'
import { completionPatch } from '@/helpers/recurrence'
import { dueToApi, formatDayShort, todayKey, toDateKey } from '@/helpers/localDate'
import { uuidv7 } from '@/helpers/uuid'
import { useFlowActions } from './useFlowActions'
import type { FlowLayout } from './useFlowLayout'

export type CreateFields = Pick<Bit, 'title'> &
  Partial<
    Pick<Bit, 'id' | 'status' | 'priority' | 'dueDate' | 'notes' | 'color' | 'size' | 'recurrence'>
  >

export interface UpdateMeta {
  label?: string
  coalesce?: 'title' | 'notes'
}

export interface BitCommands {
  update(id: string, patch: Partial<Bit>, meta?: UpdateMeta): Promise<void>
  /** Repeating bits roll to their next due day; `rolledTo` is that day, otherwise null. */
  complete(id: string): Promise<{ rolledTo: string | null }>
  reopen(id: string): Promise<void>
  remove(id: string): void
  create(fields: CreateFields, pos: { x: number; y: number }, flowId: string | null): Promise<Bit>
  removeDependency(depId: string): Promise<void>
}

export interface BitCommandsOptions {
  layout: () => FlowLayout
  /** Runs when a bit is deleted (hidden): stops a focus timer on it (Task 23). */
  onRemove?: (id: string) => void
}

export const BIT_COMMANDS: InjectionKey<BitCommands> = Symbol('bit-commands')

function toApiDate(d: Date): string | undefined {
  return dueToApi(toDateKey(d)) ?? undefined
}

/** How long a repeating bit shows as done before it rolls to its next day. */
const ROLL_DELAY_MS = 800
/** A typing step (title, notes) ends after this much rest. */
const COALESCE_MS = 1500

type Patch = Partial<Bit>

/**
 * What a field held before, as a value the API takes back: an unset field is cleared with null
 * (undefined would be dropped from the JSON body and leave the new value on the server).
 */
function restorable(key: keyof Bit, value: unknown): unknown {
  if (value !== undefined) return value
  if (key === 'notes') return ''
  if (key === 'completedCount') return 0
  return null
}

function beforeOf(bit: Bit | undefined, keys: (keyof Bit)[]): Patch {
  const before: Record<string, unknown> = {}
  for (const k of keys) before[k] = restorable(k, bit?.[k])
  return before as Patch
}

/** A deferred delete: hidden at once, sent when its toast commits. */
interface PendingDelete {
  bitId: string
  toastId: string
  state: 'pending' | 'committing' | 'undone'
}

/**
 * Every command records a history entry, so the toast and Ctrl+Z can take it back. Deleting
 * only hides the bit; the DELETE goes out once its toast expires or is replaced (or on pagehide).
 */
export function useBitCommands(opts: BitCommandsOptions): BitCommands {
  const bitStore = useBitStore()
  const dependencyStore = useDependencyStore()
  const history = useHistoryStore()
  const sheet = useSheetStore()
  const actions = useFlowActions()

  const exists = (id: string) => bitStore.bits.some((b) => b.id === id)
  const find = (id: string) => bitStore.bits.find((b) => b.id === id)

  /** Sets fields locally only (nothing sent), e.g. the moment a repeating bit shows as done. */
  function showLocally(id: string, patch: Patch) {
    const at = bitStore.bits.findIndex((b) => b.id === id)
    if (at !== -1) bitStore.bits[at] = { ...bitStore.bits[at]!, ...patch }
  }

  // --- History helpers -----------------------------------------------------------------------

  let sealTimer: ReturnType<typeof setTimeout> | null = null

  function clearSealTimer() {
    if (sealTimer !== null) clearTimeout(sealTimer)
    sealTimer = null
  }

  /** A new entry ends the open typing step below it. */
  function record(entry: HistoryEntry) {
    clearSealTimer()
    history.seal()
    history.push(entry)
  }

  function dropEntry(entry: HistoryEntry, toastId?: string) {
    history.drop(entry.id)
    if (toastId && history.toast?.id === toastId) history.dismissToast()
  }

  /** Undo and redo of a bit that is gone (deleted meanwhile) have nothing left to change. */
  function patchEntry(id: string, label: string, before: Patch, after: Patch): HistoryEntry {
    const entry: HistoryEntry = {
      id: uuidv7(),
      bitId: id,
      label,
      sealed: true,
      patch: { before, after },
      undo: () => (exists(id) ? bitStore.queueUpdate(id, entry.patch!.before) : Promise.resolve()),
      redo: () => (exists(id) ? bitStore.queueUpdate(id, entry.patch!.after) : Promise.resolve()),
    }
    return entry
  }

  // --- update --------------------------------------------------------------------------------

  function update(id: string, patch: Patch, meta: UpdateMeta = {}): Promise<void> {
    const keys = Object.keys(patch) as (keyof Bit)[]
    const before = beforeOf(find(id), keys)
    const top = history.top()
    const key = meta.coalesce
    if (key && top && !top.sealed && top.bitId === id && top.coalesceKey === key && top.patch) {
      // the same typing step: keep its first `before`, take the latest `after`
      for (const k of keys) {
        if (!(k in top.patch.before)) (top.patch.before as Record<string, unknown>)[k] = before[k]
      }
      Object.assign(top.patch.after, patch)
    } else {
      const entry = patchEntry(id, meta.label ?? 'Edit', before, { ...patch })
      if (key) {
        entry.coalesceKey = key
        entry.sealed = false
      }
      record(entry)
    }
    if (key) {
      clearSealTimer()
      const open = history.top()
      sealTimer = setTimeout(() => {
        sealTimer = null
        // the step may have been undone meanwhile; seal it, not whatever is on top now
        if (history.top() === open) history.seal()
        else if (open) open.sealed = true
      }, COALESCE_MS)
    }
    return bitStore.queueUpdate(id, patch)
  }

  // --- complete / reopen ---------------------------------------------------------------------

  /** Repeating bits shown as done that wait to roll. */
  const rolling = new Map<
    string,
    { timer: ReturnType<typeof setTimeout>; startStatus: number; settle: () => void }
  >()
  /** The completion toast still up, so reopening the same bit can take it away. */
  let completionToast: { bitId: string; toastId: string; entry: HistoryEntry } | null = null

  /**
   * Stops a pending roll: the bit shows its status from before the tick again (nothing was
   * sent), the waiting `complete` resolves with no roll.
   */
  function cancelRoll(id: string): boolean {
    const waiting = rolling.get(id)
    if (!waiting) return false
    clearTimeout(waiting.timer)
    rolling.delete(id)
    showLocally(id, { status: waiting.startStatus })
    waiting.settle()
    return true
  }

  /** The roll of a repeating bit, from its state now (an edit during the 800 ms counts). */
  function rollOf(bit: Bit, startStatus: number): { before: Patch; after: Patch } {
    const after = completionPatch({ ...bit, status: startStatus }, todayKey())
    const before = beforeOf({ ...bit, status: startStatus }, Object.keys(after) as (keyof Bit)[])
    return { before, after }
  }

  function showCompletionToast(id: string, entry: HistoryEntry, rolledTo: string | null) {
    const toastId = uuidv7()
    history.showToast({
      id: toastId,
      message: rolledTo ? `↻ Next: ${formatDayShort(rolledTo, todayKey())}` : 'Done',
      undoable: true,
      entryId: entry.id,
    })
    completionToast = { bitId: id, toastId, entry }
  }

  function failCompletion(entry: HistoryEntry) {
    const t = completionToast
    dropEntry(entry, t?.entry === entry ? t.toastId : undefined)
    if (t?.entry === entry) completionToast = null
  }

  function complete(id: string): Promise<{ rolledTo: string | null }> {
    const bit = find(id)
    if (!bit) return Promise.resolve({ rolledTo: null })
    if (!bit.recurrence) {
      const entry = patchEntry(id, 'Complete', { status: bit.status }, { status: 2 })
      record(entry)
      showCompletionToast(id, entry, null)
      return bitStore.queueUpdate(id, { status: 2 }).then(
        () => ({ rolledTo: null }),
        (e: unknown) => {
          failCompletion(entry)
          throw e
        },
      )
    }
    if (rolling.has(id)) return Promise.resolve({ rolledTo: null })

    const startStatus = bit.status
    // shown as done for a moment; nothing is sent yet
    showLocally(id, { status: 2 })
    // the toast names the day right away; the roll itself is computed when it happens
    const preview = completionPatch(bit, todayKey()).dueDate
    const entry: HistoryEntry = {
      id: uuidv7(),
      bitId: id,
      label: 'Complete',
      sealed: true,
      async undo() {
        if (cancelRoll(id)) return
        if (exists(id) && entry.patch) await bitStore.queueUpdate(id, entry.patch.before)
      },
      async redo() {
        const current = find(id)
        if (!current) return
        // undone before it rolled: roll now, from the state now
        entry.patch ??= rollOf(current, current.status)
        await bitStore.queueUpdate(id, entry.patch.after)
      },
    }
    record(entry)
    showCompletionToast(id, entry, preview ? toDateKey(preview) : null)

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        rolling.delete(id)
        const current = find(id)
        if (!current) return resolve({ rolledTo: null })
        // back to the stored state first, so a failed save undoes the roll, not the tick
        showLocally(id, { status: startStatus })
        entry.patch = rollOf(current, startStatus)
        const due = entry.patch.after.dueDate
        const rolledTo = due ? toDateKey(due) : null
        bitStore.queueUpdate(id, entry.patch.after).then(
          () => resolve({ rolledTo }),
          (e: unknown) => {
            failCompletion(entry)
            reject(e)
          },
        )
      }, ROLL_DELAY_MS)
      rolling.set(id, { timer, startStatus, settle: () => resolve({ rolledTo: null }) })
    })
  }

  function reopen(id: string): Promise<void> {
    if (cancelRoll(id)) {
      // reopening inside the 800 ms takes the tick back, toast and entry included
      const t = completionToast
      if (t?.bitId === id) {
        dropEntry(t.entry, t.toastId)
        completionToast = null
      }
    } else if (completionToast?.bitId === id) {
      if (history.toast?.id === completionToast.toastId) history.dismissToast()
      completionToast = null
    }
    const bit = find(id)
    if (!bit || bit.status === 0) return Promise.resolve()
    record(patchEntry(id, 'Reopen', { status: bit.status }, { status: 0 }))
    return bitStore.queueUpdate(id, { status: 0 })
  }

  // --- remove (deferred) ---------------------------------------------------------------------

  const pendingDeletes = new Map<string, PendingDelete>()

  /** A bit goes away: its focus timer ends without booking, its open detail sheet closes. */
  function leaving(id: string): void {
    opts.onRemove?.(id)
    if (sheet.open && sheet.view === 'detail' && sheet.bitId === id) sheet.close()
  }

  function startDelete(id: string, entry: HistoryEntry): void {
    if (!exists(id) || bitStore.hiddenIds.has(id)) return
    bitStore.hide(id)
    leaving(id)
    const pending: PendingDelete = { bitId: id, toastId: uuidv7(), state: 'pending' }
    pendingDeletes.set(id, pending)
    history.showToast({
      id: pending.toastId,
      message: 'Bit deleted',
      undoable: true,
      entryId: entry.id,
      onCommit: () => commitDelete(pending, entry),
    })
  }

  /** Undo inside the window: no request, the bit is back exactly as it was. */
  function cancelDelete(id: string): void {
    const pending = pendingDeletes.get(id)
    // once the DELETE is on its way there is nothing left to take back
    if (!pending || pending.state !== 'pending') return
    pending.state = 'undone'
    pendingDeletes.delete(id)
    bitStore.unhide(id)
    if (history.toast?.id === pending.toastId) history.dismissToast()
  }

  async function commitDelete(pending: PendingDelete, entry: HistoryEntry): Promise<void> {
    if (pending.state !== 'pending') return
    pending.state = 'committing'
    // from here on Ctrl+Z goes on with the next entry; this one could only race the DELETE
    history.drop(entry.id)
    try {
      await actions.deleteBit(pending.bitId, opts.layout())
      history.dropBit(pending.bitId)
      bitStore.unhide(pending.bitId)
    } catch {
      bitStore.unhide(pending.bitId)
      history.showToast({ id: uuidv7(), message: "Couldn't delete", undoable: false })
    } finally {
      if (pendingDeletes.get(pending.bitId) === pending) pendingDeletes.delete(pending.bitId)
    }
  }

  function remove(id: string): void {
    if (!exists(id) || bitStore.hiddenIds.has(id)) return
    const entry: HistoryEntry = {
      id: uuidv7(),
      bitId: id,
      label: 'Delete',
      sealed: true,
      undo: async () => cancelDelete(id),
      redo: async () => startDelete(id, entry),
    }
    record(entry)
    startDelete(id, entry)
  }

  /** The page goes away with a delete toast up: send the DELETE now, it outlives the page. */
  function onPageHide() {
    const toastId = history.toast?.id
    for (const pending of pendingDeletes.values()) {
      if (pending.state !== 'pending' || pending.toastId !== toastId) continue
      pending.state = 'committing'
      void fetch(`${api.defaults.baseURL ?? ''}/api/bit/${pending.bitId}`, {
        method: 'DELETE',
        keepalive: true,
        credentials: 'include',
      }).catch(() => {})
      // if the page comes back (bfcache), it shows the bit as deleted rather than deleting twice
      history.dismissToast()
      history.dropBit(pending.bitId)
      pendingDeletes.delete(pending.bitId)
      bitStore.bits = bitStore.bits.filter((b) => b.id !== pending.bitId)
      bitStore.unhide(pending.bitId)
    }
  }

  if (typeof window !== 'undefined') window.addEventListener('pagehide', onPageHide)
  if (getCurrentScope()) {
    onScopeDispose(() => {
      if (typeof window !== 'undefined') window.removeEventListener('pagehide', onPageHide)
      clearSealTimer()
      // the workspace goes away without committing (its toast is dropped): the bits come back
      for (const pending of pendingDeletes.values()) {
        if (pending.state !== 'pending') continue
        pending.state = 'undone'
        bitStore.unhide(pending.bitId)
        pendingDeletes.delete(pending.bitId)
      }
    })
  }

  // --- create --------------------------------------------------------------------------------

  function create(
    fields: CreateFields,
    pos: { x: number; y: number },
    flowId: string | null,
  ): Promise<Bit> {
    // a client id lets the caller show the bit (series row, detail) before the server answers
    const { dueDate, id: clientId, ...rest } = fields
    const payload = {
      ...rest,
      ...pos,
      id: clientId ?? uuidv7(),
      ...(dueDate != null
        ? { dueDate: typeof dueDate === 'string' ? dueDate : toApiDate(dueDate) }
        : {}),
      ...(flowId != null ? { flowId } : {}),
    }
    const id = payload.id
    const entry: HistoryEntry = {
      id: uuidv7(),
      bitId: id,
      label: 'Create',
      sealed: true,
      // at once, without a toast; otherwise like a delete (timer, open sheet)
      undo: () => {
        if (!exists(id)) return Promise.resolve()
        leaving(id)
        return actions.deleteBit(id, opts.layout())
      },
      redo: async () => {
        if (!exists(id)) await bitStore.createBit(payload)
      },
    }
    record(entry)
    return bitStore.createBit(payload).catch((e: unknown) => {
      history.drop(entry.id)
      throw e
    })
  }

  // --- dependencies --------------------------------------------------------------------------

  async function removeDependency(depId: string): Promise<void> {
    const dep = dependencyStore.dependencies.find((d) => d.id === depId)
    await dependencyStore.deleteDependency(depId)
    if (!dep) return
    let currentId = dep.id
    const from = { type: dep.fromType, id: dep.fromId }
    const to = { type: dep.toType, id: dep.toId }
    // a bit at either end deleted meanwhile: there is no arrow to bring back
    const endsExist = () => [from, to].every((n) => n.type !== 'bit' || exists(n.id))
    record({
      id: uuidv7(),
      bitId: dep.fromType === 'bit' ? dep.fromId : dep.toId,
      label: 'Remove dependency',
      sealed: true,
      async undo() {
        if (!endsExist()) return
        // the same id, so the arrow is the one that was there
        currentId = (await dependencyStore.createDependency(from, to, currentId)).id
      },
      async redo() {
        if (dependencyStore.dependencies.some((d) => d.id === currentId))
          await dependencyStore.deleteDependency(currentId)
      },
    })
  }

  return { update, complete, reopen, remove, create, removeDependency }
}
