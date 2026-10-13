import { describe, it, expect } from 'vitest'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { FakeRepository } from '../../testing/fake-repository.js'
import { FlowService } from './flow.service.js'
import type { Flow } from './flow.entity.js'
import type { Bit } from '../bit/bit.entity.js'
import type { Packet } from '../packet/packet.entity.js'

function setup() {
  const bits = new FakeRepository<Bit>(
    [
      { id: 1, user: 5 },
      { id: 2, user: 5 },
      { id: 3, user: 5, packetId: 10 },
      { id: 9, user: 6 },
    ],
    { packetId: null, order: 0, flowId: null, status: 0, title: 't' } as Partial<Bit>,
  )
  const packets = new FakeRepository<Packet>([{ id: 10, user: 5, name: 'P', x: 0, y: 0 }], {
    flowId: null,
  } as Partial<Packet>)
  const flows = new FakeRepository<Flow>()
  const service = new FlowService(flows.asRepo(), bits.asRepo(), packets.asRepo())
  const bit = (id: number) => bits.rows.find((b) => b.id === id)!
  const packet = (id: number) => packets.rows.find((p) => p.id === id)!
  return { service, bits, packets, flows, bit, packet }
}

describe('FlowService', () => {
  it('legt einen Flow mit Standardname und -farbe an und setzt die Mitglieder', async () => {
    const { service, bit, packet } = setup()
    const flow = await service.create({ bitIds: [1], packetIds: [10] }, 5)
    expect(flow).toMatchObject({ name: 'Flow 1', color: '#818cf8', user: 5 })
    expect(bit(1).flowId).toBe(flow.id)
    expect(packet(10).flowId).toBe(flow.id)
  })

  it('übernimmt Mitglieder aus einem alten Flow und löscht ihn, wenn er leer wird', async () => {
    const { service, flows } = setup()
    const old = await service.create({ bitIds: [1], packetIds: [] }, 5)
    const keep = await service.create({ bitIds: [2], packetIds: [10] }, 5)
    await service.create({ bitIds: [1], packetIds: [10] }, 5)
    const ids = flows.rows.map((f) => f.id)
    expect(ids).not.toContain(old.id)
    expect(ids).toContain(keep.id) // still has bit 2
  })

  it.each([
    ['ohne Mitglieder', { bitIds: [], packetIds: [] }],
    ['mit fremdem Bit', { bitIds: [9], packetIds: [] }],
    ['mit Bit in einem Stapel', { bitIds: [3], packetIds: [] }],
    ['mit unbekanntem Packet', { bitIds: [], packetIds: [99] }],
  ])('lehnt einen Flow %s ab', async (_name, dto) => {
    const { service, flows } = setup()
    await expect(service.create(dto, 5)).rejects.toBeInstanceOf(BadRequestException)
    expect(flows.rows).toHaveLength(0)
  })

  it('benennt um und färbt um, fremde Flows sind unbekannt', async () => {
    const { service, flows } = setup()
    const flow = await service.create({ bitIds: [1], packetIds: [] }, 5)
    expect(await service.update(flow.id, 5, { name: 'Release', color: '#34d399' })).toMatchObject({
      name: 'Release',
      color: '#34d399',
    })
    await expect(service.update(flow.id, 6, { name: 'x' })).rejects.toBeInstanceOf(
      NotFoundException,
    )
    expect(flows.rows[0]!.name).toBe('Release')
  })

  it('auflösen behält die Mitglieder', async () => {
    const { service, flows, bit, packet } = setup()
    const flow = await service.create({ bitIds: [1], packetIds: [10] }, 5)
    await service.remove(flow.id, 5)
    expect(flows.rows).toHaveLength(0)
    expect(bit(1)).toMatchObject({ id: 1, flowId: null })
    expect(packet(10)).toMatchObject({ id: 10, flowId: null })
  })
})
