import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { DEFAULT_FLOW_COLOR, Flow } from './flow.entity.js'
import { pruneEmptyFlows, type FlowRepos } from './flow-membership.js'
import { Bit } from '../bit/bit.entity.js'
import { Packet } from '../packet/packet.entity.js'
import { CreateFlowDto } from '../../dto/create-flow.dto.js'
import { definedOnly } from '../../common/defined-only.js'
import { UpdateFlowDto } from '../../dto/update-flow.dto.js'

@Injectable()
export class FlowService {
  constructor(
    @InjectRepository(Flow)
    private readonly flows: Repository<Flow>,
    @InjectRepository(Bit)
    private readonly bits: Repository<Bit>,
    @InjectRepository(Packet)
    private readonly packets: Repository<Packet>,
  ) {}

  private get repos(): FlowRepos {
    return { flows: this.flows, bits: this.bits, packets: this.packets }
  }

  findAll(userId: number): Promise<Flow[]> {
    return this.flows.find({ where: { user: userId }, order: { id: 'ASC' } })
  }

  async findOne(id: number, userId: number): Promise<Flow> {
    const flow = await this.flows.findOne({ where: { id, user: userId } })
    if (!flow) throw new NotFoundException('Flow not found')
    return flow
  }

  async create(dto: CreateFlowDto, userId: number): Promise<Flow> {
    if (dto.bitIds.length + dto.packetIds.length === 0) {
      throw new BadRequestException('A flow needs at least one member')
    }
    const bits =
      dto.bitIds.length > 0
        ? await this.bits.find({ where: { id: In(dto.bitIds), user: userId } })
        : []
    if (bits.length !== dto.bitIds.length) throw new BadRequestException('Unknown bit')
    if (bits.some((b) => b.packetId != null)) {
      throw new BadRequestException('Bits inside a packet belong to a flow through their packet')
    }
    const packets =
      dto.packetIds.length > 0
        ? await this.packets.find({ where: { id: In(dto.packetIds), user: userId } })
        : []
    if (packets.length !== dto.packetIds.length) throw new BadRequestException('Unknown packet')

    const existing = await this.flows.find({ where: { user: userId } })
    const highest = Math.max(
      0,
      ...existing.map((f) => Number(/^Flow (\d+)$/.exec(f.name)?.[1] ?? 0)),
    )
    const flow = await this.flows.save(
      this.flows.create({
        user: userId,
        name: dto.name ?? `Flow ${highest + 1}`,
        color: dto.color ?? DEFAULT_FLOW_COLOR,
      }),
    )
    if (dto.bitIds.length > 0) {
      await this.bits.update({ id: In(dto.bitIds), user: userId }, { flowId: flow.id })
    }
    if (dto.packetIds.length > 0) {
      await this.packets.update({ id: In(dto.packetIds), user: userId }, { flowId: flow.id })
    }
    await pruneEmptyFlows(
      [...bits, ...packets].map((m) => m.flowId),
      userId,
      this.repos,
    )
    return flow
  }

  async update(id: number, userId: number, dto: UpdateFlowDto): Promise<Flow> {
    await this.findOne(id, userId)
    // A validated DTO carries own keys with value undefined for absent fields, and TypeORM throws
    // on an UPDATE without values: an empty PUT body is a no-op.
    const patch = definedOnly(dto)
    if (Object.keys(patch).length > 0) await this.flows.update({ id, user: userId }, patch)
    return this.findOne(id, userId)
  }

  /** Dissolve the flow; its members stay where they are. */
  async remove(id: number, userId: number): Promise<void> {
    await this.findOne(id, userId)
    await this.bits.update({ flowId: id, user: userId }, { flowId: null })
    await this.packets.update({ flowId: id, user: userId }, { flowId: null })
    await this.flows.delete({ id, user: userId })
  }
}
