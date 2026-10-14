import { describe, it, expect } from 'vitest'
import { isUUID } from 'class-validator'
import { FakeRepository } from '../../testing/fake-repository.js'
import { UserService } from './user.service.js'
import type { User } from './user.entity.js'

describe('UserService', () => {
  it('legt User mit UUIDv7 an und findet sie per ID', async () => {
    const users = new FakeRepository<User>()
    const service = new UserService(users.asRepo())
    const user = await service.create('a@b.de', 'langgenug1', 'Ada')
    expect(isUUID(user.id, '7')).toBe(true)
    expect(user.password).not.toBe('langgenug1')
    expect(await service.findById(user.id)).toMatchObject({ email: 'a@b.de', name: 'Ada' })
    expect(await service.findById('missing')).toBeNull()
  })
})
