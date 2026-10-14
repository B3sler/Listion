import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { Packet } from './packet.entity.js'
import { Bit } from '../bit/bit.entity.js'
import { Dependency } from '../dependency/dependency.entity.js'
import { Flow } from '../flow/flow.entity.js'
import { pruneEmptyFlows } from '../flow/flow-membership.js'
import { CreatePacketDto } from '../../dto/create-packet.dto.js'
import { definedOnly } from '../../common/defined-only.js'
import { UpdatePacketDto } from '../../dto/update-packet.dto.js'
import { insertWithId } from '../../common/insert-with-id.js'

/** Owns packet membership: step order, attach/detach, and the "at least 2 bits" rule. */
@Injectable()
export class PacketService {
  constructor(
    @InjectRepository(Packet)
    private readonly packets: Repository<Packet>,
    @InjectRepository(Bit)
    private readonly bits: Repository<Bit>,
    @InjectRepository(Dependency)
    private readonly deps: Repository<Dependency>,
    @InjectRepository(Flow)
    private readonly flows: Repository<Flow>,
  ) {}

  findAll(userId: string): Promise<Packet[]> {
    return this.packets.find({ where: { userId } })
  }

  async findOne(id: string, userId: string): Promise<Packet> {
    const packet = await this.packets.findOne({ where: { id, userId } })
    if (!packet) throw new NotFoundException('Packet not found')
    return packet
  }

  /** 404 unless the flow exists and belongs to the user. */
  async assertFlow(flowId: string, userId: string): Promise<void> {
    const flow = await this.flows.findOne({ where: { id: flowId, userId } })
    if (!flow) throw new NotFoundException('Flow not found')
  }

  pruneEmptyFlows(flowIds: (string | null | undefined)[], userId: string): Promise<void> {
    return pruneEmptyFlows(flowIds, userId, {
      flows: this.flows,
      bits: this.bits,
      packets: this.packets,
    })
  }

  async create(dto: CreatePacketDto, userId: string): Promise<Packet> {
    if (dto.flowId != null) await this.assertFlow(dto.flowId, userId)
    const owned = await this.loadOwnedBits(dto.bitIds, userId)
    const count = await this.packets.count({ where: { userId } })
    const packetId = await insertWithId(
      this.packets,
      {
        userId,
        name: dto.name ?? `Packet ${count + 1}`,
        x: dto.x,
        y: dto.y,
        flowId: dto.flowId ?? null,
      },
      dto.id,
    )
    await this.assign(packetId, dto.bitIds, userId)
    await this.dissolveSmall(previousPackets(owned, packetId), userId)
    await this.pruneEmptyFlows(
      owned.map((b) => b.flowId),
      userId,
    )
    return this.findOne(packetId, userId)
  }

  async update(id: string, userId: string, dto: UpdatePacketDto): Promise<Packet> {
    const packet = await this.findOne(id, userId)
    if (typeof dto.flowId === 'string') await this.assertFlow(dto.flowId, userId)
    // A validated DTO carries own keys with value undefined for absent fields, and TypeORM throws
    // on an UPDATE without values: an empty PUT body is a no-op.
    const patch = definedOnly(dto)
    if (Object.keys(patch).length > 0) {
      await this.packets.update({ id, userId }, patch)
    }
    if (dto.flowId !== undefined && dto.flowId !== packet.flowId) {
      await this.pruneEmptyFlows([packet.flowId], userId)
    }
    return this.findOne(id, userId)
  }

  async setBits(id: string, userId: string, bitIds: string[]): Promise<Packet> {
    await this.findOne(id, userId)
    const owned = await this.loadOwnedBits(bitIds, userId)
    const current = await this.bits.find({ where: { packetId: id, userId } })
    const released = current.filter((b) => !bitIds.includes(b.id)).map((b) => b.id)
    if (released.length > 0) {
      await this.bits.update({ id: In(released), userId }, { packetId: null, order: 0 })
    }
    await this.assign(id, bitIds, userId)
    await this.dissolveSmall(previousPackets(owned, id), userId)
    await this.pruneEmptyFlows(
      owned.map((b) => b.flowId),
      userId,
    )
    return this.findOne(id, userId)
  }

  async remove(id: string, userId: string): Promise<void> {
    await this.findOne(id, userId)
    await this.dissolve(id, userId)
  }

  /** Appends a bit (already owned by userId) to the end of a packet. */
  async attachBit(bitId: string, packetId: string, userId: string): Promise<void> {
    await this.findOne(packetId, userId)
    const bit = await this.bits.findOne({ where: { id: bitId, userId } })
    if (!bit) throw new NotFoundException('Bit not found')
    if (bit.packetId === packetId) return
    const members = await this.bits.find({ where: { packetId, userId } })
    const order = members.length > 0 ? Math.max(...members.map((m) => m.order)) + 1 : 0
    await this.bits.update({ id: bitId, userId }, { packetId, order, flowId: null })
    await this.dropOwnPacketDeps(bitId, packetId, userId)
    await this.pruneEmptyFlows([bit.flowId], userId)
    if (bit.packetId != null) await this.dissolveSmall([bit.packetId], userId)
  }

  async detachBit(bitId: string, userId: string): Promise<void> {
    const bit = await this.bits.findOne({ where: { id: bitId, userId } })
    if (!bit || bit.packetId == null) return
    await this.bits.update({ id: bitId, userId }, { packetId: null, order: 0 })
    await this.dissolveSmall([bit.packetId], userId)
  }

  /** Packets with fewer than 2 members cannot exist: dissolve them. */
  async dissolveSmall(packetIds: string[], userId: string): Promise<void> {
    for (const id of new Set(packetIds)) {
      const members = await this.bits.count({ where: { packetId: id, userId } })
      if (members < 2) await this.dissolve(id, userId)
    }
  }

  private async dissolve(id: string, userId: string): Promise<void> {
    const packet = await this.packets.findOne({ where: { id, userId } })
    // freed bits keep the packet's flow, so dissolving a stack inside a flow keeps it there
    await this.bits.update(
      { packetId: id, userId },
      { packetId: null, order: 0, flowId: packet?.flowId ?? null },
    )
    await this.deps.delete({ userId, fromType: 'packet', fromId: id })
    await this.deps.delete({ userId, toType: 'packet', toId: id })
    await this.packets.delete({ id, userId })
    await this.pruneEmptyFlows([packet?.flowId], userId)
  }

  private async assign(packetId: string, bitIds: string[], userId: string): Promise<void> {
    for (const [order, id] of bitIds.entries()) {
      await this.bits.update({ id, userId }, { packetId, order, flowId: null })
      await this.dropOwnPacketDeps(id, packetId, userId)
    }
  }

  /** A bit and its own packet may not depend on each other: drop such arrows when a bit joins. */
  private async dropOwnPacketDeps(bitId: string, packetId: string, userId: string): Promise<void> {
    await this.deps.delete({
      userId,
      fromType: 'bit',
      fromId: bitId,
      toType: 'packet',
      toId: packetId,
    })
    await this.deps.delete({
      userId,
      fromType: 'packet',
      fromId: packetId,
      toType: 'bit',
      toId: bitId,
    })
  }

  private async loadOwnedBits(bitIds: string[], userId: string): Promise<Bit[]> {
    const owned = await this.bits.find({ where: { id: In(bitIds), userId } })
    if (owned.length !== new Set(bitIds).size) throw new BadRequestException('Unknown bit')
    return owned
  }
}

function previousPackets(bits: Bit[], exceptPacketId: string): string[] {
  return bits.map((b) => b.packetId).filter((p): p is string => p != null && p !== exceptPacketId)
}
