import { describe, it, expect } from 'vitest'
import { ConflictException } from '@nestjs/common'
import { isUUID } from 'class-validator'
import { FakeRepository } from '../testing/fake-repository.js'
import { insertWithId } from './insert-with-id.js'

interface Row {
  id: string
  userId: string
  title: string
}

describe('insertWithId', () => {
  it('übernimmt eine vorgegebene ID', async () => {
    const repo = new FakeRepository<Row>()
    const id = await insertWithId(repo.asRepo(), { userId: 'u1', title: 'x' }, 'given')
    expect(id).toBe('given')
    expect(repo.rows).toEqual([{ id: 'given', userId: 'u1', title: 'x' }])
  })

  it('erzeugt eine UUIDv7, wenn keine ID vorgegeben ist', async () => {
    const repo = new FakeRepository<Row>()
    const id = await insertWithId(repo.asRepo(), { userId: 'u1', title: 'x' })
    expect(isUUID(id, '7')).toBe(true)
  })

  it('wirft 409 bei vergebener ID und überschreibt die bestehende Zeile nicht', async () => {
    const repo = new FakeRepository<Row>([{ id: 'taken', userId: 'other', title: 'fremd' }])
    await expect(
      insertWithId(repo.asRepo(), { userId: 'u1', title: 'x' }, 'taken'),
    ).rejects.toBeInstanceOf(ConflictException)
    expect(repo.rows).toEqual([{ id: 'taken', userId: 'other', title: 'fremd' }])
  })
})
