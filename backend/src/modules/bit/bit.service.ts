import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Bit } from './bit.entity'
import { CreateBitDto } from '../../dto/create-bit.dto'
import { UpdateBitDto } from '../../dto/update-bit.dto'

@Injectable()
export class BitService {
  constructor(
    @InjectRepository(Bit)
    private readonly bitRepository: Repository<Bit>,
  ) {}

  async create(createBitDto: CreateBitDto, userId: number): Promise<Bit> {
    const bit = this.bitRepository.create({ ...createBitDto, user: userId })
    return this.bitRepository.save(bit)
  }

  async findAll(userId: number): Promise<Bit[]> {
    return this.bitRepository.find({ where: { user: userId } })
  }

  async findOne(id: number, userId: number): Promise<Bit> {
    const bit = await this.bitRepository.findOne({ where: { id, user: userId } })
    if (!bit) throw new NotFoundException('Bit not found')
    return bit
  }

  async update(id: number, userId: number, updateBitDto: UpdateBitDto): Promise<Bit> {
    await this.findOne(id, userId) // throws 404 if not found or not owned
    await this.bitRepository.update(id, updateBitDto)
    return this.findOne(id, userId)
  }

  async remove(id: number, userId: number): Promise<void> {
    await this.findOne(id, userId) // throws 404 if not found or not owned
    await this.bitRepository.delete(id)
  }
}
