import { describe, it, expect } from 'vitest'
import { ValidationPipe, BadRequestException } from '@nestjs/common'
import { CreateBitDto } from './create-bit.dto.js'
import { UpdateBitDto } from './update-bit.dto.js'
import { CreateConnectionDto } from './create-connection.dto.js'
import { RegisterDto } from './auth.dto.js'

// Gleiche Konfiguration wie in main.ts
const pipe = new ValidationPipe({ whitelist: true, transform: true })
const validate = <T>(metatype: new () => T, value: unknown) =>
  pipe.transform(value, { type: 'body', metatype }) as Promise<T>

describe('Request-Validierung', () => {
  it('entfernt Felder, die nicht im DTO stehen (kein Überschreiben von id/user)', async () => {
    const bit = await validate(CreateBitDto, { title: 'Test', id: 7, user: 99 })
    expect(bit).toEqual({ title: 'Test' })

    const update = await validate(UpdateBitDto, { title: 'Neu', user: 99 })
    expect(update).toEqual({ title: 'Neu' })

    const conn = await validate(CreateConnectionDto, {
      fromBitId: 1,
      toBitId: 2,
      fromSide: 'top',
      toSide: 'left',
      id: 5,
      userId: 99,
    })
    expect(conn).toEqual({ fromBitId: 1, toBitId: 2, fromSide: 'top', toSide: 'left' })
  })

  it('akzeptiert partielle Updates und Datumsstrings', async () => {
    const update = await validate(UpdateBitDto, { dueDate: '2025-10-20', priority: 2 })
    expect(update.dueDate).toBeInstanceOf(Date)
    expect(update.priority).toBe(2)
  })

  it('lehnt ungültige Werte ab', async () => {
    await expect(validate(CreateBitDto, { title: '' })).rejects.toBeInstanceOf(BadRequestException)
    await expect(validate(CreateBitDto, { title: 'x', color: 'red' })).rejects.toBeInstanceOf(
      BadRequestException,
    )
    await expect(
      validate(CreateConnectionDto, { fromBitId: 1, toBitId: 2, fromSide: 'middle', toSide: 'top' }),
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(
      validate(RegisterDto, { email: 'kein-email', password: 'langgenug1' }),
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(
      validate(RegisterDto, { email: 'a@b.de', password: 'kurz' }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})
