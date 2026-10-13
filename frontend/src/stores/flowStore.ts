import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/helpers/api'
import type { Flow } from '@/types/flow'

export const useFlowStore = defineStore('flow', () => {
  const flows = ref<Flow[]>([])

  async function fetchFlows(): Promise<void> {
    const res = await api.get<Flow[]>('/api/flow')
    flows.value = res.data
  }

  async function createFlow(payload: {
    name?: string
    color?: string
    bitIds: number[]
    packetIds: number[]
  }): Promise<Flow> {
    const res = await api.post<Flow>('/api/flow', payload)
    flows.value.push(res.data)
    return res.data
  }

  // Optimistic: the frame must not flicker back while the request is in flight
  async function updateFlow(
    id: number,
    updates: Partial<Pick<Flow, 'name' | 'color'>>,
  ): Promise<void> {
    const idx = flows.value.findIndex((f) => f.id === id)
    const before = idx !== -1 ? { ...flows.value[idx]! } : null
    if (idx !== -1) flows.value[idx] = { ...flows.value[idx]!, ...updates }
    try {
      await api.put(`/api/flow/${id}`, updates)
    } catch (e) {
      const at = flows.value.findIndex((f) => f.id === id)
      if (before && at !== -1) flows.value[at] = before
      throw e
    }
  }

  async function deleteFlow(id: number): Promise<void> {
    await api.delete(`/api/flow/${id}`)
    flows.value = flows.value.filter((f) => f.id !== id)
  }

  return { flows, fetchFlows, createFlow, updateFlow, deleteFlow }
})
