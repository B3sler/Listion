import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Dependency, type NodeType } from './dependency.entity.js'
import { Bit } from '../bit/bit.entity.js'
import { Packet } from '../packet/packet.entity.js'
import { CreateDependencyDto } from '../../dto/create-dependency.dto.js'
import { insertWithId } from '../../common/insert-with-id.js'

type ResolvedNode =
  { type: 'bit'; id: string; packetId: string | null } | { type: 'packet'; id: string }

@Injectable()
export class DependencyService {
  constructor(
    @InjectRepository(Dependency)
    private readonly deps: Repository<Dependency>,
    @InjectRepository(Bit)
    private readonly bits: Repository<Bit>,
    @InjectRepository(Packet)
    private readonly packets: Repository<Packet>,
  ) {}

  findAll(userId: string): Promise<Dependency[]> {
    return this.deps.find({ where: { userId } })
  }

  async create(dto: CreateDependencyDto, userId: string): Promise<Dependency> {
    if (dto.fromType === dto.toType && dto.fromId === dto.toId) {
      throw new BadRequestException('A dependency needs two different ends')
    }
    const from = await this.resolve(dto.fromType, dto.fromId, userId)
    const to = await this.resolve(dto.toType, dto.toId, userId)
    // A bit and its own packet always form a cycle (the packet is done only when the bit is)
    if (from.type === 'bit' && to.type === 'packet' && from.packetId === to.id) {
      throw new BadRequestException('A bit cannot depend on its own packet')
    }
    if (from.type === 'packet' && to.type === 'bit' && to.packetId === from.id) {
      throw new BadRequestException('A packet cannot depend on one of its own bits')
    }

    const { id, ...ends } = dto
    // The arrow already exists: return it (the caller replaces its own id with this one)
    const existing = await this.deps.findOne({ where: { userId, ...ends } })
    if (existing) return existing
    const depId = await insertWithId(this.deps, { ...ends, userId }, id)
    return (await this.deps.findOne({ where: { id: depId, userId } }))!
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.deps.delete({ id, userId })
  }

  private async resolve(type: NodeType, id: string, userId: string): Promise<ResolvedNode> {
    if (type === 'bit') {
      const bit = await this.bits.findOne({ where: { id, userId } })
      if (!bit) throw new BadRequestException('Unknown bit')
      return { type: 'bit', id, packetId: bit.packetId ?? null }
    }
    const packet = await this.packets.findOne({ where: { id, userId } })
    if (!packet) throw new BadRequestException('Unknown packet')
    return { type: 'packet', id }
  }
}
