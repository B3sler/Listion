import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/helpers/api'
import { uuidv7 } from '@/helpers/uuid'
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
  priority?: number
  dueDate?: Date | string
  notes?: string
  createdAt: string
  color?: string
}

export const useBitStore = defineStore('bit', () => {
  const bits = ref<Bit[]>([])

  async function fetchBits(): Promise<void> {
    const res = await api.get<Bit[]>('/api/bit')
    bits.value = res.data
  }

  /**
   * Optimistic: the bit is on the canvas before the server answers. The server copy only fills in
   * what the client could not know (createdAt); fields changed locally meanwhile stay local.
   */
  async function createBit(payload: {
    title: string
    x: number
    y: number
    status?: number
    priority?: number
    dueDate?: string
    notes?: string
    color?: string
    flowId?: string
  }): Promise<Bit> {
    const body = {
      ...payload,
      id: uuidv7(),
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

  async function deleteBit(id: string): Promise<void> {
    await whenCreated(id)
    await api.delete(`/api/bit/${id}`)
    bits.value = bits.value.filter((b) => b.id !== id)
  }

  return { bits, fetchBits, createBit, updateBit, deleteBit }
})
