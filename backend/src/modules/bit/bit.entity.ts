import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity()
export class Bit {
  @PrimaryGeneratedColumn()
  id!: number

  @Column()
  user!: number

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

  @Column({ type: 'int', nullable: true })
  workspace?: number

  @Column({ type: 'varchar', length: 7, nullable: true })
  color?: string

  @Column({ type: 'int', nullable: true })
  packetId?: number | null

  // "order" is an SQL keyword, so the column gets an explicit name
  @Column({ name: 'stepOrder', type: 'int', default: 0 })
  order!: number
}
