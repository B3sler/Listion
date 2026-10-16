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
import { Packet } from '../packet/packet.entity.js'
import { Flow } from '../flow/flow.entity.js'
import type { Recurrence } from '../../dto/create-bit.dto.js'

@Entity()
@Index(['userId'])
@Index(['packetId'])
@Index(['flowId'])
export class Bit {
  // UUIDv7, chosen by the client on create or assigned by BitService
  @PrimaryColumn('uuid')
  id!: string

  @Column('uuid')
  userId!: string

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  owner?: Relation<User>

  @Column({ type: 'text' })
  title!: string

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date

  @Column({ type: 'int', default: 0 })
  status!: number

  @Column({ type: 'timestamp', nullable: true })
  dueDate?: Date

  @Column({ type: 'int', nullable: true })
  priority?: number

  @Column({ type: 'text', nullable: true })
  notes?: string

  @Column({ type: 'int', nullable: true })
  x?: number

  @Column({ type: 'int', nullable: true })
  y?: number

  @Column({ type: 'varchar', length: 7, nullable: true })
  color?: string

  @Column({ type: 'uuid', nullable: true })
  packetId?: string | null

  @ManyToOne(() => Packet, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'packetId' })
  packet?: Relation<Packet> | null

  // "order" is an SQL keyword, so the column gets an explicit name
  @Column({ name: 'stepOrder', type: 'int', default: 0 })
  order!: number

  // only loose bits carry a flow; bits inside a packet belong to it through their packet
  @Column({ type: 'uuid', nullable: true })
  flowId?: string | null

  @ManyToOne(() => Flow, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'flowId' })
  flow?: Relation<Flow> | null

  // visual size 1-4 for the bit sheet
  @Column({ type: 'smallint', nullable: true })
  size?: number | null

  @Column({ type: 'varchar', length: 16, nullable: true })
  recurrence?: Recurrence | null

  // how often a recurring bit has been completed
  @Column({ type: 'int', default: 0 })
  completedCount!: number

  // calendar day (YYYY-MM-DD) until which the bit is snoozed
  @Column({ type: 'date', nullable: true })
  snoozedUntil?: string | null

  // total focus time, only changed through the focus endpoint
  @Column({ type: 'int', default: 0 })
  focusSeconds!: number
}
