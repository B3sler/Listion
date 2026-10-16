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
import { definedOnly } from '../common/defined-only.js'
import { RegisterDto } from './auth.dto.js'
import { AddFocusDto } from './add-focus.dto.js'

// Gleiche Konfiguration wie in main.ts
const pipe = new ValidationPipe({ whitelist: true, transform: true })
const validate = <T>(metatype: new () => T, value: unknown) =>
  pipe.transform(value, { type: 'body', metatype }) as Promise<T>

const A = '0192f1a0-0000-7000-8000-000000000001'
const B = '0192f1a0-0000-7000-8000-000000000002'
const C = '0192f1a0-0000-7000-8000-000000000003'
const V4 = '9b2c1f8e-3d4a-4b6c-8e1f-2a3b4c5d6e7f'

describe('Request-Validierung', () => {
  it('entfernt Felder, die nicht im DTO stehen (kein Überschreiben von user/order)', async () => {
    const bit = await validate(CreateBitDto, { title: 'Test', user: 99, userId: A })
    expect(bit).toEqual({ title: 'Test' })

    const withId = await validate(CreateBitDto, { id: A, title: 'Test' })
    expect(withId).toEqual({ id: A, title: 'Test' })

    // die ID eines Bits ist nach dem Erstellen fest
    const update = await validate(UpdateBitDto, { id: A, title: 'Neu', userId: B, order: 3 })
    expect(update).toEqual({ title: 'Neu' })

    const dep = await validate(CreateDependencyDto, {
      fromType: 'bit',
      fromId: A,
      toType: 'packet',
      toId: B,
      userId: 'x',
    })
    expect(dep).toEqual({ fromType: 'bit', fromId: A, toType: 'packet', toId: B })
  })

  it('akzeptiert partielle Updates, Datumsstrings und packetId null', async () => {
    const update = await validate(UpdateBitDto, { dueDate: '2025-10-20', priority: 2 })
    expect(update.dueDate).toBeInstanceOf(Date)
    expect(update.priority).toBe(2)

    const detach = await validate(UpdateBitDto, { packetId: null })
    expect(detach).toEqual({ packetId: null })

    const attach = await validate(UpdateBitDto, { packetId: B })
    expect(attach).toEqual({ packetId: B })
  })

  it('validiert Packets', async () => {
    const packet = await validate(CreatePacketDto, { x: 1, y: 2, bitIds: [A, B], userId: 'x' })
    expect(packet).toEqual({ x: 1, y: 2, bitIds: [A, B] })
    await expect(validate(CreatePacketDto, { x: 1, y: 2, bitIds: [A] })).rejects.toBeInstanceOf(
      BadRequestException,
    )
    await expect(validate(SetPacketBitsDto, { bitIds: [A, A] })).rejects.toBeInstanceOf(
      BadRequestException,
    )
    await expect(
      validate(CreatePacketDto, { x: 1, y: 2, bitIds: [A, B], name: '' }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })

  it('validiert Flows und flowId', async () => {
    const flow = await validate(CreateFlowDto, { bitIds: [A], packetIds: [], userId: B })
    expect(flow).toEqual({ bitIds: [A], packetIds: [] })
    await expect(
      validate(CreateFlowDto, { bitIds: [A], packetIds: [], color: 'blue' }),
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(validate(CreateFlowDto, { bitIds: [A, A], packetIds: [] })).rejects.toBeInstanceOf(
      BadRequestException,
    )
    await expect(validate(UpdateFlowDto, { name: '' })).rejects.toBeInstanceOf(BadRequestException)
    await expect(validate(UpdateFlowDto, { name: 'x'.repeat(61) })).rejects.toBeInstanceOf(
      BadRequestException,
    )
    expect(await validate(UpdateFlowDto, { color: '#34d399' })).toEqual({ color: '#34d399' })
    expect(await validate(UpdateBitDto, { flowId: null })).toEqual({ flowId: null })
    expect(await validate(UpdatePacketDto, { flowId: C })).toEqual({ flowId: C })
  })

  it('lehnt null für Flow-Name und -Farbe ab, fehlende Felder bleiben optional', async () => {
    await expect(validate(UpdateFlowDto, { name: null })).rejects.toBeInstanceOf(
      BadRequestException,
    )
    await expect(validate(UpdateFlowDto, { color: null })).rejects.toBeInstanceOf(
      BadRequestException,
    )
    await expect(
      validate(CreateFlowDto, { bitIds: [A], packetIds: [], name: null }),
    ).rejects.toBeInstanceOf(BadRequestException)
    // the parsed DTO carries own keys with value undefined, so only definedOnly() is empty
    expect(Object.keys(definedOnly(await validate(UpdateFlowDto, {})))).toEqual([])
  })

  it('akzeptiert eine optionale flowId beim Anlegen von Packets und Bits', async () => {
    expect(
      await validate(CreatePacketDto, { x: 1, y: 2, bitIds: [A, B], flowId: C }),
    ).toMatchObject({
      flowId: C,
    })
    expect(await validate(CreateBitDto, { title: 'x', flowId: C })).toEqual({
      title: 'x',
      flowId: C,
    })
    await expect(
      validate(CreatePacketDto, { x: 1, y: 2, bitIds: [A, B], flowId: 3 }),
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(validate(CreateBitDto, { title: 'x', flowId: 1.5 })).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })

  it('lehnt ungültige IDs ab', async () => {
    const bad = BadRequestException
    // neue IDs müssen UUIDv7 sein
    await expect(validate(CreateBitDto, { id: V4, title: 'x' })).rejects.toBeInstanceOf(bad)
    await expect(validate(CreateBitDto, { id: 'abc', title: 'x' })).rejects.toBeInstanceOf(bad)
    await expect(validate(UpdateBitDto, { packetId: 4 })).rejects.toBeInstanceOf(bad)
    await expect(validate(SetPacketBitsDto, { bitIds: [1, 2] })).rejects.toBeInstanceOf(bad)
    await expect(validate(CreateFlowDto, { bitIds: [1], packetIds: [] })).rejects.toBeInstanceOf(
      bad,
    )
    await expect(
      validate(CreateFlowDto, { id: V4, bitIds: [A], packetIds: [] }),
    ).rejects.toBeInstanceOf(bad)
    await expect(validate(UpdateBitDto, { flowId: 3 })).rejects.toBeInstanceOf(bad)
    await expect(
      validate(CreateDependencyDto, { fromType: 'bit', fromId: 1, toType: 'bit', toId: B }),
    ).rejects.toBeInstanceOf(bad)
    // Referenzen dürfen jede UUID-Version sein
    await expect(validate(SetPacketBitsDto, { bitIds: [V4, A] })).resolves.toEqual({
      bitIds: [V4, A],
    })
  })

  it('lehnt ungültige Werte ab', async () => {
    await expect(validate(CreateBitDto, { title: '' })).rejects.toBeInstanceOf(BadRequestException)
    await expect(validate(CreateBitDto, { title: 'x', color: 'red' })).rejects.toBeInstanceOf(
      BadRequestException,
    )
    await expect(
      validate(CreateDependencyDto, { fromType: 'node', fromId: A, toType: 'bit', toId: B }),
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(
      validate(RegisterDto, { email: 'kein-email', password: 'langgenug1' }),
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(
      validate(RegisterDto, { email: 'a@b.de', password: 'kurz' }),
    ).rejects.toBeInstanceOf(BadRequestException)
  })
})

describe('Bit-Sheet-Felder', () => {
  it('akzeptiert size, recurrence und snoozedUntil beim Erstellen', async () => {
    const bit = await validate(CreateBitDto, {
      title: 'T',
      size: 3,
      recurrence: 'weekdays',
      snoozedUntil: '2026-10-21',
    })
    expect(bit).toMatchObject({ size: 3, recurrence: 'weekdays', snoozedUntil: '2026-10-21' })
  })

  it('lehnt ungültige Werte ab', async () => {
    for (const body of [
      { title: 'T', size: 0 },
      { title: 'T', size: 5 },
      { title: 'T', recurrence: 'yearly' },
      { title: 'T', snoozedUntil: '21.10.2026' },
      { title: 'T', snoozedUntil: '2026-10-21T00:00:00Z' },
    ])
      await expect(validate(CreateBitDto, body)).rejects.toBeInstanceOf(BadRequestException)
  })

  it('Update erlaubt null zum Zurücksetzen und completedCount, aber nie focusSeconds', async () => {
    const u = await validate(UpdateBitDto, {
      size: null,
      recurrence: null,
      snoozedUntil: null,
      completedCount: 4,
      focusSeconds: 9999,
    })
    expect(u).toEqual({ size: null, recurrence: null, snoozedUntil: null, completedCount: 4 })
    await expect(validate(UpdateBitDto, { completedCount: -1 })).rejects.toBeInstanceOf(
      BadRequestException,
    )
    const c = await validate(CreateBitDto, { title: 'T', completedCount: 3, focusSeconds: 5 })
    expect(c).toEqual({ title: 'T' })
  })

  it('lehnt completedCount null ab, weil die Spalte NOT NULL ist', async () => {
    await expect(validate(UpdateBitDto, { completedCount: null })).rejects.toBeInstanceOf(
      BadRequestException,
    )
  })
})

describe('AddFocusDto', () => {
  it('akzeptiert 1 bis 86400 ganze Sekunden', async () => {
    expect(await validate(AddFocusDto, { seconds: 1 })).toEqual({ seconds: 1 })
    expect(await validate(AddFocusDto, { seconds: 86400 })).toEqual({ seconds: 86400 })
  })

  it('lehnt 0, mehr als 86400 und Kommazahlen ab', async () => {
    for (const seconds of [0, 86401, 1.5])
      await expect(validate(AddFocusDto, { seconds })).rejects.toBeInstanceOf(BadRequestException)
  })
})
