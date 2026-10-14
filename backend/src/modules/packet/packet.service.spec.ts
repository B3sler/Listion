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
      { id: 'b1', userId: 'u5' },
      { id: 'b2', userId: 'u5' },
      { id: 'b3', userId: 'u5' },
      { id: 'b4', userId: 'u5' },
      { id: 'b9', userId: 'u6' },
    ],
    { packetId: null, order: 0, status: 0, title: 't', flowId: null } as Partial<Bit>,
  )
  const packets = new FakeRepository<Packet>()
  const deps = new FakeRepository<Dependency>()
  const flows = new FakeRepository<Flow>()
  const service = new PacketService(packets.asRepo(), bits.asRepo(), deps.asRepo(), flows.asRepo())
  const member = (id: string) => bits.rows.find((b) => b.id === id)!
  return { service, bits, packets, deps, flows, member }
}

describe('PacketService', () => {
  it('legt ein Packet an und vergibt die Reihenfolge der übergebenen Bits', async () => {
    const { service, member } = setup()
    const packet = await service.create({ x: 10, y: 20, bitIds: ['b2', 'b1'] }, 'u5')
    expect(packet.name).toBe('Packet 1')
    expect(member('b2')).toMatchObject({ packetId: packet.id, order: 0 })
    expect(member('b1')).toMatchObject({ packetId: packet.id, order: 1 })
  })

  it('übernimmt die Client-ID beim Erstellen', async () => {
    const { service, member } = setup()
    const p = await service.create({ id: 'p-client', x: 0, y: 0, bitIds: ['b1', 'b2'] }, 'u5')
    expect(p.id).toBe('p-client')
    expect(member('b1').packetId).toBe('p-client')
  })

  it('lehnt fremde Bits ab und legt nichts an', async () => {
    const { service, packets } = setup()
    await expect(service.create({ x: 0, y: 0, bitIds: ['b1', 'b9'] }, 'u5')).rejects.toBeInstanceOf(
      BadRequestException,
    )
    expect(packets.rows).toHaveLength(0)
  })

  it('übernimmt Bits aus einem anderen Packet und löst das alte auf, wenn < 2 bleiben', async () => {
    const { service, packets, member } = setup()
    const old = await service.create({ x: 0, y: 0, bitIds: ['b1', 'b2'] }, 'u5')
    const fresh = await service.create({ x: 0, y: 0, bitIds: ['b2', 'b3'] }, 'u5')
    expect(packets.rows.map((p) => p.id)).toEqual([fresh.id])
    expect(member('b1').packetId).toBeNull()
    expect(old.id).not.toBe(fresh.id)
  })

  it('setBits sortiert um und macht fehlende Mitglieder lose', async () => {
    const { service, member } = setup()
    const p = await service.create({ x: 0, y: 0, bitIds: ['b1', 'b2', 'b3'] }, 'u5')
    await service.setBits(p.id, 'u5', ['b3', 'b1'])
    expect(member('b3')).toMatchObject({ packetId: p.id, order: 0 })
    expect(member('b1')).toMatchObject({ packetId: p.id, order: 1 })
    expect(member('b2').packetId).toBeNull()
  })

  it('setBits auf ein fremdes Packet wirft NotFound', async () => {
    const { service, packets } = setup()
    packets.rows.push({ id: 'p50', userId: 'u6', name: 'x', x: 0, y: 0, createdAt: new Date() })
    await expect(service.setBits('p50', 'u5', ['b1', 'b2'])).rejects.toBeInstanceOf(
      NotFoundException,
    )
  })

  it('remove macht Bits lose und löscht Abhängigkeiten von/zu dem Packet', async () => {
    const { service, packets, deps, member } = setup()
    const p = await service.create({ x: 0, y: 0, bitIds: ['b1', 'b2'] }, 'u5')
    await deps.save({ userId: 'u5', fromType: 'packet', fromId: p.id, toType: 'bit', toId: 'b3' })
    await deps.save({ userId: 'u5', fromType: 'bit', fromId: 'b3', toType: 'packet', toId: p.id })
    await deps.save({ userId: 'u5', fromType: 'bit', fromId: 'b3', toType: 'bit', toId: 'b4' })
    await service.remove(p.id, 'u5')
    expect(packets.rows).toHaveLength(0)
    expect(member('b1').packetId).toBeNull()
    expect(deps.rows).toHaveLength(1)
  })

  it('detachBit löst das Packet auf, wenn nur noch ein Bit übrig ist', async () => {
    const { service, packets, member } = setup()
    await service.create({ x: 0, y: 0, bitIds: ['b1', 'b2'] }, 'u5')
    await service.detachBit('b1', 'u5')
    expect(packets.rows).toHaveLength(0)
    expect(member('b2').packetId).toBeNull()
  })

  it('attachBit hängt das Bit ans Ende', async () => {
    const { service, member } = setup()
    const p = await service.create({ x: 0, y: 0, bitIds: ['b1', 'b2'] }, 'u5')
    await service.attachBit('b3', p.id, 'u5')
    expect(member('b3')).toMatchObject({ packetId: p.id, order: 2 })
  })

  it('setBits entfernt Abhängigkeiten zwischen einem beitretenden Bit und dem Packet in beide Richtungen', async () => {
    const { service, deps } = setup()
    const p = await service.create({ x: 0, y: 0, bitIds: ['b1', 'b2'] }, 'u5')
    await deps.save({ userId: 'u5', fromType: 'bit', fromId: 'b3', toType: 'packet', toId: p.id })
    await deps.save({ userId: 'u5', fromType: 'packet', fromId: p.id, toType: 'bit', toId: 'b3' })
    await deps.save({ userId: 'u5', fromType: 'bit', fromId: 'b3', toType: 'bit', toId: 'b4' })
    await service.setBits(p.id, 'u5', ['b1', 'b2', 'b3'])
    expect(deps.rows).toHaveLength(1)
    expect(deps.rows[0]).toMatchObject({ fromType: 'bit', fromId: 'b3', toType: 'bit', toId: 'b4' })
  })

  it('attachBit entfernt Abhängigkeiten zwischen dem Bit und dem Packet in beide Richtungen', async () => {
    const { service, deps } = setup()
    const p = await service.create({ x: 0, y: 0, bitIds: ['b1', 'b2'] }, 'u5')
    await deps.save({ userId: 'u5', fromType: 'bit', fromId: 'b3', toType: 'packet', toId: p.id })
    await deps.save({ userId: 'u5', fromType: 'packet', fromId: p.id, toType: 'bit', toId: 'b3' })
    await deps.save({ userId: 'u5', fromType: 'packet', fromId: p.id, toType: 'bit', toId: 'b4' })
    await service.attachBit('b3', p.id, 'u5')
    expect(deps.rows).toHaveLength(1)
    expect(deps.rows[0]).toMatchObject({ toId: 'b4' })
  })

  it('ein Bit, das einem Stapel beitritt, verliert seinen Flow; ein leerer Flow verschwindet', async () => {
    const { service, flows, member } = setup()
    flows.rows.push({ id: 'f70', userId: 'u5', name: 'F', color: '#818cf8', createdAt: new Date() })
    member('b1').flowId = 'f70'
    await service.create({ x: 0, y: 0, bitIds: ['b1', 'b2'] }, 'u5')
    expect(member('b1').flowId).toBeNull()
    expect(flows.rows).toHaveLength(0)
  })

  it('beim Auflösen eines Stapels erben die Bits seinen Flow', async () => {
    const { service, packets, flows, member } = setup()
    flows.rows.push({ id: 'f70', userId: 'u5', name: 'F', color: '#818cf8', createdAt: new Date() })
    const p = await service.create({ x: 0, y: 0, bitIds: ['b1', 'b2'] }, 'u5')
    packets.rows.find((r) => r.id === p.id)!.flowId = 'f70'
    await service.detachBit('b1', 'u5') // leaves only bit b2 → dissolve
    expect(member('b2').flowId).toBe('f70')
    expect(flows.rows.map((f) => f.id)).toEqual(['f70'])
  })

  it('create mit flowId stellt den Stapel in den Flow und behält den Flow trotz leerer Mitglieder', async () => {
    const { service, packets, flows, member } = setup()
    flows.rows.push({ id: 'f70', userId: 'u5', name: 'F', color: '#818cf8', createdAt: new Date() })
    member('b1').flowId = 'f70'
    member('b2').flowId = 'f70'
    const p = await service.create({ x: 0, y: 0, bitIds: ['b1', 'b2'], flowId: 'f70' }, 'u5')
    expect(packets.rows.find((r) => r.id === p.id)!.flowId).toBe('f70')
    expect(flows.rows.map((f) => f.id)).toEqual(['f70'])
    expect(member('b1').flowId).toBeNull()
    expect(member('b2').flowId).toBeNull()
  })

  it('create mit fremdem oder unbekanntem Flow wirft NotFound und legt nichts an', async () => {
    const { service, packets, flows, member } = setup()
    flows.rows.push({ id: 'f80', userId: 'u6', name: 'X', color: '#818cf8', createdAt: new Date() })
    await expect(
      service.create({ x: 0, y: 0, bitIds: ['b1', 'b2'], flowId: 'f80' }, 'u5'),
    ).rejects.toBeInstanceOf(NotFoundException)
    await expect(
      service.create({ x: 0, y: 0, bitIds: ['b1', 'b2'], flowId: 'f999' }, 'u5'),
    ).rejects.toBeInstanceOf(NotFoundException)
    expect(packets.rows).toHaveLength(0)
    expect(member('b1').packetId).toBeNull()
  })

  it('update mit leerem Body (nur undefined-Felder) lässt das Packet unverändert', async () => {
    const { service, packets } = setup()
    const p = await service.create({ x: 3, y: 4, name: 'P', bitIds: ['b1', 'b2'] }, 'u5')
    const result = await service.update(p.id, 'u5', {
      name: undefined,
      x: undefined,
      y: undefined,
      flowId: undefined,
    })
    expect(result).toMatchObject({ id: p.id, name: 'P', x: 3, y: 4 })
    expect(packets.rows.find((r) => r.id === p.id)).toMatchObject({ name: 'P', x: 3, y: 4 })
  })

  it('update setzt flowId nur auf eigene Flows und räumt den alten Flow auf', async () => {
    const { service, packets, flows } = setup()
    flows.rows.push(
      { id: 'f70', userId: 'u5', name: 'A', color: '#818cf8', createdAt: new Date() },
      { id: 'f71', userId: 'u5', name: 'B', color: '#818cf8', createdAt: new Date() },
      { id: 'f80', userId: 'u6', name: 'X', color: '#818cf8', createdAt: new Date() },
    )
    const p = await service.create({ x: 0, y: 0, bitIds: ['b1', 'b2'] }, 'u5')
    packets.rows.find((r) => r.id === p.id)!.flowId = 'f70'
    await expect(service.update(p.id, 'u5', { flowId: 'f80' })).rejects.toBeInstanceOf(
      NotFoundException,
    )
    await service.update(p.id, 'u5', { flowId: 'f71' })
    expect(packets.rows.find((r) => r.id === p.id)!.flowId).toBe('f71')
    expect(flows.rows.map((f) => f.id)).toEqual(['f71', 'f80'])
  })
})
