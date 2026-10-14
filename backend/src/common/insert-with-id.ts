import { ConflictException } from '@nestjs/common'
import { QueryFailedError, type ObjectLiteral, type Repository } from 'typeorm'
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity.js'
import { uuidv7 } from './uuid.js'

const UNIQUE_VIOLATION = '23505'

/**
 * Inserts a new row under a client-chosen id (or a fresh UUIDv7) and returns the id.
 * Never use save() for this: given an existing id it would UPDATE that row, even another user's.
 */
export async function insertWithId<T extends ObjectLiteral & { id: string }>(
  repo: Repository<T>,
  values: QueryDeepPartialEntity<T>,
  id: string = uuidv7(),
): Promise<string> {
  try {
    await repo.insert({ ...values, id })
  } catch (e) {
    if (e instanceof QueryFailedError && driverCode(e) === UNIQUE_VIOLATION) {
      throw new ConflictException('Already exists')
    }
    throw e
  }
  return id
}

function driverCode(e: QueryFailedError): string | undefined {
  return (e.driverError as { code?: string } | undefined)?.code
}
