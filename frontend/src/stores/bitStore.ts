import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/helpers/api'

export interface Bit {
  id: number
  title: string
  status: number
  x: number
  y: number
  priority?: number
  dueDate?: Date | string
  notes?: string
  workspace?: number
  createdAt: string
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

  async function updateBit(id: number, updates: Partial<Omit<Bit, 'id' | 'createdAt'>>): Promise<void> {
    await api.put(`/api/bit/${id}`, updates)
    const idx = bits.value.findIndex((b) => b.id === id)
    if (idx !== -1) {
      bits.value[idx] = { ...bits.value[idx]!, ...updates }
    }
  }

  async function deleteBit(id: number): Promise<void> {
    await api.delete(`/api/bit/${id}`)
    bits.value = bits.value.filter((b) => b.id !== id)
  }

  return { bits, fetchBits, createBit, updateBit, deleteBit }
})
