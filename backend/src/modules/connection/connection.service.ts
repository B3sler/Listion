import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { BitConnection } from './connection.entity'
import { CreateConnectionDto } from '../../dto/create-connection.dto'

@Injectable()
export class ConnectionService {
  constructor(
    @InjectRepository(BitConnection)
    private readonly repo: Repository<BitConnection>,
  ) {}

  async create(dto: CreateConnectionDto, userId: number): Promise<BitConnection> {
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
