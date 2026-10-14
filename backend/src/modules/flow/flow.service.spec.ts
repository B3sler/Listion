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
      { id: 'x1', userId: 'u5' },
      { id: 'x2', userId: 'u5' },
      { id: 'x3', userId: 'u5', packetId: 'x10' },
      { id: 'x9', userId: 'u6' },
    ],
    { packetId: null, order: 0, flowId: null, status: 0, title: 't' } as Partial<Bit>,
  )
  const packets = new FakeRepository<Packet>([{ id: 'x10', userId: 'u5', name: 'P', x: 0, y: 0 }], {
    flowId: null,
  } as Partial<Packet>)
  const flows = new FakeRepository<Flow>()
  const service = new FlowService(flows.asRepo(), bits.asRepo(), packets.asRepo())
  const bit = (id: string) => bits.rows.find((b) => b.id === id)!
  const packet = (id: string) => packets.rows.find((p) => p.id === id)!
  return { service, bits, packets, flows, bit, packet }
}

describe('FlowService', () => {
  it('legt einen Flow mit Standardname und -farbe an und setzt die Mitglieder', async () => {
    const { service, bit, packet } = setup()
    const flow = await service.create({ bitIds: ['x1'], packetIds: ['x10'] }, 'u5')
    expect(flow).toMatchObject({ name: 'Flow 1', color: '#818cf8', userId: 'u5' })
    expect(bit('x1').flowId).toBe(flow.id)
    expect(packet('x10').flowId).toBe(flow.id)
  })

  it('übernimmt Mitglieder aus einem alten Flow und löscht ihn, wenn er leer wird', async () => {
    const { service, flows } = setup()
    const old = await service.create({ bitIds: ['x1'], packetIds: [] }, 'u5')
    const keep = await service.create({ bitIds: ['x2'], packetIds: ['x10'] }, 'u5')
    await service.create({ bitIds: ['x1'], packetIds: ['x10'] }, 'u5')
    const ids = flows.rows.map((f) => f.id)
    expect(ids).not.toContain(old.id)
    expect(ids).toContain(keep.id) // still has bit 2
  })

  it.each([
    ['ohne Mitglieder', { bitIds: [], packetIds: [] }],
    ['mit fremdem Bit', { bitIds: ['x9'], packetIds: [] }],
    ['mit Bit in einem Stapel', { bitIds: ['x3'], packetIds: [] }],
    ['mit unbekanntem Packet', { bitIds: [], packetIds: ['x99'] }],
  ])('lehnt einen Flow %s ab', async (_name, dto) => {
    const { service, flows } = setup()
    await expect(service.create(dto, 'u5')).rejects.toBeInstanceOf(BadRequestException)
    expect(flows.rows).toHaveLength(0)
  })

  it('übernimmt die Client-ID beim Erstellen', async () => {
    const { service, bit } = setup()
    const flow = await service.create({ id: 'f-client', bitIds: ['x1'], packetIds: [] }, 'u5')
    expect(flow.id).toBe('f-client')
    expect(bit('x1').flowId).toBe('f-client')
  })

  it('benennt um und färbt um, fremde Flows sind unbekannt', async () => {
    const { service, flows } = setup()
    const flow = await service.create({ bitIds: ['x1'], packetIds: [] }, 'u5')
    expect(
      await service.update(flow.id, 'u5', { name: 'Release', color: '#34d399' }),
    ).toMatchObject({
      name: 'Release',
      color: '#34d399',
    })
    await expect(service.update(flow.id, 'u6', { name: 'x' })).rejects.toBeInstanceOf(
      NotFoundException,
    )
    expect(flows.rows[0]!.name).toBe('Release')
  })

  it('update mit leerem Body (nur undefined-Felder) lässt den Flow unverändert', async () => {
    const { service } = setup()
    const flow = await service.create({ bitIds: ['x1'], packetIds: [], name: 'Keep' }, 'u5')
    const result = await service.update(flow.id, 'u5', { name: undefined, color: undefined })
    expect(result).toMatchObject({ id: flow.id, name: 'Keep', color: '#818cf8' })
  })

  it('vergibt als Standardname die höchste vorhandene Nummer plus eins', async () => {
    const { service, flows } = setup()
    flows.rows.push(
      { id: 'x40', userId: 'u5', name: 'Flow 2', color: '#818cf8', createdAt: new Date() },
      { id: 'x42', userId: 'u6', name: 'Flow 9', color: '#818cf8', createdAt: new Date() },
    )
    const flow = await service.create({ bitIds: ['x1'], packetIds: [] }, 'u5')
    expect(flow.name).toBe('Flow 3')
  })

  it('findAll liefert die Flows des Users aufsteigend nach id', async () => {
    const { service, flows } = setup()
    flows.rows.push(
      { id: 'x3', userId: 'u5', name: 'c', color: '#818cf8', createdAt: new Date() },
      { id: 'x1', userId: 'u5', name: 'a', color: '#818cf8', createdAt: new Date() },
      { id: 'x2', userId: 'u6', name: 'x', color: '#818cf8', createdAt: new Date() },
    )
    expect((await service.findAll('u5')).map((f) => f.id)).toEqual(['x1', 'x3'])
  })

  it('auflösen behält die Mitglieder', async () => {
    const { service, flows, bit, packet } = setup()
    const flow = await service.create({ bitIds: ['x1'], packetIds: ['x10'] }, 'u5')
    await service.remove(flow.id, 'u5')
    expect(flows.rows).toHaveLength(0)
    expect(bit('x1')).toMatchObject({ id: 'x1', flowId: null })
    expect(packet('x10')).toMatchObject({ id: 'x10', flowId: null })
  })
})
