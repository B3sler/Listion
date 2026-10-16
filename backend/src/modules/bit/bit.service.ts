import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Bit } from './bit.entity.js'
import { Dependency } from '../dependency/dependency.entity.js'
import { PacketService } from '../packet/packet.service.js'
import { CreateBitDto } from '../../dto/create-bit.dto.js'
import { definedOnly } from '../../common/defined-only.js'
import { UpdateBitDto } from '../../dto/update-bit.dto.js'
import { insertWithId } from '../../common/insert-with-id.js'

@Injectable()
export class BitService {
  constructor(
    @InjectRepository(Bit)
    private readonly bitRepository: Repository<Bit>,
    @InjectRepository(Dependency)
    private readonly deps: Repository<Dependency>,
    private readonly packetService: PacketService,
  ) {}

  async create(createBitDto: CreateBitDto, userId: string): Promise<Bit> {
    const { id, ...fields } = createBitDto
    if (fields.flowId != null) await this.packetService.assertFlow(fields.flowId, userId)
    const bitId = await insertWithId(this.bitRepository, { ...definedOnly(fields), userId }, id)
    return this.findOne(bitId, userId)
  }

  async findAll(userId: string): Promise<Bit[]> {
    return this.bitRepository.find({ where: { userId } })
  }

  async findOne(id: string, userId: string): Promise<Bit> {
    const bit = await this.bitRepository.findOne({ where: { id, userId } })
    if (!bit) throw new NotFoundException('Bit not found')
    return bit
  }

  async update(id: string, userId: string, updateBitDto: UpdateBitDto): Promise<Bit> {
    const bit = await this.findOne(id, userId) // throws 404 if not found or not owned
    const { packetId, flowId, ...fields } = updateBitDto
    // validate before any write
    if (typeof packetId === 'string') await this.packetService.findOne(packetId, userId)
    if (typeof flowId === 'string') {
      await this.packetService.assertFlow(flowId, userId)
      const inPacketAfter =
        typeof packetId === 'string' || (bit.packetId != null && packetId !== null)
      if (inPacketAfter) {
        throw new BadRequestException('Bits inside a packet belong to a flow through their packet')
      }
    }
    if (packetId === null) await this.packetService.detachBit(id, userId)
    const write = definedOnly(flowId === undefined ? fields : { ...fields, flowId })
    if (Object.keys(write).length > 0) {
      await this.bitRepository.update({ id, userId }, write)
    }
    if (typeof packetId === 'string') await this.packetService.attachBit(id, packetId, userId)
    if (flowId !== undefined && flowId !== bit.flowId) {
      await this.packetService.pruneEmptyFlows([bit.flowId], userId)
    }
    return this.findOne(id, userId)
  }

  async addFocus(id: string, userId: string, seconds: number): Promise<Bit> {
    await this.findOne(id, userId) // throws 404 if not found or not owned
    await this.bitRepository.increment({ id, userId }, 'focusSeconds', seconds)
    return this.findOne(id, userId)
  }

  async remove(id: string, userId: string): Promise<void> {
    const bit = await this.findOne(id, userId) // throws 404 if not found or not owned
    await this.deps.delete({ userId, fromType: 'bit', fromId: id })
    await this.deps.delete({ userId, toType: 'bit', toId: id })
    await this.bitRepository.delete({ id, userId })
    if (bit.packetId != null) await this.packetService.dissolveSmall([bit.packetId], userId)
    await this.packetService.pruneEmptyFlows([bit.flowId], userId)
  }
}
