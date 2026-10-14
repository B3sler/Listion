import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/helpers/api'
import { uuidv7 } from '@/helpers/uuid'
import type { Flow } from '@/types/flow'
import { whenCreated } from './pendingCreates'

export const useFlowStore = defineStore('flow', () => {
  const flows = ref<Flow[]>([])

  async function fetchFlows(): Promise<void> {
    const res = await api.get<Flow[]>('/api/flow')
    flows.value = res.data
  }

  async function createFlow(payload: {
    name?: string
    color?: string
    bitIds: string[]
    packetIds: string[]
  }): Promise<Flow> {
    // Not optimistic (the flow reloads afterwards), but a lassoed bit may be brand new
    await whenCreated(...payload.bitIds)
    const res = await api.post<Flow>('/api/flow', { id: uuidv7(), ...payload })
    flows.value.push(res.data)
    return res.data
  }

  // Optimistic: the frame must not flicker back while the request is in flight
  async function updateFlow(
    id: string,
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

  async function deleteFlow(id: string): Promise<void> {
    await api.delete(`/api/flow/${id}`)
    flows.value = flows.value.filter((f) => f.id !== id)
  }

  return { flows, fetchFlows, createFlow, updateFlow, deleteFlow }
})
