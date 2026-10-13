import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/helpers/api'

export type Side =
  | 'top'
  | 'top-right'
  | 'right'
  | 'bottom-right'
  | 'bottom'
  | 'bottom-left'
  | 'left'
  | 'top-left'

export interface BitConnection {
  id: number
  fromBitId: number
  toBitId: number
  fromSide: Side
  toSide: Side
}

export const useConnectionStore = defineStore('connection', () => {
  const connections = ref<BitConnection[]>([])

  async function fetchConnections(): Promise<void> {
    const res = await api.get<BitConnection[]>('/api/connection')
    connections.value = res.data
  }

  async function createConnection(payload: Omit<BitConnection, 'id'>): Promise<BitConnection> {
    const res = await api.post<BitConnection>('/api/connection', payload)
    if (!connections.value.find((c) => c.id === res.data.id)) {
      connections.value.push(res.data)
    }
    return res.data
  }

  async function deleteConnection(id: number): Promise<void> {
    await api.delete(`/api/connection/${id}`)
    connections.value = connections.value.filter((c) => c.id !== id)
  }

  return { connections, fetchConnections, createConnection, deleteConnection }
})
