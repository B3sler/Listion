import { describe, it, expect } from 'vitest'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { FakeRepository } from '../../testing/fake-repository.js'
import { PacketService } from './packet.service.js'
import type { Packet } from './packet.entity.js'
import type { Bit } from '../bit/bit.entity.js'
import type { Dependency } from '../dependency/dependency.entity.js'
import type { Flow } from '../flow/flow.entity.js'

function setup() {
  const bits = new FakeRepository<Bit>(
    [
      { id: 1, user: 5 },
      { id: 2, user: 5 },
      { id: 3, user: 5 },
      { id: 4, user: 5 },
      { id: 9, user: 6 },
    ],
    { packetId: null, order: 0, status: 0, title: 't', flowId: null } as Partial<Bit>,
  )
  const packets = new FakeRepository<Packet>()
  const deps = new FakeRepository<Dependency>()
  const flows = new FakeRepository<Flow>()
  const service = new PacketService(packets.asRepo(), bits.asRepo(), deps.asRepo(), flows.asRepo())
  const member = (id: number) => bits.rows.find((b) => b.id === id)!
  return { service, bits, packets, deps, flows, member }
}

describe('PacketService', () => {
  it('legt ein Packet an und vergibt die Reihenfolge der übergebenen Bits', async () => {
    const { service, member } = setup()
    const packet = await service.create({ x: 10, y: 20, bitIds: [2, 1] }, 5)
    expect(packet.name).toBe('Packet 1')
    expect(member(2)).toMatchObject({ packetId: packet.id, order: 0 })
    expect(member(1)).toMatchObject({ packetId: packet.id, order: 1 })
  })

  it('lehnt fremde Bits ab und legt nichts an', async () => {
    const { service, packets } = setup()
    await expect(service.create({ x: 0, y: 0, bitIds: [1, 9] }, 5)).rejects.toBeInstanceOf(
      BadRequestException,
    )
    expect(packets.rows).toHaveLength(0)
  })

  it('übernimmt Bits aus einem anderen Packet und löst das alte auf, wenn < 2 bleiben', async () => {
    const { service, packets, member } = setup()
    const old = await service.create({ x: 0, y: 0, bitIds: [1, 2] }, 5)
    const fresh = await service.create({ x: 0, y: 0, bitIds: [2, 3] }, 5)
    expect(packets.rows.map((p) => p.id)).toEqual([fresh.id])
    expect(member(1).packetId).toBeNull()
    expect(old.id).not.toBe(fresh.id)
  })

  it('setBits sortiert um und macht fehlende Mitglieder lose', async () => {
    const { service, member } = setup()
    const p = await service.create({ x: 0, y: 0, bitIds: [1, 2, 3] }, 5)
    await service.setBits(p.id, 5, [3, 1])
    expect(member(3)).toMatchObject({ packetId: p.id, order: 0 })
    expect(member(1)).toMatchObject({ packetId: p.id, order: 1 })
    expect(member(2).packetId).toBeNull()
  })

  it('setBits auf ein fremdes Packet wirft NotFound', async () => {
    const { service, packets } = setup()
    packets.rows.push({ id: 50, user: 6, name: 'x', x: 0, y: 0, createdAt: new Date() })
    await expect(service.setBits(50, 5, [1, 2])).rejects.toBeInstanceOf(NotFoundException)
  })

  it('remove macht Bits lose und löscht Abhängigkeiten von/zu dem Packet', async () => {
    const { service, packets, deps, member } = setup()
    const p = await service.create({ x: 0, y: 0, bitIds: [1, 2] }, 5)
    await deps.save({ userId: 5, fromType: 'packet', fromId: p.id, toType: 'bit', toId: 3 })
    await deps.save({ userId: 5, fromType: 'bit', fromId: 3, toType: 'packet', toId: p.id })
    await deps.save({ userId: 5, fromType: 'bit', fromId: 3, toType: 'bit', toId: 4 })
    await service.remove(p.id, 5)
    expect(packets.rows).toHaveLength(0)
    expect(member(1).packetId).toBeNull()
    expect(deps.rows).toHaveLength(1)
  })

  it('detachBit löst das Packet auf, wenn nur noch ein Bit übrig ist', async () => {
    const { service, packets, member } = setup()
    await service.create({ x: 0, y: 0, bitIds: [1, 2] }, 5)
    await service.detachBit(1, 5)
    expect(packets.rows).toHaveLength(0)
    expect(member(2).packetId).toBeNull()
  })

  it('attachBit hängt das Bit ans Ende', async () => {
    const { service, member } = setup()
    const p = await service.create({ x: 0, y: 0, bitIds: [1, 2] }, 5)
    await service.attachBit(3, p.id, 5)
    expect(member(3)).toMatchObject({ packetId: p.id, order: 2 })
  })

  it('setBits entfernt Abhängigkeiten zwischen einem beitretenden Bit und dem Packet in beide Richtungen', async () => {
    const { service, deps } = setup()
    const p = await service.create({ x: 0, y: 0, bitIds: [1, 2] }, 5)
    await deps.save({ userId: 5, fromType: 'bit', fromId: 3, toType: 'packet', toId: p.id })
    await deps.save({ userId: 5, fromType: 'packet', fromId: p.id, toType: 'bit', toId: 3 })
    await deps.save({ userId: 5, fromType: 'bit', fromId: 3, toType: 'bit', toId: 4 })
    await service.setBits(p.id, 5, [1, 2, 3])
    expect(deps.rows).toHaveLength(1)
    expect(deps.rows[0]).toMatchObject({ fromType: 'bit', fromId: 3, toType: 'bit', toId: 4 })
  })

  it('attachBit entfernt Abhängigkeiten zwischen dem Bit und dem Packet in beide Richtungen', async () => {
    const { service, deps } = setup()
    const p = await service.create({ x: 0, y: 0, bitIds: [1, 2] }, 5)
    await deps.save({ userId: 5, fromType: 'bit', fromId: 3, toType: 'packet', toId: p.id })
    await deps.save({ userId: 5, fromType: 'packet', fromId: p.id, toType: 'bit', toId: 3 })
    await deps.save({ userId: 5, fromType: 'packet', fromId: p.id, toType: 'bit', toId: 4 })
    await service.attachBit(3, p.id, 5)
    expect(deps.rows).toHaveLength(1)
    expect(deps.rows[0]).toMatchObject({ toId: 4 })
  })

  it('ein Bit, das einem Stapel beitritt, verliert seinen Flow; ein leerer Flow verschwindet', async () => {
    const { service, flows, member } = setup()
    flows.rows.push({ id: 70, user: 5, name: 'F', color: '#818cf8', createdAt: new Date() })
    member(1).flowId = 70
    await service.create({ x: 0, y: 0, bitIds: [1, 2] }, 5)
    expect(member(1).flowId).toBeNull()
    expect(flows.rows).toHaveLength(0)
  })

  it('beim Auflösen eines Stapels erben die Bits seinen Flow', async () => {
    const { service, packets, flows, member } = setup()
    flows.rows.push({ id: 70, user: 5, name: 'F', color: '#818cf8', createdAt: new Date() })
    const p = await service.create({ x: 0, y: 0, bitIds: [1, 2] }, 5)
    packets.rows.find((r) => r.id === p.id)!.flowId = 70
    await service.detachBit(1, 5) // leaves only bit 2 → dissolve
    expect(member(2).flowId).toBe(70)
    expect(flows.rows.map((f) => f.id)).toEqual([70])
  })

  it('update setzt flowId nur auf eigene Flows und räumt den alten Flow auf', async () => {
    const { service, packets, flows } = setup()
    flows.rows.push(
      { id: 70, user: 5, name: 'A', color: '#818cf8', createdAt: new Date() },
      { id: 71, user: 5, name: 'B', color: '#818cf8', createdAt: new Date() },
      { id: 80, user: 6, name: 'X', color: '#818cf8', createdAt: new Date() },
    )
    const p = await service.create({ x: 0, y: 0, bitIds: [1, 2] }, 5)
    packets.rows.find((r) => r.id === p.id)!.flowId = 70
    await expect(service.update(p.id, 5, { flowId: 80 })).rejects.toBeInstanceOf(NotFoundException)
    await service.update(p.id, 5, { flowId: 71 })
    expect(packets.rows.find((r) => r.id === p.id)!.flowId).toBe(71)
    expect(flows.rows.map((f) => f.id)).toEqual([71, 80])
  })
})
