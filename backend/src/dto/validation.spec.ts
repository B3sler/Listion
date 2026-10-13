import { describe, it, expect } from 'vitest'
import { ValidationPipe, BadRequestException } from '@nestjs/common'
import { CreateBitDto } from './create-bit.dto.js'
import { UpdateBitDto } from './update-bit.dto.js'
import { CreatePacketDto } from './create-packet.dto.js'
import { UpdatePacketDto } from './update-packet.dto.js'
import { SetPacketBitsDto } from './set-packet-bits.dto.js'
import { CreateDependencyDto } from './create-dependency.dto.js'
import { CreateFlowDto } from './create-flow.dto.js'
import { UpdateFlowDto } from './update-flow.dto.js'
import { RegisterDto } from './auth.dto.js'

// Gleiche Konfiguration wie in main.ts
const pipe = new ValidationPipe({ whitelist: true, transform: true })
const validate = <T>(metatype: new () => T, value: unknown) =>
  pipe.transform(value, { type: 'body', metatype }) as Promise<T>

describe('Request-Validierung', () => {
  it('entfernt Felder, die nicht im DTO stehen (kein Überschreiben von id/user)', async () => {
    const bit = await validate(CreateBitDto, { title: 'Test', id: 7, user: 99 })
    expect(bit).toEqual({ title: 'Test' })

    const update = await validate(UpdateBitDto, { title: 'Neu', user: 99, order: 3 })
    expect(update).toEqual({ title: 'Neu' })

    const dep = await validate(CreateDependencyDto, {
      fromType: 'bit',
      fromId: 1,
      toType: 'packet',
      toId: 2,
      userId: 99,
    })
    expect(dep).toEqual({ fromType: 'bit', fromId: 1, toType: 'packet', toId: 2 })
  })

  it('akzeptiert partielle Updates, Datumsstrings und packetId null', async () => {
    const update = await validate(UpdateBitDto, { dueDate: '2025-10-20', priority: 2 })
    expect(update.dueDate).toBeInstanceOf(Date)
    expect(update.priority).toBe(2)

    const detach = await validate(UpdateBitDto, { packetId: null })
    expect(detach).toEqual({ packetId: null })

    const attach = await validate(UpdateBitDto, { packetId: 4 })
    expect(attach).toEqual({ packetId: 4 })
  })

  it('validiert Packets', async () => {
    const packet = await validate(CreatePacketDto, { x: 1, y: 2, bitIds: [3, 4], user: 9 })
    expect(packet).toEqual({ x: 1, y: 2, bitIds: [3, 4] })
    await expect(validate(CreatePacketDto, { x: 1, y: 2, bitIds: [3] })).rejects.toBeInstanceOf(
      BadRequestException,
    )
    await expect(validate(SetPacketBitsDto, { bitIds: [3, 3] })).rejects.toBeInstanceOf(
      BadRequestException,
    )
    await expect(
      validate(CreatePacketDto, { x: 1, y: 2, bitIds: [1, 2], name: '' }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('validiert Flows und flowId', async () => {
    const flow = await validate(CreateFlowDto, { bitIds: [1], packetIds: [], user: 9 })
    expect(flow).toEqual({ bitIds: [1], packetIds: [] })
    await expect(
      validate(CreateFlowDto, { bitIds: [1], packetIds: [], color: 'blue' }),
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(validate(CreateFlowDto, { bitIds: [1, 1], packetIds: [] })).rejects.toBeInstanceOf(
      BadRequestException,
    )
    await expect(validate(UpdateFlowDto, { name: '' })).rejects.toBeInstanceOf(BadRequestException)
    await expect(validate(UpdateFlowDto, { name: 'x'.repeat(61) })).rejects.toBeInstanceOf(
      BadRequestException,
    )
    expect(await validate(UpdateFlowDto, { color: '#34d399' })).toEqual({ color: '#34d399' })
    expect(await validate(UpdateBitDto, { flowId: null })).toEqual({ flowId: null })
    expect(await validate(UpdatePacketDto, { flowId: 3 })).toEqual({ flowId: 3 })
  })

  it('lehnt ungültige Werte ab', async () => {
    await expect(validate(CreateBitDto, { title: '' })).rejects.toBeInstanceOf(BadRequestException)
    await expect(validate(CreateBitDto, { title: 'x', color: 'red' })).rejects.toBeInstanceOf(
      BadRequestException,
    )
    await expect(
      validate(CreateDependencyDto, { fromType: 'node', fromId: 1, toType: 'bit', toId: 2 }),
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(
      validate(RegisterDto, { email: 'kein-email', password: 'langgenug1' }),
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(
      validate(RegisterDto, { email: 'a@b.de', password: 'kurz' }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})
