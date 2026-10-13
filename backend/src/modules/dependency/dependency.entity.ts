import { ApiProperty } from '@nestjs/swagger'
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

export const NODE_TYPES = ['bit', 'packet'] as const
export type NodeType = (typeof NODE_TYPES)[number]

/** "to" waits for "from". Either end is a bit or a packet. */
@Entity()
export class Dependency {
  @ApiProperty()
  @PrimaryGeneratedColumn()
  id!: number

  @Column()
  userId!: number

  @ApiProperty({ enum: NODE_TYPES })
  @Column({ type: 'varchar', length: 6 })
  fromType!: NodeType

  @ApiProperty()
  @Column()
  fromId!: number

  @ApiProperty({ enum: NODE_TYPES })
  @Column({ type: 'varchar', length: 6 })
  toType!: NodeType

  @ApiProperty()
  @Column()
  toId!: number

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date
}
