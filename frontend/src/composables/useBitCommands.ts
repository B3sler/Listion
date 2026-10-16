import type { InjectionKey } from 'vue'
import { useBitStore, type Bit } from '@/stores/bitStore'
import { useDependencyStore } from '@/stores/dependencyStore'
import { completionPatch } from '@/helpers/recurrence'
import { dueToApi, todayKey, toDateKey } from '@/helpers/localDate'
import { useFlowActions } from './useFlowActions'
import type { FlowLayout } from './useFlowLayout'

export type CreateFields = Pick<Bit, 'title'> &
  Partial<Pick<Bit, 'status' | 'priority' | 'dueDate' | 'notes' | 'color' | 'size' | 'recurrence'>>

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

export const BIT_COMMANDS: InjectionKey<BitCommands> = Symbol('bit-commands')

function toApiDate(d: Date): string | undefined {
  return dueToApi(toDateKey(d)) ?? undefined
}

/** How long a repeating bit shows as done before it rolls to its next day. */
const ROLL_DELAY_MS = 800

export function useBitCommands(opts: { layout: () => FlowLayout }): BitCommands {
  const bitStore = useBitStore()
  const dependencyStore = useDependencyStore()
  const actions = useFlowActions()

  /** Repeating bits that are shown as done and wait to roll. */
  const rolling = new Map<string, { timer: ReturnType<typeof setTimeout>; cancel: () => void }>()

  // `meta` (undo label, coalescing) is for the undo stack and is not read yet
  function update(id: string, patch: Partial<Bit>): Promise<void> {
    return bitStore.queueUpdate(id, patch)
  }

  function complete(id: string): Promise<{ rolledTo: string | null }> {
    const bit = bitStore.bits.find((b) => b.id === id)
    if (!bit) return Promise.resolve({ rolledTo: null })
    if (!bit.recurrence) {
      return bitStore.queueUpdate(id, { status: 2 }).then(() => ({ rolledTo: null }))
    }
    if (rolling.has(id)) return Promise.resolve({ rolledTo: null })

    const patch = completionPatch(bit, todayKey())
    const rolledTo = patch.dueDate ? toDateKey(patch.dueDate) : null
    const shown = bitStore.bits.findIndex((b) => b.id === id)
    // shown as done for a moment; nothing is sent yet
    bitStore.bits[shown] = { ...bit, status: 2 }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        rolling.delete(id)
        // back to the stored state first, so a failed save undoes the roll, not the tick
        const at = bitStore.bits.findIndex((b) => b.id === id)
        if (at !== -1) bitStore.bits[at] = { ...bitStore.bits[at]!, status: bit.status }
        bitStore.queueUpdate(id, patch).then(() => resolve({ rolledTo }), reject)
      }, ROLL_DELAY_MS)
      rolling.set(id, { timer, cancel: () => resolve({ rolledTo: null }) })
    })
  }

  function reopen(id: string): Promise<void> {
    const waiting = rolling.get(id)
    if (waiting) {
      clearTimeout(waiting.timer)
      rolling.delete(id)
      waiting.cancel()
    }
    return bitStore.queueUpdate(id, { status: 0 })
  }

  function remove(id: string): void {
    void actions.deleteBit(id, opts.layout())
  }

  function create(
    fields: CreateFields,
    pos: { x: number; y: number },
    flowId: string | null,
  ): Promise<Bit> {
    const { dueDate, ...rest } = fields
    return bitStore.createBit({
      ...rest,
      ...pos,
      ...(dueDate != null
        ? { dueDate: typeof dueDate === 'string' ? dueDate : toApiDate(dueDate) }
        : {}),
      ...(flowId != null ? { flowId } : {}),
    })
  }

  function removeDependency(depId: string): Promise<void> {
    return dependencyStore.deleteDependency(depId)
  }

  return { update, complete, reopen, remove, create, removeDependency }
}
