import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import api from '@/helpers/api'
import { uuidv7 } from '@/helpers/uuid'
import type { Recurrence } from '@/helpers/recurrence'
import { trackCreate, whenCreated } from './pendingCreates'

export interface Bit {
  id: string
  title: string
  status: number
  x: number
  y: number
  packetId: string | null
  order: number
  flowId?: string | null
  priority?: number | null
  dueDate?: Date | string | null
  notes?: string
  createdAt: string
  color?: string | null
  size?: 1 | 2 | 3 | 4 | null
  recurrence?: Recurrence | null
  completedCount?: number
  snoozedUntil?: string | null
  focusSeconds?: number
}

type Field = keyof Bit

/** One queueUpdate call: what it changed, and what those fields held right before. */
interface QueuedUpdate {
  patch: Partial<Bit>
  before: Map<Field, unknown>
  resolve: () => void
  reject: (e: unknown) => void
}

/** Per bit with a PUT underway: the updates that wait for it and who wrote each field last. */
interface BitQueue {
  waiting: QueuedUpdate[]
  lastWriter: Map<Field, QueuedUpdate>
}

export const useBitStore = defineStore('bit', () => {
  const bits = ref<Bit[]>([])
  /**
   * Bits deleted on the canvas but still inside their undo window. They stay in `bits` (and on
   * the server) so an undo restores them unchanged; layout, filter, HUD and arrows skip them.
   */
  const hiddenIds = ref(new Set<string>())
  const visibleBits = computed(() =>
    hiddenIds.value.size === 0 ? bits.value : bits.value.filter((b) => !hiddenIds.value.has(b.id)),
  )

  function hide(id: string): void {
    hiddenIds.value.add(id)
  }

  function unhide(id: string): void {
    hiddenIds.value.delete(id)
  }

  async function fetchBits(): Promise<void> {
    const res = await api.get<Bit[]>('/api/bit')
    bits.value = res.data
  }

  /**
   * Optimistic: the bit is on the canvas before the server answers. The server copy only fills in
   * what the client could not know (createdAt); fields changed locally meanwhile stay local.
   */
  async function createBit(payload: {
    /** A given id recreates a bit (redo); otherwise a new one is generated. */
    id?: string
    title: string
    x: number
    y: number
    status?: number
    priority?: Bit['priority']
    dueDate?: string
    notes?: string
    color?: Bit['color']
    size?: Bit['size']
    recurrence?: Bit['recurrence']
    flowId?: string
  }): Promise<Bit> {
    const body = {
      ...payload,
      id: payload.id ?? uuidv7(),
      x: Math.round(payload.x),
      y: Math.round(payload.y),
      status: payload.status ?? 0,
    }
    const draft: Bit = { ...body, packetId: null, order: 0, createdAt: new Date().toISOString() }
    bits.value.push({ ...draft })
    const request = api.post<Bit>('/api/bit', body)
    trackCreate(draft.id, request)
    try {
      const res = await request
      const idx = bits.value.findIndex((b) => b.id === draft.id)
      // gone only if a reload replaced the list meanwhile (deleteBit waits for this create)
      if (idx === -1) {
        bits.value.push(res.data)
        return res.data
      }
      const local = bits.value[idx]!
      const changed = Object.fromEntries(
        Object.entries(local).filter(([k, v]) => v !== draft[k as keyof Bit]),
      )
      bits.value[idx] = { ...res.data, ...changed }
      return bits.value[idx]!
    } catch (e) {
      bits.value = bits.value.filter((b) => b.id !== draft.id)
      throw e
    }
  }

  // Optimistic: the canvas must not jump back while the request is in flight
  async function updateBit(
    id: string,
    updates: Partial<Omit<Bit, 'id' | 'createdAt' | 'order'>>,
  ): Promise<void> {
    const idx = bits.value.findIndex((b) => b.id === id)
    const before = idx !== -1 ? { ...bits.value[idx]! } : null
    if (idx !== -1) bits.value[idx] = { ...bits.value[idx]!, ...updates }
    try {
      await whenCreated(id, updates.packetId)
      await api.put(`/api/bit/${id}`, updates)
    } catch (e) {
      const at = bits.value.findIndex((b) => b.id === id)
      if (before && at !== -1) bits.value[at] = before
      throw e
    }
  }

  const queues = new Map<string, BitQueue>()
  /** Per bit with updates underway: settles once the last of them is answered. */
  const drains = new Map<string, Promise<void>>()

  function patchLocal(id: string, patch: Partial<Bit>): void {
    const idx = bits.value.findIndex((b) => b.id === id)
    if (idx === -1) return
    const next: Record<string, unknown> = { ...bits.value[idx]! }
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) delete next[k]
      else next[k] = v
    }
    bits.value[idx] = next as unknown as Bit
  }

  /**
   * A failed PUT undoes its own fields only. A field a later update has since written keeps that
   * value; the earlier value moves into that update's undo state instead, so a second failure
   * falls back to what the server really holds.
   */
  function rollBack(queue: BitQueue, id: string, batch: QueuedUpdate[]): void {
    const restore: Partial<Bit> = {}
    const earliest = new Map<Field, unknown>()
    for (const u of batch) {
      for (const [k, v] of u.before) if (!earliest.has(k)) earliest.set(k, v)
    }
    for (const [k, v] of earliest) {
      const writer = queue.lastWriter.get(k)
      if (!writer || batch.includes(writer)) {
        ;(restore as Record<string, unknown>)[k] = v
        queue.lastWriter.delete(k)
      } else {
        const next = queue.waiting.find((u) => u.before.has(k))
        if (next) next.before.set(k, v)
      }
    }
    patchLocal(id, restore)
  }

  async function drain(id: string, queue: BitQueue): Promise<void> {
    while (queue.waiting.length) {
      const batch = queue.waiting.splice(0)
      const merged = Object.assign({}, ...batch.map((u) => u.patch)) as Partial<Bit>
      try {
        await whenCreated(id, merged.packetId)
        await api.put(`/api/bit/${id}`, merged)
        for (const [k, w] of queue.lastWriter) if (batch.includes(w)) queue.lastWriter.delete(k)
        for (const u of batch) u.resolve()
      } catch (e) {
        rollBack(queue, id, batch)
        for (const u of batch) u.reject(e)
      }
    }
    queues.delete(id)
  }

  /**
   * Updates of one bit go out one PUT at a time, so an older response can never overwrite newer
   * local state. Updates made while a PUT is underway merge into one follow-up PUT (the last value
   * of each field wins). The promise settles with the PUT that carries this patch.
   */
  function queueUpdate(id: string, patch: Partial<Bit>): Promise<void> {
    const current = bits.value.find((b) => b.id === id)
    const before = new Map<Field, unknown>()
    for (const k of Object.keys(patch) as Field[]) before.set(k, current?.[k])
    patchLocal(id, patch)

    return new Promise<void>((resolve, reject) => {
      const update: QueuedUpdate = { patch, before, resolve, reject }
      let queue = queues.get(id)
      const idle = !queue
      if (!queue) {
        queue = { waiting: [], lastWriter: new Map() }
        queues.set(id, queue)
      }
      queue.waiting.push(update)
      for (const k of before.keys()) queue.lastWriter.set(k, update)
      if (idle) {
        const run = drain(id, queue)
        drains.set(id, run)
        void run.then(() => {
          if (drains.get(id) === run) drains.delete(id)
        })
      }
    })
  }

  async function deleteBit(id: string): Promise<void> {
    await whenCreated(id)
    // a save still on its way (e.g. the detail view's flush) must not arrive after the DELETE
    await drains.get(id)
    await api.delete(`/api/bit/${id}`)
    bits.value = bits.value.filter((b) => b.id !== id)
  }

  function shiftFocus(id: string, delta: number): void {
    const idx = bits.value.findIndex((b) => b.id === id)
    if (idx === -1) return
    const current = bits.value[idx]!
    bits.value[idx] = { ...current, focusSeconds: Math.max(0, (current.focusSeconds ?? 0) + delta) }
  }

  /**
   * Adds finished focus time. Optimistic like the other writes; the server increments atomically,
   * so a failure takes back exactly this amount and leaves concurrent edits alone.
   */
  async function addFocus(id: string, seconds: number): Promise<void> {
    shiftFocus(id, seconds)
    try {
      await whenCreated(id)
      await api.post(`/api/bit/${id}/focus`, { seconds })
    } catch (e) {
      shiftFocus(id, -seconds)
      throw e
    }
  }

  return {
    bits,
    hiddenIds,
    visibleBits,
    hide,
    unhide,
    fetchBits,
    createBit,
    updateBit,
    queueUpdate,
    addFocus,
    deleteBit,
  }
})
