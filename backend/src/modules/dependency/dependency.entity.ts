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

export const NODE_TYPES = ['bit', 'packet'] as const
export type NodeType = (typeof NODE_TYPES)[number]

/**
 * "to" waits for "from". Either end is a bit or a packet, so fromId/toId cannot be foreign keys:
 * BitService and PacketService delete the arrows of a node they remove.
 */
@Entity()
@Index(['userId', 'fromType', 'fromId', 'toType', 'toId'], { unique: true })
export class Dependency {
  // UUIDv7, chosen by the client on create or assigned by DependencyService
  @ApiProperty({ format: 'uuid' })
  @PrimaryColumn('uuid')
  id!: string

  @Column('uuid')
  userId!: string

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  owner?: Relation<User>

  @ApiProperty({ enum: NODE_TYPES })
  @Column({ type: 'varchar', length: 6 })
  fromType!: NodeType

  @ApiProperty({ format: 'uuid' })
  @Column('uuid')
  fromId!: string

  @ApiProperty({ enum: NODE_TYPES })
  @Column({ type: 'varchar', length: 6 })
  toType!: NodeType

  @ApiProperty({ format: 'uuid' })
  @Column('uuid')
  toId!: string

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date
}
