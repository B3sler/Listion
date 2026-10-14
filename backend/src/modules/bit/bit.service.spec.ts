import { describe, it, expect } from 'vitest'
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common'
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
      { id: 'b1', userId: 'u5' },
      { id: 'b2', userId: 'u5' },
      { id: 'b3', userId: 'u5' },
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
  const packet = await packetService.create({ x: 0, y: 0, bitIds: ['b1', 'b2'] }, 'u5')
  const member = (id: string) => bits.rows.find((b) => b.id === id)
  return { service, bits, packets, deps, flows, packet, member }
}

describe('BitService', () => {
  it('übernimmt die Client-ID beim Erstellen', async () => {
    const { service, bits } = await setup()
    const bit = await service.create({ id: 'client-id', title: 'neu' }, 'u5')
    expect(bit).toMatchObject({ id: 'client-id', userId: 'u5', title: 'neu' })
    expect(bits.rows.filter((b) => b.id === 'client-id')).toHaveLength(1)
  })

  it('wirft 409, wenn die Client-ID einem fremden Bit gehört, und ändert es nicht', async () => {
    const { service, bits } = await setup()
    bits.rows.push({ ...bits.rows[0]!, id: 'foreign', userId: 'u6', title: 'fremd' })
    await expect(service.create({ id: 'foreign', title: 'gekapert' }, 'u5')).rejects.toBeInstanceOf(
      ConflictException,
    )
    expect(bits.rows.find((b) => b.id === 'foreign')).toMatchObject({
      userId: 'u6',
      title: 'fremd',
    })
  })

  it('packetId null macht das Bit lose und löst das zu kleine Packet auf', async () => {
    const { service, packets, member } = await setup()
    await service.update('b1', 'u5', { packetId: null, x: 40, y: 50 })
    expect(member('b1')).toMatchObject({ packetId: null, x: 40, y: 50 })
    expect(packets.rows).toHaveLength(0)
  })

  it('packetId hängt ein loses Bit ans Ende und übernimmt andere Felder', async () => {
    const { service, packet, member } = await setup()
    await service.update('b3', 'u5', { packetId: packet.id, title: 'neu' })
    expect(member('b3')).toMatchObject({ packetId: packet.id, order: 2, title: 'neu' })
  })

  it('lehnt ein fremdes oder unbekanntes Packet ab, ohne Felder des Bits zu speichern', async () => {
    const { service, packets, member } = await setup()
    const foreign = await packets.save({ userId: 'u6', name: 'fremd', x: 0, y: 0 })
    await expect(
      service.update('b1', 'u5', { title: 'x', packetId: foreign.id }),
    ).rejects.toBeInstanceOf(NotFoundException)
    expect(member('b1')?.title).toBe('t')
    await expect(
      service.update('b1', 'u5', { title: 'x', packetId: 'missing' }),
    ).rejects.toBeInstanceOf(NotFoundException)
    expect(member('b1')?.title).toBe('t')
  })

  it('remove löscht Abhängigkeiten des Bits und löst das Packet auf', async () => {
    const { service, deps, packets, member } = await setup()
    await deps.save({ userId: 'u5', fromType: 'bit', fromId: 'b1', toType: 'bit', toId: 'b3' })
    await deps.save({ userId: 'u5', fromType: 'bit', fromId: 'b3', toType: 'bit', toId: 'b1' })
    await service.remove('b1', 'u5')
    expect(member('b1')).toBeUndefined()
    expect(deps.rows).toHaveLength(0)
    expect(packets.rows).toHaveLength(0)
    expect(member('b2')?.packetId).toBeNull()
  })

  it('flowId setzt ein loses Bit in einen Flow und räumt den alten auf', async () => {
    const { service, flows, member } = await setup()
    flows.rows.push(
      { id: 'f70', userId: 'u5', name: 'A', color: '#818cf8', createdAt: new Date() },
      { id: 'f71', userId: 'u5', name: 'B', color: '#818cf8', createdAt: new Date() },
    )
    member('b3')!.flowId = 'f70'
    await service.update('b3', 'u5', { flowId: 'f71' })
    expect(member('b3')!.flowId).toBe('f71')
    expect(flows.rows.map((f) => f.id)).toEqual(['f71'])
  })

  it('ein Bit in einem Stapel kann keinen eigenen Flow haben', async () => {
    const { service, flows } = await setup()
    flows.rows.push({ id: 'f70', userId: 'u5', name: 'A', color: '#818cf8', createdAt: new Date() })
    await expect(service.update('b1', 'u5', { flowId: 'f70' })).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })

  it('aus dem Stapel lösen und gleichzeitig in einen Flow setzen ist erlaubt', async () => {
    const { service, flows, member } = await setup()
    flows.rows.push({ id: 'f70', userId: 'u5', name: 'A', color: '#818cf8', createdAt: new Date() })
    await service.update('b1', 'u5', { packetId: null, flowId: 'f70', x: 5, y: 6 })
    expect(member('b1')).toMatchObject({ packetId: null, flowId: 'f70', x: 5, y: 6 })
  })

  it('create mit flowId macht das neue Bit zum Mitglied des Flows', async () => {
    const { service, flows } = await setup()
    flows.rows.push({ id: 'f70', userId: 'u5', name: 'A', color: '#818cf8', createdAt: new Date() })
    const bit = await service.create({ title: 'neu', x: 1, y: 2, flowId: 'f70' }, 'u5')
    expect(bit).toMatchObject({ title: 'neu', flowId: 'f70' })
  })

  it('create mit fremdem Flow wirft NotFound und speichert nichts', async () => {
    const { service, bits, flows } = await setup()
    flows.rows.push({ id: 'f80', userId: 'u6', name: 'X', color: '#818cf8', createdAt: new Date() })
    const before = bits.rows.length
    await expect(service.create({ title: 'neu', flowId: 'f80' }, 'u5')).rejects.toBeInstanceOf(
      NotFoundException,
    )
    expect(bits.rows).toHaveLength(before)
  })

  it('update mit leerem Body (nur undefined-Felder) lässt das Bit unverändert', async () => {
    const { service, member } = await setup()
    const result = await service.update('b3', 'u5', { title: undefined, x: undefined })
    expect(result).toMatchObject({ id: 'b3', title: 't' })
    expect(member('b3')).toMatchObject({ title: 't' })
  })

  it('remove löscht einen Flow, der dadurch leer wird', async () => {
    const { service, flows, member } = await setup()
    flows.rows.push({ id: 'f70', userId: 'u5', name: 'A', color: '#818cf8', createdAt: new Date() })
    member('b3')!.flowId = 'f70'
    await service.remove('b3', 'u5')
    expect(flows.rows).toHaveLength(0)
  })
})
