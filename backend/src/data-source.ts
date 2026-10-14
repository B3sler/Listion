import 'reflect-metadata'
import { DataSource, type DataSourceOptions } from 'typeorm'
import { User } from './modules/user/user.entity.js'
import { Bit } from './modules/bit/bit.entity.js'
import { Packet } from './modules/packet/packet.entity.js'
import { Flow } from './modules/flow/flow.entity.js'
import { Dependency } from './modules/dependency/dependency.entity.js'
import { Init1791981763517 } from './migrations/1791981763517-Init.js'

/**
 * Shared by AppModule and the TypeORM CLI (migration:generate / run / check). A function, so
 * process.env is read after ConfigModule has loaded backend/.env.
 */
export const dataSourceOptions = (): DataSourceOptions => ({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: +(process.env.DB_PORT || 5432),
  username: process.env.DB_USER || 'listion',
  password: process.env.DB_PASS,
  database: process.env.DB_NAME || 'listion',
  entities: [User, Bit, Packet, Flow, Dependency],
  // explicit list instead of a glob: works the same from src (vitest) and dist (node)
  migrations: [Init1791981763517],
})

export default new DataSource(dataSourceOptions())
