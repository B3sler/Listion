import type { Repository } from 'typeorm'
import type { Flow } from './flow.entity.js'
import type { Bit } from '../bit/bit.entity.js'
import type { Packet } from '../packet/packet.entity.js'

export interface FlowRepos {
  flows: Repository<Flow>
  bits: Repository<Bit>
  packets: Repository<Packet>
}

/**
 * A flow without members cannot exist. Members are loose bits and packets carrying its id
 * (bits inside a packet never carry a flowId), so both are counted.
 */
export async function pruneEmptyFlows(
  flowIds: (number | null | undefined)[],
  userId: number,
  repos: FlowRepos,
): Promise<void> {
  for (const id of new Set(flowIds.filter((f): f is number => f != null))) {
    const bits = await repos.bits.count({ where: { flowId: id, user: userId } })
    const packets = await repos.packets.count({ where: { flowId: id, user: userId } })
    if (bits + packets === 0) await repos.flows.delete({ id, user: userId })
  }
}
