import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/helpers/api'
import type { Packet } from '@/types/flow'

export const usePacketStore = defineStore('packet', () => {
  const packets = ref<Packet[]>([])

  async function fetchPackets(): Promise<void> {
    const res = await api.get<Packet[]>('/api/packet')
    packets.value = res.data
  }

  async function createPacket(payload: {
    name?: string
    x: number
    y: number
    bitIds: number[]
    flowId?: number
  }): Promise<Packet> {
    const res = await api.post<Packet>('/api/packet', {
      ...payload,
      x: Math.round(payload.x),
      y: Math.round(payload.y),
    })
    packets.value.push(res.data)
    return res.data
  }

  async function updatePacket(
    id: number,
    updates: Partial<Pick<Packet, 'name' | 'x' | 'y' | 'flowId'>>,
  ): Promise<void> {
    const body = { ...updates }
    if (body.x !== undefined) body.x = Math.round(body.x)
    if (body.y !== undefined) body.y = Math.round(body.y)
    const idx = packets.value.findIndex((p) => p.id === id)
    const before = idx !== -1 ? { ...packets.value[idx]! } : null
    if (idx !== -1) packets.value[idx] = { ...packets.value[idx]!, ...body }
    try {
      await api.put(`/api/packet/${id}`, body)
    } catch (e) {
      const at = packets.value.findIndex((p) => p.id === id)
      if (before && at !== -1) packets.value[at] = before
      throw e
    }
  }

  async function setBits(id: number, bitIds: number[]): Promise<void> {
    await api.put(`/api/packet/${id}/bits`, { bitIds })
  }

  async function deletePacket(id: number): Promise<void> {
    await api.delete(`/api/packet/${id}`)
    packets.value = packets.value.filter((p) => p.id !== id)
  }

  return { packets, fetchPackets, createPacket, updatePacket, setBits, deletePacket }
})
