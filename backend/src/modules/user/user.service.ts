import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { User } from './user.entity'
import * as bcrypt from 'bcryptjs'

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(email: string, password: string, name?: string): Promise<User> {
    const hash = await bcrypt.hash(password, 12)
    const user = this.userRepository.create({ email, password: hash, name })
    return this.userRepository.save(user)
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
