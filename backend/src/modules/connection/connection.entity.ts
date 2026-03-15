import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

export type Side = 'top' | 'top-right' | 'right' | 'bottom-right' | 'bottom' | 'bottom-left' | 'left' | 'top-left'

@Entity()
export class BitConnection {
  @PrimaryGeneratedColumn()
  id!: number

  @Column()
  userId!: number

  @Column()
  fromBitId!: number

  @Column()
  toBitId!: number

  @Column({ type: 'varchar', length: 12 })
  fromSide!: Side

  @Column({ type: 'varchar', length: 12 })
  toSide!: Side

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date
}
