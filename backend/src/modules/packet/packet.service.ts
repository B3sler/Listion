import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { Packet } from './packet.entity.js'
import { Bit } from '../bit/bit.entity.js'
import { Dependency } from '../dependency/dependency.entity.js'
import { CreatePacketDto } from '../../dto/create-packet.dto.js'
import { UpdatePacketDto } from '../../dto/update-packet.dto.js'

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
  ) {}

  findAll(userId: number): Promise<Packet[]> {
    return this.packets.find({ where: { user: userId } })
  }

  async findOne(id: number, userId: number): Promise<Packet> {
    const packet = await this.packets.findOne({ where: { id, user: userId } })
    if (!packet) throw new NotFoundException('Packet not found')
    return packet
  }

  async create(dto: CreatePacketDto, userId: number): Promise<Packet> {
    const owned = await this.loadOwnedBits(dto.bitIds, userId)
    const count = await this.packets.count({ where: { user: userId } })
    const packet = await this.packets.save(
      this.packets.create({
        user: userId,
        name: dto.name ?? `Packet ${count + 1}`,
        x: dto.x,
        y: dto.y,
      }),
    )
    await this.assign(packet.id, dto.bitIds, userId)
    await this.dissolveSmall(previousPackets(owned, packet.id), userId)
    return packet
  }

  async update(id: number, userId: number, dto: UpdatePacketDto): Promise<Packet> {
    await this.findOne(id, userId)
    // TypeORM rejects an UPDATE without values, so an empty PUT body is a no-op here.
    if (Object.keys(dto).length > 0) {
      await this.packets.update({ id, user: userId }, dto)
    }
    return this.findOne(id, userId)
  }

  async setBits(id: number, userId: number, bitIds: number[]): Promise<Packet> {
    await this.findOne(id, userId)
    const owned = await this.loadOwnedBits(bitIds, userId)
    const current = await this.bits.find({ where: { packetId: id, user: userId } })
    const released = current.filter((b) => !bitIds.includes(b.id)).map((b) => b.id)
    if (released.length > 0) {
      await this.bits.update({ id: In(released), user: userId }, { packetId: null, order: 0 })
    }
    await this.assign(id, bitIds, userId)
    await this.dissolveSmall(previousPackets(owned, id), userId)
    return this.findOne(id, userId)
  }

  async remove(id: number, userId: number): Promise<void> {
    await this.findOne(id, userId)
    await this.dissolve(id, userId)
  }

  /** Appends a bit (already owned by userId) to the end of a packet. */
  async attachBit(bitId: number, packetId: number, userId: number): Promise<void> {
    await this.findOne(packetId, userId)
    const bit = await this.bits.findOne({ where: { id: bitId, user: userId } })
    if (!bit) throw new NotFoundException('Bit not found')
    if (bit.packetId === packetId) return
    const members = await this.bits.find({ where: { packetId, user: userId } })
    const order = members.length > 0 ? Math.max(...members.map((m) => m.order)) + 1 : 0
    await this.bits.update({ id: bitId, user: userId }, { packetId, order })
    if (bit.packetId != null) await this.dissolveSmall([bit.packetId], userId)
  }

  async detachBit(bitId: number, userId: number): Promise<void> {
    const bit = await this.bits.findOne({ where: { id: bitId, user: userId } })
    if (!bit || bit.packetId == null) return
    await this.bits.update({ id: bitId, user: userId }, { packetId: null, order: 0 })
    await this.dissolveSmall([bit.packetId], userId)
  }

  /** Packets with fewer than 2 members cannot exist: dissolve them. */
  async dissolveSmall(packetIds: number[], userId: number): Promise<void> {
    for (const id of new Set(packetIds)) {
      const members = await this.bits.count({ where: { packetId: id, user: userId } })
      if (members < 2) await this.dissolve(id, userId)
    }
  }

  private async dissolve(id: number, userId: number): Promise<void> {
    await this.bits.update({ packetId: id, user: userId }, { packetId: null, order: 0 })
    await this.deps.delete({ userId, fromType: 'packet', fromId: id })
    await this.deps.delete({ userId, toType: 'packet', toId: id })
    await this.packets.delete({ id, user: userId })
  }

  private async assign(packetId: number, bitIds: number[], userId: number): Promise<void> {
    for (const [order, id] of bitIds.entries()) {
      await this.bits.update({ id, user: userId }, { packetId, order })
    }
  }

  private async loadOwnedBits(bitIds: number[], userId: number): Promise<Bit[]> {
    const owned = await this.bits.find({ where: { id: In(bitIds), user: userId } })
    if (owned.length !== new Set(bitIds).size) throw new BadRequestException('Unknown bit')
    return owned
  }
}

function previousPackets(bits: Bit[], exceptPacketId: number): number[] {
  return bits.map((b) => b.packetId).filter((p): p is number => p != null && p !== exceptPacketId)
}
