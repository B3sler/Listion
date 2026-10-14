import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/helpers/api'
import { uuidv7 } from '@/helpers/uuid'
import type { Packet } from '@/types/flow'
import { whenCreated } from './pendingCreates'

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
    bitIds: string[]
    flowId?: string
  }): Promise<Packet> {
    // Not optimistic (the flow reloads after a packet forms), but its members may be brand new
    await whenCreated(...payload.bitIds)
    const res = await api.post<Packet>('/api/packet', {
      ...payload,
      id: uuidv7(),
      x: Math.round(payload.x),
      y: Math.round(payload.y),
    })
    packets.value.push(res.data)
    return res.data
  }

  async function updatePacket(
    id: string,
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

  async function setBits(id: string, bitIds: string[]): Promise<void> {
    await whenCreated(...bitIds)
    await api.put(`/api/packet/${id}/bits`, { bitIds })
  }

  async function deletePacket(id: string): Promise<void> {
    await api.delete(`/api/packet/${id}`)
    packets.value = packets.value.filter((p) => p.id !== id)
  }

  return { packets, fetchPackets, createPacket, updatePacket, setBits, deletePacket }
})
