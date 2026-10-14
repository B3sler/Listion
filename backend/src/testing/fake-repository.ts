import { FindOperator, QueryFailedError, type Repository } from 'typeorm'
import { uuidv7 } from '../common/uuid.js'

type Where = Record<string, unknown>

function matches(row: Record<string, unknown>, where: Where): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (expected instanceof FindOperator) {
      if (expected.type === 'in') return (expected.value as unknown[]).includes(row[key])
      throw new Error(`FindOperator "${expected.type}" is not supported by FakeRepository`)
    }
    return (row[key] ?? null) === (expected ?? null)
  })
}

/** Minimal in-memory Repository for unit tests: equality and In() filters only. */
export class FakeRepository<T extends { id: string }> {
  rows: T[] = []

  constructor(
    seed: Partial<T>[] = [],
    private readonly defaults: Partial<T> = {},
  ) {
    for (const row of seed) this.add(row)
  }

  private add(value: Partial<T>): T {
    const row = { ...this.defaults, ...value, id: value.id ?? uuidv7() } as T
    this.rows.push(row)
    return row
  }

  private toWhere(criteria: string | Where): Where {
    return typeof criteria === 'string' ? { id: criteria } : criteria
  }

  create(value: Partial<T>): Partial<T> {
    return { ...value }
  }

  /** Like Postgres: a taken primary key fails with unique_violation (23505). */
  async insert(value: Partial<T>): Promise<{ identifiers: { id: string }[] }> {
    if (value.id != null && this.rows.some((r) => r.id === value.id)) {
      const driverError = Object.assign(new Error('duplicate key value'), { code: '23505' })
      throw new QueryFailedError('INSERT', [], driverError)
    }
    return { identifiers: [{ id: this.add(value).id }] }
  }

  async save(value: Partial<T>): Promise<T> {
    const existing = value.id != null ? this.rows.find((r) => r.id === value.id) : undefined
    if (existing) {
      Object.assign(existing, value)
      return { ...existing }
    }
    return { ...this.add(value) }
  }

  async find(
    options: { where?: Where; order?: Record<string, 'ASC' | 'DESC'> } = {},
  ): Promise<T[]> {
    const found = this.rows
      .filter((r) => matches(r as Record<string, unknown>, options.where ?? {}))
      .map((r) => ({ ...r }))
    for (const [key, direction] of Object.entries(options.order ?? {}).reverse()) {
      const sign = direction === 'DESC' ? -1 : 1
      found.sort((a, b) => {
        const [x, y] = [(a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]]
        return (x! > y! ? 1 : x! < y! ? -1 : 0) * sign
      })
    }
    return found
  }

  async findOne(options: { where: Where }): Promise<T | null> {
    return (await this.find(options))[0] ?? null
  }

  async count(options: { where?: Where } = {}): Promise<number> {
    return (await this.find(options)).length
  }

  /** Like TypeORM: undefined values are skipped, and an UPDATE without any value throws. */
  async update(criteria: string | Where, patch: Partial<T>): Promise<{ affected: number }> {
    const values = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
    if (Object.keys(values).length === 0) {
      throw new Error('UpdateValuesMissingError: no values to update were given')
    }
    const where = this.toWhere(criteria)
    let affected = 0
    for (const row of this.rows) {
      if (matches(row as Record<string, unknown>, where)) {
        Object.assign(row, values)
        affected++
      }
    }
    return { affected }
  }

  async delete(criteria: string | Where): Promise<{ affected: number }> {
    const where = this.toWhere(criteria)
    const before = this.rows.length
    this.rows = this.rows.filter((r) => !matches(r as Record<string, unknown>, where))
    return { affected: before - this.rows.length }
  }

  asRepo(): Repository<T> {
    return this as unknown as Repository<T>
  }
}
