import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from './user.entity.js'
import * as bcrypt from 'bcryptjs'
import { insertWithId } from '../../common/insert-with-id.js'

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(email: string, password: string, name?: string): Promise<User> {
    const hash = await bcrypt.hash(password, 12)
    const id = await insertWithId(this.userRepository, { email, password: hash, name })
    return (await this.findById(id))!
  }

  findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } })
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } })
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.findByEmail(email)
    if (!user) return null
    const valid = await bcrypt.compare(password, user.password)
    return valid ? user : null
  }
}
