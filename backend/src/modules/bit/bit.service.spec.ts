import { describe, it, expect } from 'vitest'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { FakeRepository } from '../../testing/fake-repository.js'
import { BitService } from './bit.service.js'
import { PacketService } from '../packet/packet.service.js'
import type { Bit } from './bit.entity.js'
import type { Packet } from '../packet/packet.entity.js'
import type { Dependency } from '../dependency/dependency.entity.js'
import type { Flow } from '../flow/flow.entity.js'

async function setup() {
  const bits = new FakeRepository<Bit>(
    [
      { id: 1, user: 5 },
      { id: 2, user: 5 },
      { id: 3, user: 5 },
    ],
    { packetId: null, order: 0, status: 0, title: 't', flowId: null } as Partial<Bit>,
  )
  const packets = new FakeRepository<Packet>()
  const deps = new FakeRepository<Dependency>()
  const flows = new FakeRepository<Flow>()
  const packetService = new PacketService(
    packets.asRepo(),
    bits.asRepo(),
    deps.asRepo(),
    flows.asRepo(),
  )
  const service = new BitService(bits.asRepo(), deps.asRepo(), packetService)
  const packet = await packetService.create({ x: 0, y: 0, bitIds: [1, 2] }, 5)
  const member = (id: number) => bits.rows.find((b) => b.id === id)
  return { service, bits, packets, deps, flows, packet, member }
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

  it('lehnt ein fremdes oder unbekanntes Packet ab, ohne Felder des Bits zu speichern', async () => {
    const { service, packets, member } = await setup()
    const foreign = await packets.save({ user: 6, name: 'fremd', x: 0, y: 0 })
    await expect(service.update(1, 5, { title: 'x', packetId: foreign.id })).rejects.toBeInstanceOf(
      NotFoundException,
    )
    expect(member(1)?.title).toBe('t')
    await expect(service.update(1, 5, { title: 'x', packetId: 999 })).rejects.toBeInstanceOf(
      NotFoundException,
    )
    expect(member(1)?.title).toBe('t')
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

  it('flowId setzt ein loses Bit in einen Flow und räumt den alten auf', async () => {
    const { service, flows, member } = await setup()
    flows.rows.push(
      { id: 70, user: 5, name: 'A', color: '#818cf8', createdAt: new Date() },
      { id: 71, user: 5, name: 'B', color: '#818cf8', createdAt: new Date() },
    )
    member(3)!.flowId = 70
    await service.update(3, 5, { flowId: 71 })
    expect(member(3)!.flowId).toBe(71)
    expect(flows.rows.map((f) => f.id)).toEqual([71])
  })

  it('ein Bit in einem Stapel kann keinen eigenen Flow haben', async () => {
    const { service, flows } = await setup()
    flows.rows.push({ id: 70, user: 5, name: 'A', color: '#818cf8', createdAt: new Date() })
    await expect(service.update(1, 5, { flowId: 70 })).rejects.toBeInstanceOf(BadRequestException)
  })

  it('aus dem Stapel lösen und gleichzeitig in einen Flow setzen ist erlaubt', async () => {
    const { service, flows, member } = await setup()
    flows.rows.push({ id: 70, user: 5, name: 'A', color: '#818cf8', createdAt: new Date() })
    await service.update(1, 5, { packetId: null, flowId: 70, x: 5, y: 6 })
    expect(member(1)).toMatchObject({ packetId: null, flowId: 70, x: 5, y: 6 })
  })

  it('create mit flowId macht das neue Bit zum Mitglied des Flows', async () => {
    const { service, flows } = await setup()
    flows.rows.push({ id: 70, user: 5, name: 'A', color: '#818cf8', createdAt: new Date() })
    const bit = await service.create({ title: 'neu', x: 1, y: 2, flowId: 70 }, 5)
    expect(bit).toMatchObject({ title: 'neu', flowId: 70 })
  })

  it('create mit fremdem Flow wirft NotFound und speichert nichts', async () => {
    const { service, bits, flows } = await setup()
    flows.rows.push({ id: 80, user: 6, name: 'X', color: '#818cf8', createdAt: new Date() })
    const before = bits.rows.length
    await expect(service.create({ title: 'neu', flowId: 80 }, 5)).rejects.toBeInstanceOf(
      NotFoundException,
    )
    expect(bits.rows).toHaveLength(before)
  })

  it('update mit leerem Body (nur undefined-Felder) lässt das Bit unverändert', async () => {
    const { service, member } = await setup()
    const result = await service.update(3, 5, { title: undefined, x: undefined })
    expect(result).toMatchObject({ id: 3, title: 't' })
    expect(member(3)).toMatchObject({ title: 't' })
  })

  it('remove löscht einen Flow, der dadurch leer wird', async () => {
    const { service, flows, member } = await setup()
    flows.rows.push({ id: 70, user: 5, name: 'A', color: '#818cf8', createdAt: new Date() })
    member(3)!.flowId = 70
    await service.remove(3, 5)
    expect(flows.rows).toHaveLength(0)
  })
})
