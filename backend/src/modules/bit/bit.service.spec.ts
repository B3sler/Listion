import { describe, it, expect } from 'vitest'
import { FakeRepository } from '../../testing/fake-repository.js'
import { BitService } from './bit.service.js'
import { PacketService } from '../packet/packet.service.js'
import type { Bit } from './bit.entity.js'
import type { Packet } from '../packet/packet.entity.js'
import type { Dependency } from '../dependency/dependency.entity.js'

async function setup() {
  const bits = new FakeRepository<Bit>(
    [
      { id: 1, user: 5 },
      { id: 2, user: 5 },
      { id: 3, user: 5 },
    ],
    { packetId: null, order: 0, status: 0, title: 't' } as Partial<Bit>,
  )
  const packets = new FakeRepository<Packet>()
  const deps = new FakeRepository<Dependency>()
  const packetService = new PacketService(packets.asRepo(), bits.asRepo(), deps.asRepo())
  const service = new BitService(bits.asRepo(), deps.asRepo(), packetService)
  const packet = await packetService.create({ x: 0, y: 0, bitIds: [1, 2] }, 5)
  const member = (id: number) => bits.rows.find((b) => b.id === id)
  return { service, bits, packets, deps, packet, member }
}

describe('BitService', () => {
  it('packetId null macht das Bit lose und löst das zu kleine Packet auf', async () => {
    const { service, packets, member } = await setup()
    await service.update(1, 5, { packetId: null, x: 40, y: 50 })
    expect(member(1)).toMatchObject({ packetId: null, x: 40, y: 50 })
    expect(packets.rows).toHaveLength(0)
  })

  it('packetId hängt ein loses Bit ans Ende und übernimmt andere Felder', async () => {
    const { service, packet, member } = await setup()
    await service.update(3, 5, { packetId: packet.id, title: 'neu' })
    expect(member(3)).toMatchObject({ packetId: packet.id, order: 2, title: 'neu' })
  })

  it('remove löscht Abhängigkeiten des Bits und löst das Packet auf', async () => {
    const { service, deps, packets, member } = await setup()
    await deps.save({ userId: 5, fromType: 'bit', fromId: 1, toType: 'bit', toId: 3 })
    await deps.save({ userId: 5, fromType: 'bit', fromId: 3, toType: 'bit', toId: 1 })
    await service.remove(1, 5)
    expect(member(1)).toBeUndefined()
    expect(deps.rows).toHaveLength(0)
    expect(packets.rows).toHaveLength(0)
    expect(member(2)?.packetId).toBeNull()
  })
})
