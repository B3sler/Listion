import { useBitStore } from '@/stores/bitStore'
import { usePacketStore } from '@/stores/packetStore'
import { useDependencyStore } from '@/stores/dependencyStore'
import type { NodeRef } from '@/types/flow'
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

  async function reloadAll(): Promise<void> {
    await Promise.all([
      bitStore.fetchBits(),
      packetStore.fetchPackets(),
      dependencyStore.fetchDependencies(),
    ])
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

  /** Bits that just left a packet keep their last on-screen position. */
  async function restoreFreedPositions(
    before: FlowLayout,
    packetBefore: Map<number, number | null>,
    skipId: number,
  ): Promise<void> {
    const freed = bitStore.bits.filter(
      (b) => b.packetId == null && packetBefore.get(b.id) != null && b.id !== skipId,
    )
    await Promise.all(
      freed.map((b) => {
        const r = before.bitRects.get(b.id)
        return r
          ? bitStore.updateBit(b.id, { x: Math.round(r.x), y: Math.round(r.y) })
          : Promise.resolve()
      }),
    )
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
        const ids = (layout.membersOf.get(target.packetId) ?? [])
          .map((b) => b.id)
          .filter((id) => id !== bitId)
        ids.splice(target.index, 0, bitId)
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

      await reloadAll()
      await restoreFreedPositions(layout, packetBefore, bitId)
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
      await reloadAll()
      await restoreFreedPositions(layout, packetBefore, id)
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
