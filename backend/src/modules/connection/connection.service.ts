import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { Bit } from '../bit/bit.entity.js'
import { BitConnection } from './connection.entity.js'
import { CreateConnectionDto } from '../../dto/create-connection.dto.js'

@Injectable()
export class ConnectionService {
  constructor(
    @InjectRepository(BitConnection)
    private readonly repo: Repository<BitConnection>,
    @InjectRepository(Bit)
    private readonly bitRepository: Repository<Bit>,
  ) {}

  async create(dto: CreateConnectionDto, userId: number): Promise<BitConnection> {
    // Nur Bits des eigenen Users dürfen verbunden werden
    const ownedBits = await this.bitRepository.count({
      where: { id: In([dto.fromBitId, dto.toBitId]), user: userId },
    })
    const expected = dto.fromBitId === dto.toBitId ? 1 : 2
    if (ownedBits !== expected) {
      throw new BadRequestException('Unknown bit')
    }

    // Return existing if the exact same dot pair is already connected
    const existing = await this.repo.findOne({
      where: {
        userId,
        fromBitId: dto.fromBitId,
        toBitId: dto.toBitId,
        fromSide: dto.fromSide,
        toSide: dto.toSide,
      },
    })
    if (existing) return existing

    const conn = this.repo.create({ ...dto, userId })
    return this.repo.save(conn)
  }

  async findAll(userId: number): Promise<BitConnection[]> {
    return this.repo.find({ where: { userId } })
  }

  async remove(id: number, userId: number): Promise<void> {
    await this.repo.delete({ id, userId })
  }
}
