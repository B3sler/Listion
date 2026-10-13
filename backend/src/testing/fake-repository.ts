import { FindOperator, type Repository } from 'typeorm'

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
export class FakeRepository<T extends { id: number }> {
  rows: T[] = []
  private nextId = 1

  constructor(
    seed: Partial<T>[] = [],
    private readonly defaults: Partial<T> = {},
  ) {
    for (const row of seed) this.insert(row)
  }

  private insert(value: Partial<T>): T {
    const row = { ...this.defaults, ...value, id: value.id ?? this.nextId } as T
    this.nextId = Math.max(this.nextId, row.id) + 1
    this.rows.push(row)
    return row
  }

  private toWhere(criteria: number | Where): Where {
    return typeof criteria === 'number' ? { id: criteria } : criteria
  }

  create(value: Partial<T>): Partial<T> {
    return { ...value }
  }

  async save(value: Partial<T>): Promise<T> {
    const existing = value.id != null ? this.rows.find((r) => r.id === value.id) : undefined
    if (existing) {
      Object.assign(existing, value)
      return { ...existing }
    }
    return { ...this.insert(value) }
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
  async update(criteria: number | Where, patch: Partial<T>): Promise<{ affected: number }> {
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

  async delete(criteria: number | Where): Promise<{ affected: number }> {
    const where = this.toWhere(criteria)
    const before = this.rows.length
    this.rows = this.rows.filter((r) => !matches(r as Record<string, unknown>, where))
    return { affected: before - this.rows.length }
  }

  asRepo(): Repository<T> {
    return this as unknown as Repository<T>
  }
}
