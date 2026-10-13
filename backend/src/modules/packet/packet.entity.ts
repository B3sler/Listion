import { ApiProperty } from '@nestjs/swagger'
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity()
export class Packet {
  @ApiProperty()
  @PrimaryGeneratedColumn()
  id!: number

  @Column()
  user!: number

  @ApiProperty({ example: 'Release' })
  @Column({ type: 'varchar', length: 60 })
  name!: string

  @ApiProperty({ example: 120, description: 'Left edge of the stack (canvas coordinates)' })
  @Column({ type: 'int', default: 0 })
  x!: number

  @ApiProperty({ example: 80, description: 'Top edge of the stack (canvas coordinates)' })
  @Column({ type: 'int', default: 0 })
  y!: number

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date
}
