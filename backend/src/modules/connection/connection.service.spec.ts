import { describe, it, expect, vi } from 'vitest'
import { BadRequestException } from '@nestjs/common'
import type { Repository } from 'typeorm'
import { ConnectionService } from './connection.service.js'
import type { BitConnection } from './connection.entity.js'
import type { Bit } from '../bit/bit.entity.js'

const dto = { fromBitId: 1, toBitId: 2, fromSide: 'right', toSide: 'left' } as const

function setup(ownedBits: number) {
  const repo = {
    findOne: vi.fn().mockResolvedValue(null),
    create: vi.fn((v: object) => v),
    save: vi.fn((v: object) => Promise.resolve({ id: 10, ...v })),
  }
  const bits = { count: vi.fn().mockResolvedValue(ownedBits) }
  const service = new ConnectionService(
    repo as unknown as Repository<BitConnection>,
    bits as unknown as Repository<Bit>,
  )
  return { service, repo }
}

describe('ConnectionService', () => {
  it('verbindet nur Bits des eigenen Users', async () => {
    const { service, repo } = setup(1) // nur eines der beiden Bits gehört dem User
    await expect(service.create(dto, 5)).rejects.toBeInstanceOf(BadRequestException)
    expect(repo.save).not.toHaveBeenCalled()
  })

  it('legt die Verbindung für den User an', async () => {
    const { service, repo } = setup(2)
    await service.create(dto, 5)
    expect(repo.save).toHaveBeenCalledWith({ ...dto, userId: 5 })
  })
})
