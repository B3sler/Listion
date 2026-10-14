import type { Bit } from '@/stores/bitStore'
import type { Dependency, NodeRef, Packet, PacketSummary, WorkflowState } from '@/types/flow'
import { compareIds } from '@/helpers/uuid'

export interface FlowState {
  bitState: Map<string, WorkflowState>
  cycleDependencyIds: Set<string>
  cycleBitIds: Set<string>
  packetSummary: Map<string, PacketSummary>
  sourceDone(dep: Dependency): boolean
}

// Graph nodes: "b:<id>" bit, "pi:<id>" packet gate (opens the first step), "po:<id>" packet done
const bitKey = (id: string) => `b:${id}`
const gateKey = (id: string) => `pi:${id}`
const doneKey = (id: string) => `po:${id}`
const sourceKey = (dep: Dependency) =>
  dep.fromType === 'bit' ? bitKey(dep.fromId) : doneKey(dep.fromId)
const targetKey = (dep: Dependency) => (dep.toType === 'bit' ? bitKey(dep.toId) : gateKey(dep.toId))

interface Edge {
  from: string
  to: string
  depId?: string
}

export function computeFlowState(bits: Bit[], packets: Packet[], deps: Dependency[]): FlowState {
  const packetIds = new Set(packets.map((p) => p.id))
  const members = new Map<string, Bit[]>()
  for (const bit of bits) {
    if (bit.packetId == null || !packetIds.has(bit.packetId)) continue
    const list = members.get(bit.packetId) ?? []
    list.push(bit)
    members.set(bit.packetId, list)
  }
  for (const list of members.values())
    list.sort((a, b) => a.order - b.order || compareIds(a.id, b.id))

  const bitIds = new Set(bits.map((b) => b.id))
  const liveDeps = deps.filter(
    (d) =>
      (d.fromType === 'bit' ? bitIds.has(d.fromId) : members.has(d.fromId)) &&
      (d.toType === 'bit' ? bitIds.has(d.toId) : members.has(d.toId)),
  )

  const edges: Edge[] = []
  for (const [packetId, list] of members) {
    edges.push({ from: gateKey(packetId), to: bitKey(list[0]!.id) })
    list.forEach((bit, i) => {
      if (i > 0) edges.push({ from: bitKey(list[i - 1]!.id), to: bitKey(bit.id) })
      edges.push({ from: bitKey(bit.id), to: doneKey(packetId) })
    })
  }
  for (const dep of liveDeps)
    edges.push({ from: sourceKey(dep), to: targetKey(dep), depId: dep.id })

  const incoming = new Map<string, string[]>()
  for (const e of edges) incoming.set(e.to, [...(incoming.get(e.to) ?? []), e.from])

  const statusOf = new Map(bits.map((b) => [b.id, b.status]))
  // done() never recurses through a gate twice: gate predecessors are bits or packet-done nodes,
  // and those only look at bit statuses — so cycles in the graph cannot loop here.
  function done(key: string): boolean {
    const [kind, id] = key.split(':') as [string, string]
    if (kind === 'b') return statusOf.get(id) === 2
    if (kind === 'po') return (members.get(id) ?? []).every((b) => b.status === 2)
    return (incoming.get(key) ?? []).every((k) => done(k))
  }

  const bitState = new Map<string, WorkflowState>()
  for (const bit of bits) {
    const prereqs = (incoming.get(bitKey(bit.id)) ?? []).filter(
      // an ungated packet gate is not a real prerequisite
      (k) => !k.startsWith('pi:') || (incoming.get(k) ?? []).length > 0,
    )
    if (bit.status === 2 || prereqs.length === 0) bitState.set(bit.id, null)
    else bitState.set(bit.id, prereqs.every((k) => done(k)) ? 'ready' : 'blocked')
  }

  const cyclic = cyclicNodes(edges)
  const cycleDependencyIds = new Set(
    edges
      .filter(
        (e) =>
          e.depId !== undefined &&
          cyclic.has(e.from) &&
          cyclic.has(e.to) &&
          sameComponent(cyclic, e),
      )
      .map((e) => e.depId!),
  )
  const cycleBitIds = new Set(bits.filter((b) => cyclic.has(bitKey(b.id))).map((b) => b.id))

  const packetSummary = new Map<string, PacketSummary>()
  for (const [packetId, list] of members) {
    const total = list.length
    const doneCount = list.filter((b) => b.status === 2).length
    const ids = new Set(list.map((b) => b.id))
    const touches = (type: 'bit' | 'packet', id: string) =>
      type === 'packet' ? id === packetId : ids.has(id)
    packetSummary.set(packetId, {
      total,
      done: doneCount,
      inProgress: list.filter((b) => b.status === 1).length,
      blocked: list.filter((b) => bitState.get(b.id) === 'blocked').length,
      ready: list.filter((b) => bitState.get(b.id) === 'ready').length,
      cycles: liveDeps.filter(
        (d) =>
          cycleDependencyIds.has(d.id) &&
          (touches(d.fromType, d.fromId) || touches(d.toType, d.toId)),
      ).length,
      percent: total ? Math.round((doneCount / total) * 100) : 0,
    })
  }

  return {
    bitState,
    cycleDependencyIds,
    cycleBitIds,
    packetSummary,
    sourceDone: (dep) => done(sourceKey(dep)),
  }
}

/** Tarjan SCC: maps every node that sits on a cycle to its component id. */
function cyclicNodes(edges: Edge[]): Map<string, number> {
  const adj = new Map<string, string[]>()
  for (const e of edges) adj.set(e.from, [...(adj.get(e.from) ?? []), e.to])
  const nodes = new Set(edges.flatMap((e) => [e.from, e.to]))

  let index = 0
  let component = 0
  const idx = new Map<string, number>()
  const low = new Map<string, number>()
  const onStack = new Set<string>()
  const stack: string[] = []
  const result = new Map<string, number>()

  function strongConnect(v: string) {
    idx.set(v, index)
    low.set(v, index)
    index++
    stack.push(v)
    onStack.add(v)
    for (const w of adj.get(v) ?? []) {
      if (!idx.has(w)) {
        strongConnect(w)
        low.set(v, Math.min(low.get(v)!, low.get(w)!))
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v)!, idx.get(w)!))
      }
    }
    if (low.get(v) === idx.get(v)) {
      const scc: string[] = []
      let w: string
      do {
        w = stack.pop()!
        onStack.delete(w)
        scc.push(w)
      } while (w !== v)
      const selfLoop = scc.length === 1 && (adj.get(v) ?? []).includes(v)
      if (scc.length > 1 || selfLoop) {
        for (const n of scc) result.set(n, component)
        component++
      }
    }
  }

  for (const n of nodes) if (!idx.has(n)) strongConnect(n)
  return result
}

function sameComponent(cyclic: Map<string, number>, e: Edge): boolean {
  return cyclic.get(e.from) === cyclic.get(e.to)
}

/** Client-side mirror of the server rules, so invalid arrows never hit the API. */
export function isValidLink(from: NodeRef, to: NodeRef, bits: Bit[], deps: Dependency[]): boolean {
  if (from.type === to.type && from.id === to.id) return false
  const packetOf = (id: string) => bits.find((b) => b.id === id)?.packetId ?? null
  if (from.type === 'bit' && to.type === 'packet' && packetOf(from.id) === to.id) return false
  if (from.type === 'packet' && to.type === 'bit' && packetOf(to.id) === from.id) return false
  return !deps.some(
    (d) =>
      d.fromType === from.type && d.fromId === from.id && d.toType === to.type && d.toId === to.id,
  )
}
