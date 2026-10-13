import { ApiProperty } from '@nestjs/swagger'
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

export const DEFAULT_FLOW_COLOR = '#818cf8'

/** A named group of loose bits and packets, drawn as a frame on the canvas. */
@Entity()
export class Flow {
  @ApiProperty()
  @PrimaryGeneratedColumn()
  id!: number

  @Column()
  user!: number

  @ApiProperty({ example: 'Release Q4' })
  @Column({ type: 'varchar', length: 60 })
  name!: string

  @ApiProperty({ example: DEFAULT_FLOW_COLOR })
  @Column({ type: 'varchar', length: 7, default: DEFAULT_FLOW_COLOR })
  color!: string

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date
}
