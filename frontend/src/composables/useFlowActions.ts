import api from '@/helpers/api'
import { useBitStore, type Bit } from '@/stores/bitStore'
import { usePacketStore } from '@/stores/packetStore'
import { useDependencyStore } from '@/stores/dependencyStore'
import { useFlowStore } from '@/stores/flowStore'
import type { Dependency, Flow, NodeRef, Packet } from '@/types/flow'
import {
  CAPSULE_H,
  STACK_HEADER_H,
  STACK_PAD,
  STEP_GAP,
  STEP_NUM_W,
  type FlowLayout,
} from './useFlowLayout'
import { isValidLink } from './useFlowState'
import type { SnapTarget } from './useStackDrag'

export function useFlowActions() {
  const bitStore = useBitStore()
  const packetStore = usePacketStore()
  const dependencyStore = useDependencyStore()
  const flowStore = useFlowStore()

  /** Fetch all four collections without committing, so the stores can be assigned together. */
  async function fetchSnapshot(): Promise<{
    bits: Bit[]
    packets: Packet[]
    dependencies: Dependency[]
    flows: Flow[]
  }> {
    const [bits, packets, dependencies, flows] = await Promise.all([
      api.get<Bit[]>('/api/bit'),
      api.get<Packet[]>('/api/packet'),
      api.get<Dependency[]>('/api/dependency'),
      api.get<Flow[]>('/api/flow'),
    ])
    return {
      bits: bits.data,
      packets: packets.data,
      dependencies: dependencies.data,
      flows: flows.data,
    }
  }

  /** Commit in one synchronous block so no frame renders a half-updated flow. */
  function commit(snapshot: {
    bits: Bit[]
    packets: Packet[]
    dependencies: Dependency[]
    flows: Flow[]
  }): void {
    bitStore.bits = snapshot.bits
    packetStore.packets = snapshot.packets
    dependencyStore.dependencies = snapshot.dependencies
    flowStore.flows = snapshot.flows
  }

  async function reloadAll(): Promise<void> {
    commit(await fetchSnapshot())
  }

  /** On any failure the server state wins and the canvas springs back to it. */
  async function guarded(op: () => Promise<void>): Promise<void> {
    try {
      await op()
    } catch (e) {
      console.error('Flow update failed:', e)
      await reloadAll().catch(() => {})
    }
  }

  /**
   * Reload the flow after an operation that may have freed bits from a packet. Freed bits keep
   * their last on-screen position: it is patched into the fetched data before committing (so they
   * never paint at the stale server coordinates) and persisted afterwards.
   */
  async function reloadKeepingFreedPositions(
    before: FlowLayout,
    packetBefore: Map<number, number | null>,
    skipId: number,
  ): Promise<void> {
    const snapshot = await fetchSnapshot()
    const patched: { id: number; x: number; y: number }[] = []
    snapshot.bits = snapshot.bits.map((b) => {
      const r = before.bitRects.get(b.id)
      if (b.packetId != null || packetBefore.get(b.id) == null || b.id === skipId || !r) return b
      const x = Math.round(r.x)
      const y = Math.round(r.y)
      patched.push({ id: b.id, x, y })
      return { ...b, x, y }
    })
    commit(snapshot)
    await Promise.all(patched.map((p) => api.put(`/api/bit/${p.id}`, { x: p.x, y: p.y })))
  }

  function dropBit(
    bitId: number,
    target: SnapTarget | null,
    pos: { x: number; y: number },
    layout: FlowLayout,
  ): Promise<void> {
    return guarded(async () => {
      const bit = bitStore.bits.find((b) => b.id === bitId)
      if (!bit) return
      const packetBefore = new Map(bitStore.bits.map((b) => [b.id, b.packetId] as const))

      if (target?.kind === 'stack') {
        const current = (layout.membersOf.get(target.packetId) ?? []).map((b) => b.id)
        const ids = current.filter((id) => id !== bitId)
        ids.splice(target.index, 0, bitId)
        // dropped back into its own slot: nothing to save
        if (ids.length === current.length && ids.every((id, i) => id === current[i])) return
        await packetStore.setBits(target.packetId, ids)
      } else if (target?.kind === 'pair') {
        const t = layout.bitRects.get(target.bitId)
        if (!t) return
        const above = target.position === 'above'
        await packetStore.createPacket({
          x: t.x - STACK_PAD - STEP_NUM_W,
          // the target capsule stays where it is; the stack grows around it
          y: (above ? t.y - (CAPSULE_H + STEP_GAP) : t.y) - STACK_HEADER_H,
          bitIds: above ? [bitId, target.bitId] : [target.bitId, bitId],
        })
      } else if (bit.packetId != null) {
        await bitStore.updateBit(bitId, {
          packetId: null,
          x: Math.round(pos.x),
          y: Math.round(pos.y),
        })
      } else {
        await bitStore.updateBit(bitId, { x: Math.round(pos.x), y: Math.round(pos.y) })
        return
      }

      await reloadKeepingFreedPositions(layout, packetBefore, bitId)
    })
  }

  function movePacket(id: number, x: number, y: number): Promise<void> {
    return guarded(() => packetStore.updatePacket(id, { x, y }))
  }

  function renamePacket(id: number, name: string): Promise<void> {
    return guarded(() => packetStore.updatePacket(id, { name }))
  }

  function createDependency(from: NodeRef, to: NodeRef): Promise<void> {
    if (!isValidLink(from, to, bitStore.bits, dependencyStore.dependencies))
      return Promise.resolve()
    return guarded(async () => {
      await dependencyStore.createDependency(from, to)
    })
  }

  function deleteDependency(id: number): Promise<void> {
    return guarded(() => dependencyStore.deleteDependency(id))
  }

  function deleteBit(id: number, layout: FlowLayout): Promise<void> {
    return guarded(async () => {
      const packetBefore = new Map(bitStore.bits.map((b) => [b.id, b.packetId] as const))
      await bitStore.deleteBit(id)
      await reloadKeepingFreedPositions(layout, packetBefore, id)
    })
  }

  return {
    reloadAll,
    dropBit,
    movePacket,
    renamePacket,
    createDependency,
    deleteDependency,
    deleteBit,
  }
}
