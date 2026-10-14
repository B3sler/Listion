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

export const DEFAULT_FLOW_COLOR = '#818cf8'

/** A named group of loose bits and packets, drawn as a frame on the canvas. */
@Entity()
@Index(['userId'])
export class Flow {
  // UUIDv7, chosen by the client on create or assigned by FlowService
  @ApiProperty({ format: 'uuid' })
  @PrimaryColumn('uuid')
  id!: string

  @Column('uuid')
  userId!: string

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  owner?: Relation<User>

  @ApiProperty({ example: 'Release Q4' })
  @Column({ type: 'varchar', length: 60 })
  name!: string

  @ApiProperty({ example: DEFAULT_FLOW_COLOR })
  @Column({ type: 'varchar', length: 7, default: DEFAULT_FLOW_COLOR })
  color!: string

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date
}
