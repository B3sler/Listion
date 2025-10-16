import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Bit } from '../entities/bit.entity'
import { CreateBitDto } from '../types/create-bit.dto'
import { UpdateBitDto } from '../types/update-bit.dto'

@Injectable()
export class BitService {
  constructor(
    @InjectRepository(Bit)
    private readonly bitRepository: Repository<Bit>,
  ) {}

  async create(createBitDto: CreateBitDto): Promise<Bit> {
    const bit = this.bitRepository.create(createBitDto)
    return this.bitRepository.save(bit)
  }

  async findAll(): Promise<Bit[]> {
    return this.bitRepository.find()
  }

  async findOne(id: number): Promise<Bit | null> {
    return this.bitRepository.findOne({ where: { id } })
  }

  async update(id: number, updateBitDto: UpdateBitDto): Promise<Bit | null> {
    await this.bitRepository.update(id, updateBitDto)
    return this.findOne(id)
  }

  async remove(id: number): Promise<void> {
    await this.bitRepository.delete(id)
  }
}
