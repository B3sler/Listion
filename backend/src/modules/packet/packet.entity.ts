import { ApiProperty } from '@nestjs/swagger'
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm'
import { User } from '../user/user.entity.js'
import { Flow } from '../flow/flow.entity.js'

@Entity()
@Index(['userId'])
@Index(['flowId'])
export class Packet {
  // UUIDv7, chosen by the client on create or assigned by PacketService
  @ApiProperty({ format: 'uuid' })
  @PrimaryColumn('uuid')
  id!: string

  @Column('uuid')
  userId!: string

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  owner?: Relation<User>

  @ApiProperty({ example: 'Release' })
  @Column({ type: 'varchar', length: 60 })
  name!: string

  @ApiProperty({ example: 120, description: 'Left edge of the stack (canvas coordinates)' })
  @Column({ type: 'int', default: 0 })
  x!: number

  @ApiProperty({ example: 80, description: 'Top edge of the stack (canvas coordinates)' })
  @Column({ type: 'int', default: 0 })
  y!: number

  @ApiProperty({ required: false, nullable: true, format: 'uuid' })
  @Column({ type: 'uuid', nullable: true })
  flowId?: string | null

  @ManyToOne(() => Flow, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'flowId' })
  flow?: Relation<Flow> | null

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date
}
