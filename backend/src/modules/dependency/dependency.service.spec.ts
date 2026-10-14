import { describe, it, expect } from 'vitest'
import { BadRequestException } from '@nestjs/common'
import { FakeRepository } from '../../testing/fake-repository.js'
import { DependencyService } from './dependency.service.js'
import type { Dependency } from './dependency.entity.js'
import type { Bit } from '../bit/bit.entity.js'
import type { Packet } from '../packet/packet.entity.js'

function setup() {
  const bits = new FakeRepository<Bit>(
    [
      { id: 'b1', userId: 'u5', packetId: 'p10' },
      { id: 'b2', userId: 'u5', packetId: 'p10' },
      { id: 'b3', userId: 'u5' },
      { id: 'b9', userId: 'u6' },
    ],
    { packetId: null, order: 0 } as Partial<Bit>,
  )
  const packets = new FakeRepository<Packet>([
    { id: 'p10', userId: 'u5', name: 'A', x: 0, y: 0 },
    { id: 'p20', userId: 'u6', name: 'B', x: 0, y: 0 },
  ])
  const deps = new FakeRepository<Dependency>()
  const service = new DependencyService(deps.asRepo(), bits.asRepo(), packets.asRepo())
  return { service, deps }
}

describe('DependencyService', () => {
  it('legt Bit → Packet für den Besitzer an', async () => {
    const { service, deps } = setup()
    const dep = await service.create(
      { fromType: 'bit', fromId: 'b3', toType: 'packet', toId: 'p10' },
      'u5',
    )
    expect(dep).toMatchObject({
      userId: 'u5',
      fromType: 'bit',
      fromId: 'b3',
      toType: 'packet',
      toId: 'p10',
    })
    expect(deps.rows).toHaveLength(1)
  })

  it('gibt eine bereits bestehende Abhängigkeit zurück statt sie zu duplizieren', async () => {
    const { service, deps } = setup()
    const dto = { fromType: 'bit', fromId: 'b3', toType: 'bit', toId: 'b1' } as const
    const a = await service.create(dto, 'u5')
    const b = await service.create(dto, 'u5')
    expect(b.id).toBe(a.id)
    expect(deps.rows).toHaveLength(1)
  })

  it('übernimmt die Client-ID, gibt aber bei bestehendem Pfeil den bestehenden zurück', async () => {
    const { service } = setup()
    const dto = { fromType: 'bit', fromId: 'b3', toType: 'bit', toId: 'b1' } as const
    const a = await service.create({ ...dto, id: 'd-1' }, 'u5')
    const b = await service.create({ ...dto, id: 'd-2' }, 'u5')
    expect(a.id).toBe('d-1')
    expect(b.id).toBe('d-1')
  })

  it.each([
    ['gleiche Enden', { fromType: 'bit', fromId: 'b3', toType: 'bit', toId: 'b3' }],
    ['Bit → eigenes Packet', { fromType: 'bit', fromId: 'b1', toType: 'packet', toId: 'p10' }],
    ['Packet → eigenes Bit', { fromType: 'packet', fromId: 'p10', toType: 'bit', toId: 'b2' }],
    ['fremdes Bit', { fromType: 'bit', fromId: 'b9', toType: 'bit', toId: 'b3' }],
    ['fremdes Packet', { fromType: 'packet', fromId: 'p20', toType: 'bit', toId: 'b3' }],
  ] as const)('lehnt %s ab', async (_name, dto) => {
    const { service, deps } = setup()
    await expect(service.create(dto, 'u5')).rejects.toBeInstanceOf(BadRequestException)
    expect(deps.rows).toHaveLength(0)
  })
})
