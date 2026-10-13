import { describe, it, expect } from 'vitest'
import { In } from 'typeorm'
import { FakeRepository } from './fake-repository.js'

interface Row {
  id: number
  user: number
  tag: string | null
}

describe('FakeRepository', () => {
  it('filtert nach Gleichheit und In(), aktualisiert und löscht', async () => {
    const repo = new FakeRepository<Row>(
      [
        { id: 1, user: 5, tag: 'a' },
        { id: 2, user: 5 },
        { id: 3, user: 6, tag: 'a' },
      ],
      { tag: null },
    )

    expect((await repo.find({ where: { user: 5 } })).map((r) => r.id)).toEqual([1, 2])
    expect(await repo.count({ where: { id: In([1, 3]) } })).toBe(2)
    expect((await repo.findOne({ where: { id: 2 } }))?.tag).toBeNull()

    await repo.update({ user: 5 }, { tag: 'b' })
    expect(repo.rows.filter((r) => r.tag === 'b')).toHaveLength(2)

    const saved = await repo.save(repo.create({ user: 7 }))
    expect(saved.id).toBe(4)

    await repo.delete({ user: 5 })
    expect(repo.rows.map((r) => r.id)).toEqual([3, 4])
  })
})
