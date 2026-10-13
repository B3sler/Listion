import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/helpers/api'

export interface Bit {
  id: number
  title: string
  status: number
  x: number
  y: number
  packetId: number | null
  order: number
  priority?: number
  dueDate?: Date | string
  notes?: string
  workspace?: number
  createdAt: string
  color?: string
}

export const useBitStore = defineStore('bit', () => {
  const bits = ref<Bit[]>([])

  async function fetchBits(): Promise<void> {
    const res = await api.get<Bit[]>('/api/bit')
    bits.value = res.data
  }

  async function createBit(payload: {
    title: string
    x: number
    y: number
    status?: number
    priority?: number
    dueDate?: string
    notes?: string
    color?: string
  }): Promise<Bit> {
    const res = await api.post<Bit>('/api/bit', {
      ...payload,
      x: Math.round(payload.x),
      y: Math.round(payload.y),
      status: payload.status ?? 0,
    })
    bits.value.push(res.data)
    return res.data
  }

  // Optimistic: the canvas must not jump back while the request is in flight
  async function updateBit(
    id: number,
    updates: Partial<Omit<Bit, 'id' | 'createdAt' | 'order'>>,
  ): Promise<void> {
    const idx = bits.value.findIndex((b) => b.id === id)
    const before = idx !== -1 ? { ...bits.value[idx]! } : null
    if (idx !== -1) bits.value[idx] = { ...bits.value[idx]!, ...updates }
    try {
      await api.put(`/api/bit/${id}`, updates)
    } catch (e) {
      const at = bits.value.findIndex((b) => b.id === id)
      if (before && at !== -1) bits.value[at] = before
      throw e
    }
  }

  async function deleteBit(id: number): Promise<void> {
    await api.delete(`/api/bit/${id}`)
    bits.value = bits.value.filter((b) => b.id !== id)
  }

  return { bits, fetchBits, createBit, updateBit, deleteBit }
})
