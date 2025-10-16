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
}
