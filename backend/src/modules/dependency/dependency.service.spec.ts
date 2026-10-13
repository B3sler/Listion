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
      { id: 1, user: 5, packetId: 10 },
      { id: 2, user: 5, packetId: 10 },
      { id: 3, user: 5 },
      { id: 9, user: 6 },
    ],
    { packetId: null, order: 0 } as Partial<Bit>,
  )
  const packets = new FakeRepository<Packet>([
    { id: 10, user: 5, name: 'A', x: 0, y: 0 },
    { id: 20, user: 6, name: 'B', x: 0, y: 0 },
  ])
  const deps = new FakeRepository<Dependency>()
  const service = new DependencyService(deps.asRepo(), bits.asRepo(), packets.asRepo())
  return { service, deps }
}

describe('DependencyService', () => {
  it('legt Bit → Packet für den Besitzer an', async () => {
    const { service, deps } = setup()
    const dep = await service.create({ fromType: 'bit', fromId: 3, toType: 'packet', toId: 10 }, 5)
    expect(dep).toMatchObject({ userId: 5, fromType: 'bit', fromId: 3, toType: 'packet', toId: 10 })
    expect(deps.rows).toHaveLength(1)
  })

  it('gibt eine bereits bestehende Abhängigkeit zurück statt sie zu duplizieren', async () => {
    const { service, deps } = setup()
    const dto = { fromType: 'bit', fromId: 3, toType: 'bit', toId: 1 } as const
    const a = await service.create(dto, 5)
    const b = await service.create(dto, 5)
    expect(b.id).toBe(a.id)
    expect(deps.rows).toHaveLength(1)
  })

  it.each([
    ['gleiche Enden', { fromType: 'bit', fromId: 3, toType: 'bit', toId: 3 }],
    ['Bit → eigenes Packet', { fromType: 'bit', fromId: 1, toType: 'packet', toId: 10 }],
    ['Packet → eigenes Bit', { fromType: 'packet', fromId: 10, toType: 'bit', toId: 2 }],
    ['fremdes Bit', { fromType: 'bit', fromId: 9, toType: 'bit', toId: 3 }],
    ['fremdes Packet', { fromType: 'packet', fromId: 20, toType: 'bit', toId: 3 }],
  ] as const)('lehnt %s ab', async (_name, dto) => {
    const { service, deps } = setup()
    await expect(service.create(dto, 5)).rejects.toBeInstanceOf(BadRequestException)
    expect(deps.rows).toHaveLength(0)
  })
})
