import { Entity, PrimaryColumn, Column } from 'typeorm'

@Entity('users')
export class User {
  // UUIDv7, assigned by UserService (see common/uuid.ts)
  @PrimaryColumn('uuid')
  id!: string

  @Column({ unique: true })
  email!: string

  @Column()
  password!: string

  @Column({ nullable: true })
  name?: string
}
