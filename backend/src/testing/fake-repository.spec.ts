import { describe, it, expect } from 'vitest'
import { In, QueryFailedError } from 'typeorm'
import { isUUID } from 'class-validator'
import { FakeRepository } from './fake-repository.js'

interface Row {
  id: string
  userId: string
  tag: string | null
  count: number
}

describe('FakeRepository', () => {
  it('filtert nach Gleichheit und In(), aktualisiert und löscht', async () => {
    const repo = new FakeRepository<Row>(
      [
        { id: 'a', userId: 'u5', tag: 'a' },
        { id: 'b', userId: 'u5' },
        { id: 'c', userId: 'u6', tag: 'a' },
      ],
      { tag: null },
    )

    expect((await repo.find({ where: { userId: 'u5' } })).map((r) => r.id)).toEqual(['a', 'b'])
    expect(await repo.count({ where: { id: In(['a', 'c']) } })).toBe(2)
    expect((await repo.findOne({ where: { id: 'b' } }))?.tag).toBeNull()

    await repo.update({ userId: 'u5' }, { tag: 'b' })
    expect(repo.rows.filter((r) => r.tag === 'b')).toHaveLength(2)

    const saved = await repo.save(repo.create({ userId: 'u7' }))
    expect(isUUID(saved.id, '7')).toBe(true)

    await repo.update({ id: 'a' }, { tag: undefined, userId: 'u5' })
    expect(repo.rows.find((r) => r.id === 'a')!.tag).toBe('b') // undefined is skipped
    await expect(repo.update({ id: 'a' }, { tag: undefined })).rejects.toThrow(/no values/i)

    await repo.delete({ userId: 'u5' })
    expect(repo.rows.map((r) => r.id)).toEqual(['c', saved.id])
  })

  it('insert legt an und wirft bei doppelter ID wie Postgres', async () => {
    const repo = new FakeRepository<Row>([{ id: 'a', userId: 'u5' }], { tag: null })
    await repo.insert({ id: 'b', userId: 'u5' })
    expect(repo.rows.map((r) => r.id)).toEqual(['a', 'b'])

    const err = await repo.insert({ id: 'a', userId: 'u6' }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(QueryFailedError)
    expect((err as QueryFailedError).driverError).toMatchObject({ code: '23505' })
    expect(repo.rows.find((r) => r.id === 'a')?.userId).toBe('u5')
  })

  it('increment addiert auf alle passenden Zeilen und lässt andere unverändert', async () => {
    const repo = new FakeRepository<Row>(
      [
        { id: 'a', userId: 'u5' },
        { id: 'b', userId: 'u6' },
      ],
      { tag: null, count: 1 },
    )
    const result = await repo.increment({ id: 'a', userId: 'u5' }, 'count', 4)
    expect(result.affected).toBe(1)
    expect(repo.rows.map((r) => r.count)).toEqual([5, 1])
    expect((await repo.increment({ id: 'a', userId: 'u6' }, 'count', 4)).affected).toBe(0)
    expect(repo.rows.map((r) => r.count)).toEqual([5, 1])
  })
})
