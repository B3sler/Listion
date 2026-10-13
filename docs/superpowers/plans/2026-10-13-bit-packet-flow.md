# Bit & Packet Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the octagon bits and implicit side-connections with capsule bits, explicit packets (stacks) and generic bit/packet dependencies, so users can model task flows on the canvas.

**Architecture:** Backend gets a `packet` table, `packetId`/`stepOrder` on `bit`, and a `dependency` table replacing `bit_connection`; a `PacketService` owns membership rules (order, ≥2 members, dissolve). Frontend splits the workspace into pure, unit-tested composables (`useFlowLayout`, `useFlowState`, `useStackDrag`), a gesture composable, an actions composable that talks to the stores, and three presentational components (`LBitCapsule`, `LPacketStack`, `LDependencyLayer`).

**Tech Stack:** NestJS 12 + TypeORM (Postgres, `synchronize` in dev), class-validator, Vitest (backend with SWC); Vue 3 `<script setup>` + TypeScript, Pinia, Vitest + jsdom, existing `helpers/motion.ts` (springs, `VelocityTracker`, `project`).

**Spec:** `docs/superpowers/specs/2026-10-13-bit-packet-flow-design.md`

## Global Constraints

- Every `/api/packet*`, `/api/dependency*`, `/api/bit*` controller has `@UseGuards(JwtAuthGuard)` at controller level; userId always from `req.user.sub`, never from the body.
- Every service query filters by owner (`user` on bit/packet, `userId` on dependency).
- DTOs use class-validator; the global `ValidationPipe({ whitelist: true, transform: true })` strips unknown fields.
- Swagger decorators (`@ApiTags`, `@ApiOperation`, `@ApiResponse`) on every endpoint.
- A packet always has ≥ 2 bits; below that it is dissolved (bits loose, its dependencies deleted, packet deleted).
- Vue: `<script setup lang="ts">`, `defineProps<...>()`, typed `defineEmits`, `L` prefix for components; strict TS, no `any` in frontend code.
- Do not touch `frontend/src/layout/LTaskbar.vue`.
- Capsule geometry (exact): width 200, height 32, expanded extra 20; stack padding 8, header 40, step gap 4, number column 20, stack width 236.
- Snap: stack hit area = stack rect + 16 px; pair snap = within 24 px above/below a loose capsule.
- Commit messages: Conventional Commits (commitlint hook), ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Quality gate per task: the task's tests pass; at the end `npm run lint`, `npm run type-check`, `npm test` in both workspaces.

## Review Focus

1. **Dragging the second-to-last bit out of a stack** — the packet must dissolve and the remaining bit must stay where it was on screen, not jump to its stale creation coordinates. Pinned by Task 2 (`detachBit` dissolves) and Task 11 (`restoreFreedPositions`).
2. **Dropping a bit back into its own stack at the same or another index** — must reorder, not duplicate or dissolve. Pinned by Task 7 (`findSnapTarget` excludes the dragged bit from the count) and Task 2 (`setBits` reorder test).
3. **Pointer pulled off a capsule mid-drag / released outside the window** — drag must still end cleanly. Handled by window-level listeners incl. `pointercancel` in Task 9.
4. **Deleting a bit or packet that dependencies point to** — dependencies must disappear server-side so no dangling arrows render. Pinned by Task 2 (`remove` deletes packet deps) and Task 4 (`BitService.remove` deletes bit deps).
5. **Arrow released on empty canvas, on itself or on its own packet** — nothing is created and no request is sent. Pinned by Task 6 (`isValidLink`) and Task 3 (server rejects the same cases).

---

## File Structure

**Backend (`backend/src`)**

| File | Responsibility |
|---|---|
| `testing/fake-repository.ts` (new) | In-memory stand-in for TypeORM `Repository` in unit tests (equality + `In()` filters) |
| `modules/packet/packet.entity.ts` (new) | `Packet` entity |
| `modules/packet/packet.service.ts` (new) | Packet CRUD + membership rules (assign order, attach/detach, dissolve) |
| `modules/packet/packet.controller.ts` (new) | `/api/packet` endpoints |
| `modules/dependency/dependency.entity.ts` (new) | `Dependency` entity + `NODE_TYPES` |
| `modules/dependency/dependency.service.ts` (new) | Create/list/delete with ownership + validity rules |
| `modules/dependency/dependency.controller.ts` (new) | `/api/dependency` endpoints |
| `modules/bit/bit.entity.ts` | add `packetId`, `order` (column `stepOrder`) |
| `modules/bit/bit.service.ts` | `packetId` on update, cleanup on delete |
| `dto/create-packet.dto.ts`, `dto/update-packet.dto.ts`, `dto/set-packet-bits.dto.ts`, `dto/create-dependency.dto.ts` (new) | request validation |
| `dto/update-bit.dto.ts` | add nullable `packetId` |
| `app.module.ts` | wire new entities/controllers/services, drop connection |
| `modules/connection/*`, `dto/create-connection.dto.ts` | **delete** |
| `tsconfig.build.json` | exclude `src/testing` |

**Frontend (`frontend/src`)**

| File | Responsibility |
|---|---|
| `types/flow.ts` (new) | shared types: `NodeType`, `NodeRef`, `Packet`, `Dependency`, `WorkflowState`, `PacketSummary`, `PacketCard`, `DependencyItem` |
| `stores/bitStore.ts` | `packetId`/`order` on `Bit`, optimistic `updateBit` |
| `stores/packetStore.ts` (new), `stores/dependencyStore.ts` (new) | API access |
| `stores/connectionStore.ts` | **delete** |
| `composables/useFlowLayout.ts` (new) | geometry constants, stack geometry, canvas rects, arrow anchors/paths |
| `composables/useFlowState.ts` (new) | graph, ready/blocked, cycles, packet summaries, link validity |
| `composables/useStackDrag.ts` (new) | insert index + snap target |
| `composables/useFlowGestures.ts` (new) | pointer gestures: drag bit, drag stack, draw arrow |
| `composables/useFlowActions.ts` (new) | turns gestures into store calls, reload + position repair |
| `components/LBitCapsule.vue` (new) | capsule |
| `components/LPacketStack.vue` (new) | stack |
| `components/LDependencyLayer.vue` (new) | SVG arrows |
| `components/LPacketsHud.vue` | data from packets, focus on click, no local rename |
| `components/LBit.vue` | **delete** |
| `views/LWorkspace.vue` | rewritten orchestration |

---

### Task 1: Backend data model, DTOs and test helper

**Files:**
- Create: `backend/src/testing/fake-repository.ts`
- Create: `backend/src/modules/packet/packet.entity.ts`
- Create: `backend/src/modules/dependency/dependency.entity.ts`
- Create: `backend/src/dto/create-packet.dto.ts`, `backend/src/dto/update-packet.dto.ts`, `backend/src/dto/set-packet-bits.dto.ts`, `backend/src/dto/create-dependency.dto.ts`
- Modify: `backend/src/modules/bit/bit.entity.ts`, `backend/src/dto/update-bit.dto.ts`, `backend/tsconfig.build.json`
- Delete: `backend/src/modules/connection/` (all files), `backend/src/dto/create-connection.dto.ts`
- Modify: `backend/src/app.module.ts` (temporarily without packet/dependency controllers; added in Tasks 2–3)
- Test: `backend/src/dto/validation.spec.ts`, `backend/src/testing/fake-repository.spec.ts`

**Interfaces:**
- Produces: `Packet { id, user, name, x, y, createdAt }`; `Dependency { id, userId, fromType: NodeType, fromId, toType: NodeType, toId, createdAt }`; `NODE_TYPES = ['bit','packet'] as const`; `Bit.packetId?: number | null`, `Bit.order: number`; DTO classes `CreatePacketDto { name?, x, y, bitIds }`, `UpdatePacketDto { name?, x?, y? }`, `SetPacketBitsDto { bitIds }`, `CreateDependencyDto { fromType, fromId, toType, toId }`, `UpdateBitDto.packetId?: number | null`; `FakeRepository<T>` with `rows`, `asRepo()`.

- [ ] **Step 1: Write the failing tests**

Replace `backend/src/dto/validation.spec.ts` with:

```ts
import { describe, it, expect } from 'vitest'
import { ValidationPipe, BadRequestException } from '@nestjs/common'
import { CreateBitDto } from './create-bit.dto.js'
import { UpdateBitDto } from './update-bit.dto.js'
import { CreatePacketDto } from './create-packet.dto.js'
import { SetPacketBitsDto } from './set-packet-bits.dto.js'
import { CreateDependencyDto } from './create-dependency.dto.js'
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
```

Create `backend/src/testing/fake-repository.spec.ts`:

```ts
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
    const repo = new FakeRepository<Row>([
      { id: 1, user: 5, tag: 'a' },
      { id: 2, user: 5 },
      { id: 3, user: 6, tag: 'a' },
    ], { tag: null })

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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend; npx vitest run src/dto/validation.spec.ts src/testing/fake-repository.spec.ts`
Expected: FAIL — cannot resolve `./create-packet.dto.js`, `./fake-repository.js`.

- [ ] **Step 3: Implement**

`backend/src/testing/fake-repository.ts`:

```ts
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

  async find(options: { where?: Where } = {}): Promise<T[]> {
    return this.rows
      .filter((r) => matches(r as Record<string, unknown>, options.where ?? {}))
      .map((r) => ({ ...r }))
  }

  async findOne(options: { where: Where }): Promise<T | null> {
    return (await this.find(options))[0] ?? null
  }

  async count(options: { where?: Where } = {}): Promise<number> {
    return (await this.find(options)).length
  }

  async update(criteria: number | Where, patch: Partial<T>): Promise<{ affected: number }> {
    const where = this.toWhere(criteria)
    let affected = 0
    for (const row of this.rows) {
      if (matches(row as Record<string, unknown>, where)) {
        Object.assign(row, patch)
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
```

`backend/src/modules/packet/packet.entity.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger'
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity()
export class Packet {
  @ApiProperty()
  @PrimaryGeneratedColumn()
  id!: number

  @Column()
  user!: number

  @ApiProperty({ example: 'Release' })
  @Column({ type: 'varchar', length: 60 })
  name!: string

  @ApiProperty({ example: 120, description: 'Left edge of the stack (canvas coordinates)' })
  @Column({ type: 'int', default: 0 })
  x!: number

  @ApiProperty({ example: 80, description: 'Top edge of the stack (canvas coordinates)' })
  @Column({ type: 'int', default: 0 })
  y!: number

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date
}
```

`backend/src/modules/dependency/dependency.entity.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger'
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

export const NODE_TYPES = ['bit', 'packet'] as const
export type NodeType = (typeof NODE_TYPES)[number]

/** "to" waits for "from". Either end is a bit or a packet. */
@Entity()
export class Dependency {
  @ApiProperty()
  @PrimaryGeneratedColumn()
  id!: number

  @Column()
  userId!: number

  @ApiProperty({ enum: NODE_TYPES })
  @Column({ type: 'varchar', length: 6 })
  fromType!: NodeType

  @ApiProperty()
  @Column()
  fromId!: number

  @ApiProperty({ enum: NODE_TYPES })
  @Column({ type: 'varchar', length: 6 })
  toType!: NodeType

  @ApiProperty()
  @Column()
  toId!: number

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date
}
```

`backend/src/modules/bit/bit.entity.ts` — add after the `color` column:

```ts
  @Column({ type: 'int', nullable: true })
  packetId?: number | null

  // "order" is an SQL keyword, so the column gets an explicit name
  @Column({ name: 'stepOrder', type: 'int', default: 0 })
  order!: number
```

`backend/src/dto/create-packet.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger'
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'

export class CreatePacketDto {
  @ApiProperty({ example: 'Release', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name?: string

  @ApiProperty({ example: 120 })
  @IsInt()
  x!: number

  @ApiProperty({ example: 80 })
  @IsInt()
  y!: number

  @ApiProperty({ type: [Number], example: [1, 2], description: 'Bits in step order (at least 2)' })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayUnique()
  @IsInt({ each: true })
  bitIds!: number[]
}
```

`backend/src/dto/update-packet.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger'
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'

export class UpdatePacketDto {
  @ApiProperty({ example: 'Release', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name?: string

  @ApiProperty({ example: 120, required: false })
  @IsOptional()
  @IsInt()
  x?: number

  @ApiProperty({ example: 80, required: false })
  @IsOptional()
  @IsInt()
  y?: number
}
```

`backend/src/dto/set-packet-bits.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger'
import { ArrayMinSize, ArrayUnique, IsArray, IsInt } from 'class-validator'

export class SetPacketBitsDto {
  @ApiProperty({ type: [Number], example: [3, 1, 2], description: 'All member bits in step order' })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayUnique()
  @IsInt({ each: true })
  bitIds!: number[]
}
```

`backend/src/dto/create-dependency.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger'
import { IsIn, IsInt } from 'class-validator'
import { NODE_TYPES, type NodeType } from '../modules/dependency/dependency.entity.js'

export class CreateDependencyDto {
  @ApiProperty({ enum: NODE_TYPES, example: 'bit' })
  @IsIn(NODE_TYPES)
  fromType!: NodeType

  @ApiProperty({ example: 1 })
  @IsInt()
  fromId!: number

  @ApiProperty({ enum: NODE_TYPES, example: 'packet' })
  @IsIn(NODE_TYPES)
  toType!: NodeType

  @ApiProperty({ example: 2 })
  @IsInt()
  toId!: number
}
```

`backend/src/dto/update-bit.dto.ts`:

```ts
import { ApiProperty, PartialType } from '@nestjs/swagger'
import { IsInt, IsOptional } from 'class-validator'
import { CreateBitDto } from './create-bit.dto.js'

export class UpdateBitDto extends PartialType(CreateBitDto) {
  @ApiProperty({
    required: false,
    nullable: true,
    example: 3,
    description: 'Append the bit to this packet, or null to make it a loose bit',
  })
  @IsOptional()
  @IsInt()
  packetId?: number | null
}
```

`backend/tsconfig.build.json` — change `exclude` to:

```json
  "exclude": ["**/*.spec.ts", "src/testing", "test", "node_modules", "dist"]
```

Delete `backend/src/modules/connection/connection.entity.ts`, `connection.service.ts`, `connection.controller.ts`, `connection.service.spec.ts` and `backend/src/dto/create-connection.dto.ts`.

`backend/src/app.module.ts` — remove the three connection imports and replace entity lists/controllers/providers so the file reads:

```ts
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { JwtModule } from '@nestjs/jwt'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { APP_GUARD } from '@nestjs/core'
import { AppController } from './app.controller.js'
import { AppService } from './app.service.js'
import { User } from './modules/user/user.entity.js'
import { UserService } from './modules/user/user.service.js'
import { AuthController } from './modules/user/auth.controller.js'
import { Bit } from './modules/bit/bit.entity.js'
import { BitService } from './modules/bit/bit.service.js'
import { BitController } from './modules/bit/bit.controller.js'
import { Packet } from './modules/packet/packet.entity.js'
import { Dependency } from './modules/dependency/dependency.entity.js'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }) as unknown as import('@nestjs/common').DynamicModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: +(process.env.DB_PORT || 5432),
      username: process.env.DB_USER || 'listion',
      password: process.env.DB_PASS,
      database: process.env.DB_NAME || 'listion',
      entities: [User, Bit, Packet, Dependency],
      synchronize: process.env.NODE_ENV !== 'production',
    }),
    TypeOrmModule.forFeature([User, Bit, Packet, Dependency]),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AppController, AuthController, BitController],
  providers: [AppService, UserService, BitService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
```

- [ ] **Step 4: Run tests and type-check**

Run: `cd backend; npx vitest run; npx tsc --noEmit -p tsconfig.json`
Expected: all tests PASS, tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add -A backend
git commit -m "feat(backend): add packet and dependency data model" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: PacketService and `/api/packet`

**Files:**
- Create: `backend/src/modules/packet/packet.service.ts`, `backend/src/modules/packet/packet.controller.ts`
- Modify: `backend/src/app.module.ts`
- Test: `backend/src/modules/packet/packet.service.spec.ts`

**Interfaces:**
- Consumes: `Packet`, `Bit`, `Dependency`, DTOs from Task 1, `FakeRepository`.
- Produces: `PacketService` with `findAll(userId): Promise<Packet[]>`, `findOne(id, userId): Promise<Packet>`, `create(dto: CreatePacketDto, userId): Promise<Packet>`, `update(id, userId, dto: UpdatePacketDto): Promise<Packet>`, `setBits(id, userId, bitIds: number[]): Promise<Packet>`, `remove(id, userId): Promise<void>`, `attachBit(bitId, packetId, userId): Promise<void>`, `detachBit(bitId, userId): Promise<void>`, `dissolveSmall(packetIds: number[], userId): Promise<void>`.

- [ ] **Step 1: Write the failing test** — `backend/src/modules/packet/packet.service.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { FakeRepository } from '../../testing/fake-repository.js'
import { PacketService } from './packet.service.js'
import type { Packet } from './packet.entity.js'
import type { Bit } from '../bit/bit.entity.js'
import type { Dependency } from '../dependency/dependency.entity.js'

function setup() {
  const bits = new FakeRepository<Bit>(
    [
      { id: 1, user: 5 },
      { id: 2, user: 5 },
      { id: 3, user: 5 },
      { id: 4, user: 5 },
      { id: 9, user: 6 },
    ],
    { packetId: null, order: 0, status: 0, title: 't' } as Partial<Bit>,
  )
  const packets = new FakeRepository<Packet>()
  const deps = new FakeRepository<Dependency>()
  const service = new PacketService(packets.asRepo(), bits.asRepo(), deps.asRepo())
  const member = (id: number) => bits.rows.find((b) => b.id === id)!
  return { service, bits, packets, deps, member }
}

describe('PacketService', () => {
  it('legt ein Packet an und vergibt die Reihenfolge der übergebenen Bits', async () => {
    const { service, member } = setup()
    const packet = await service.create({ x: 10, y: 20, bitIds: [2, 1] }, 5)
    expect(packet.name).toBe('Packet 1')
    expect(member(2)).toMatchObject({ packetId: packet.id, order: 0 })
    expect(member(1)).toMatchObject({ packetId: packet.id, order: 1 })
  })

  it('lehnt fremde Bits ab und legt nichts an', async () => {
    const { service, packets } = setup()
    await expect(service.create({ x: 0, y: 0, bitIds: [1, 9] }, 5)).rejects.toBeInstanceOf(
      BadRequestException,
    )
    expect(packets.rows).toHaveLength(0)
  })

  it('übernimmt Bits aus einem anderen Packet und löst das alte auf, wenn < 2 bleiben', async () => {
    const { service, packets, member } = setup()
    const old = await service.create({ x: 0, y: 0, bitIds: [1, 2] }, 5)
    const fresh = await service.create({ x: 0, y: 0, bitIds: [2, 3] }, 5)
    expect(packets.rows.map((p) => p.id)).toEqual([fresh.id])
    expect(member(1).packetId).toBeNull()
    expect(old.id).not.toBe(fresh.id)
  })

  it('setBits sortiert um und macht fehlende Mitglieder lose', async () => {
    const { service, member } = setup()
    const p = await service.create({ x: 0, y: 0, bitIds: [1, 2, 3] }, 5)
    await service.setBits(p.id, 5, [3, 1])
    expect(member(3)).toMatchObject({ packetId: p.id, order: 0 })
    expect(member(1)).toMatchObject({ packetId: p.id, order: 1 })
    expect(member(2).packetId).toBeNull()
  })

  it('setBits auf ein fremdes Packet wirft NotFound', async () => {
    const { service, packets } = setup()
    packets.rows.push({ id: 50, user: 6, name: 'x', x: 0, y: 0, createdAt: new Date() })
    await expect(service.setBits(50, 5, [1, 2])).rejects.toBeInstanceOf(NotFoundException)
  })

  it('remove macht Bits lose und löscht Abhängigkeiten von/zu dem Packet', async () => {
    const { service, packets, deps, member } = setup()
    const p = await service.create({ x: 0, y: 0, bitIds: [1, 2] }, 5)
    await deps.save({ userId: 5, fromType: 'packet', fromId: p.id, toType: 'bit', toId: 3 })
    await deps.save({ userId: 5, fromType: 'bit', fromId: 3, toType: 'packet', toId: p.id })
    await deps.save({ userId: 5, fromType: 'bit', fromId: 3, toType: 'bit', toId: 4 })
    await service.remove(p.id, 5)
    expect(packets.rows).toHaveLength(0)
    expect(member(1).packetId).toBeNull()
    expect(deps.rows).toHaveLength(1)
  })

  it('detachBit löst das Packet auf, wenn nur noch ein Bit übrig ist', async () => {
    const { service, packets, member } = setup()
    await service.create({ x: 0, y: 0, bitIds: [1, 2] }, 5)
    await service.detachBit(1, 5)
    expect(packets.rows).toHaveLength(0)
    expect(member(2).packetId).toBeNull()
  })

  it('attachBit hängt das Bit ans Ende', async () => {
    const { service, member } = setup()
    const p = await service.create({ x: 0, y: 0, bitIds: [1, 2] }, 5)
    await service.attachBit(3, p.id, 5)
    expect(member(3)).toMatchObject({ packetId: p.id, order: 2 })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend; npx vitest run src/modules/packet`
Expected: FAIL — cannot resolve `./packet.service.js`.

- [ ] **Step 3: Implement** — `backend/src/modules/packet/packet.service.ts`:

```ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { Packet } from './packet.entity.js'
import { Bit } from '../bit/bit.entity.js'
import { Dependency } from '../dependency/dependency.entity.js'
import { CreatePacketDto } from '../../dto/create-packet.dto.js'
import { UpdatePacketDto } from '../../dto/update-packet.dto.js'

/** Owns packet membership: step order, attach/detach, and the "at least 2 bits" rule. */
@Injectable()
export class PacketService {
  constructor(
    @InjectRepository(Packet)
    private readonly packets: Repository<Packet>,
    @InjectRepository(Bit)
    private readonly bits: Repository<Bit>,
    @InjectRepository(Dependency)
    private readonly deps: Repository<Dependency>,
  ) {}

  findAll(userId: number): Promise<Packet[]> {
    return this.packets.find({ where: { user: userId } })
  }

  async findOne(id: number, userId: number): Promise<Packet> {
    const packet = await this.packets.findOne({ where: { id, user: userId } })
    if (!packet) throw new NotFoundException('Packet not found')
    return packet
  }

  async create(dto: CreatePacketDto, userId: number): Promise<Packet> {
    const owned = await this.loadOwnedBits(dto.bitIds, userId)
    const count = await this.packets.count({ where: { user: userId } })
    const packet = await this.packets.save(
      this.packets.create({ user: userId, name: dto.name ?? `Packet ${count + 1}`, x: dto.x, y: dto.y }),
    )
    await this.assign(packet.id, dto.bitIds, userId)
    await this.dissolveSmall(previousPackets(owned, packet.id), userId)
    return packet
  }

  async update(id: number, userId: number, dto: UpdatePacketDto): Promise<Packet> {
    await this.findOne(id, userId)
    await this.packets.update({ id, user: userId }, dto)
    return this.findOne(id, userId)
  }

  async setBits(id: number, userId: number, bitIds: number[]): Promise<Packet> {
    await this.findOne(id, userId)
    const owned = await this.loadOwnedBits(bitIds, userId)
    const current = await this.bits.find({ where: { packetId: id, user: userId } })
    const released = current.filter((b) => !bitIds.includes(b.id)).map((b) => b.id)
    if (released.length > 0) {
      await this.bits.update({ id: In(released), user: userId }, { packetId: null, order: 0 })
    }
    await this.assign(id, bitIds, userId)
    await this.dissolveSmall(previousPackets(owned, id), userId)
    return this.findOne(id, userId)
  }

  async remove(id: number, userId: number): Promise<void> {
    await this.findOne(id, userId)
    await this.dissolve(id, userId)
  }

  /** Appends a bit (already owned by userId) to the end of a packet. */
  async attachBit(bitId: number, packetId: number, userId: number): Promise<void> {
    await this.findOne(packetId, userId)
    const bit = await this.bits.findOne({ where: { id: bitId, user: userId } })
    if (!bit) throw new NotFoundException('Bit not found')
    if (bit.packetId === packetId) return
    const members = await this.bits.find({ where: { packetId, user: userId } })
    const order = members.length > 0 ? Math.max(...members.map((m) => m.order)) + 1 : 0
    await this.bits.update({ id: bitId, user: userId }, { packetId, order })
    if (bit.packetId != null) await this.dissolveSmall([bit.packetId], userId)
  }

  async detachBit(bitId: number, userId: number): Promise<void> {
    const bit = await this.bits.findOne({ where: { id: bitId, user: userId } })
    if (!bit || bit.packetId == null) return
    await this.bits.update({ id: bitId, user: userId }, { packetId: null, order: 0 })
    await this.dissolveSmall([bit.packetId], userId)
  }

  /** Packets with fewer than 2 members cannot exist: dissolve them. */
  async dissolveSmall(packetIds: number[], userId: number): Promise<void> {
    for (const id of new Set(packetIds)) {
      const members = await this.bits.count({ where: { packetId: id, user: userId } })
      if (members < 2) await this.dissolve(id, userId)
    }
  }

  private async dissolve(id: number, userId: number): Promise<void> {
    await this.bits.update({ packetId: id, user: userId }, { packetId: null, order: 0 })
    await this.deps.delete({ userId, fromType: 'packet', fromId: id })
    await this.deps.delete({ userId, toType: 'packet', toId: id })
    await this.packets.delete({ id, user: userId })
  }

  private async assign(packetId: number, bitIds: number[], userId: number): Promise<void> {
    for (const [order, id] of bitIds.entries()) {
      await this.bits.update({ id, user: userId }, { packetId, order })
    }
  }

  private async loadOwnedBits(bitIds: number[], userId: number): Promise<Bit[]> {
    const owned = await this.bits.find({ where: { id: In(bitIds), user: userId } })
    if (owned.length !== new Set(bitIds).size) throw new BadRequestException('Unknown bit')
    return owned
  }
}

function previousPackets(bits: Bit[], exceptPacketId: number): number[] {
  return bits
    .map((b) => b.packetId)
    .filter((p): p is number => p != null && p !== exceptPacketId)
}
```

`backend/src/modules/packet/packet.controller.ts`:

```ts
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Req, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import type { Request } from 'express'
import { JwtAuthGuard } from '../user/jwt-auth.guard.js'
import { PacketService } from './packet.service.js'
import { Packet } from './packet.entity.js'
import { CreatePacketDto } from '../../dto/create-packet.dto.js'
import { UpdatePacketDto } from '../../dto/update-packet.dto.js'
import { SetPacketBitsDto } from '../../dto/set-packet-bits.dto.js'

@ApiTags('Packet')
@Controller('packet')
@UseGuards(JwtAuthGuard)
export class PacketController {
  constructor(private readonly packetService: PacketService) {}

  @Get()
  @ApiOperation({ summary: 'Get all packets (stacks) of the current user' })
  @ApiResponse({ status: 200, type: [Packet] })
  findAll(@Req() req: Request) {
    const userId = (req as any).user.sub as number
    return this.packetService.findAll(userId)
  }

  @Post()
  @ApiOperation({ summary: 'Create a packet from at least two bits (in step order)' })
  @ApiResponse({ status: 201, type: Packet })
  create(@Body() dto: CreatePacketDto, @Req() req: Request) {
    const userId = (req as any).user.sub as number
    return this.packetService.create(dto, userId)
  }

  @Put(':id')
  @ApiOperation({ summary: 'Rename or move a packet' })
  @ApiResponse({ status: 200, type: Packet })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePacketDto, @Req() req: Request) {
    const userId = (req as any).user.sub as number
    return this.packetService.update(id, userId, dto)
  }

  @Put(':id/bits')
  @ApiOperation({ summary: 'Set the exact member bits of a packet in step order' })
  @ApiResponse({ status: 200, type: Packet })
  setBits(@Param('id', ParseIntPipe) id: number, @Body() dto: SetPacketBitsDto, @Req() req: Request) {
    const userId = (req as any).user.sub as number
    return this.packetService.setBits(id, userId, dto.bitIds)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Dissolve a packet (its bits become loose)' })
  @ApiResponse({ status: 200 })
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const userId = (req as any).user.sub as number
    await this.packetService.remove(id, userId)
    return { message: 'Deleted' }
  }
}
```

`backend/src/app.module.ts` — add imports and register:

```ts
import { PacketService } from './modules/packet/packet.service.js'
import { PacketController } from './modules/packet/packet.controller.js'
```

```ts
  controllers: [AppController, AuthController, BitController, PacketController],
  providers: [
    AppService,
    UserService,
    BitService,
    PacketService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
```

- [ ] **Step 4: Run tests**

Run: `cd backend; npx vitest run; npx tsc --noEmit -p tsconfig.json`
Expected: PASS, tsc exit 0.

- [ ] **Step 5: Commit**

```bash
git add -A backend
git commit -m "feat(backend): add packet service with membership rules" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: DependencyService and `/api/dependency`

**Files:**
- Create: `backend/src/modules/dependency/dependency.service.ts`, `backend/src/modules/dependency/dependency.controller.ts`
- Modify: `backend/src/app.module.ts`
- Test: `backend/src/modules/dependency/dependency.service.spec.ts`

**Interfaces:**
- Produces: `DependencyService` with `findAll(userId)`, `create(dto: CreateDependencyDto, userId): Promise<Dependency>`, `remove(id, userId): Promise<void>`.

- [ ] **Step 1: Write the failing test** — `backend/src/modules/dependency/dependency.service.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { BadRequestException } from '@nestjs/common'
import { FakeRepository } from '../../testing/fake-repository.js'
import { DependencyService } from './dependency.service.js'
import type { Dependency } from './dependency.entity.js'
import type { Bit } from '../bit/bit.entity.js'
import type { Packet } from '../packet/packet.entity.js'

function setup() {
  const bits = new FakeRepository<Bit>(
    [
      { id: 1, user: 5, packetId: 10 },
      { id: 2, user: 5, packetId: 10 },
      { id: 3, user: 5 },
      { id: 9, user: 6 },
    ],
    { packetId: null, order: 0 } as Partial<Bit>,
  )
  const packets = new FakeRepository<Packet>([
    { id: 10, user: 5, name: 'A', x: 0, y: 0 },
    { id: 20, user: 6, name: 'B', x: 0, y: 0 },
  ])
  const deps = new FakeRepository<Dependency>()
  const service = new DependencyService(deps.asRepo(), bits.asRepo(), packets.asRepo())
  return { service, deps }
}

describe('DependencyService', () => {
  it('legt Bit → Packet für den Besitzer an', async () => {
    const { service, deps } = setup()
    const dep = await service.create({ fromType: 'bit', fromId: 3, toType: 'packet', toId: 10 }, 5)
    expect(dep).toMatchObject({ userId: 5, fromType: 'bit', fromId: 3, toType: 'packet', toId: 10 })
    expect(deps.rows).toHaveLength(1)
  })

  it('gibt eine bereits bestehende Abhängigkeit zurück statt sie zu duplizieren', async () => {
    const { service, deps } = setup()
    const dto = { fromType: 'bit', fromId: 3, toType: 'bit', toId: 1 } as const
    const a = await service.create(dto, 5)
    const b = await service.create(dto, 5)
    expect(b.id).toBe(a.id)
    expect(deps.rows).toHaveLength(1)
  })

  it.each([
    ['gleiche Enden', { fromType: 'bit', fromId: 3, toType: 'bit', toId: 3 }],
    ['Bit → eigenes Packet', { fromType: 'bit', fromId: 1, toType: 'packet', toId: 10 }],
    ['Packet → eigenes Bit', { fromType: 'packet', fromId: 10, toType: 'bit', toId: 2 }],
    ['fremdes Bit', { fromType: 'bit', fromId: 9, toType: 'bit', toId: 3 }],
    ['fremdes Packet', { fromType: 'packet', fromId: 20, toType: 'bit', toId: 3 }],
  ] as const)('lehnt %s ab', async (_name, dto) => {
    const { service, deps } = setup()
    await expect(service.create(dto, 5)).rejects.toBeInstanceOf(BadRequestException)
    expect(deps.rows).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend; npx vitest run src/modules/dependency`
Expected: FAIL — cannot resolve `./dependency.service.js`.

- [ ] **Step 3: Implement** — `backend/src/modules/dependency/dependency.service.ts`:

```ts
import { BadRequestException, Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Dependency, type NodeType } from './dependency.entity.js'
import { Bit } from '../bit/bit.entity.js'
import { Packet } from '../packet/packet.entity.js'
import { CreateDependencyDto } from '../../dto/create-dependency.dto.js'

type ResolvedNode = { type: 'bit'; id: number; packetId: number | null } | { type: 'packet'; id: number }

@Injectable()
export class DependencyService {
  constructor(
    @InjectRepository(Dependency)
    private readonly deps: Repository<Dependency>,
    @InjectRepository(Bit)
    private readonly bits: Repository<Bit>,
    @InjectRepository(Packet)
    private readonly packets: Repository<Packet>,
  ) {}

  findAll(userId: number): Promise<Dependency[]> {
    return this.deps.find({ where: { userId } })
  }

  async create(dto: CreateDependencyDto, userId: number): Promise<Dependency> {
    if (dto.fromType === dto.toType && dto.fromId === dto.toId) {
      throw new BadRequestException('A dependency needs two different ends')
    }
    const from = await this.resolve(dto.fromType, dto.fromId, userId)
    const to = await this.resolve(dto.toType, dto.toId, userId)
    // A bit and its own packet always form a cycle (the packet is done only when the bit is)
    if (from.type === 'bit' && to.type === 'packet' && from.packetId === to.id) {
      throw new BadRequestException('A bit cannot depend on its own packet')
    }
    if (from.type === 'packet' && to.type === 'bit' && to.packetId === from.id) {
      throw new BadRequestException('A packet cannot depend on one of its own bits')
    }

    const existing = await this.deps.findOne({ where: { userId, ...dto } })
    if (existing) return existing
    return this.deps.save(this.deps.create({ ...dto, userId }))
  }

  async remove(id: number, userId: number): Promise<void> {
    await this.deps.delete({ id, userId })
  }

  private async resolve(type: NodeType, id: number, userId: number): Promise<ResolvedNode> {
    if (type === 'bit') {
      const bit = await this.bits.findOne({ where: { id, user: userId } })
      if (!bit) throw new BadRequestException('Unknown bit')
      return { type: 'bit', id, packetId: bit.packetId ?? null }
    }
    const packet = await this.packets.findOne({ where: { id, user: userId } })
    if (!packet) throw new BadRequestException('Unknown packet')
    return { type: 'packet', id }
  }
}
```

`backend/src/modules/dependency/dependency.controller.ts`:

```ts
import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import type { Request } from 'express'
import { JwtAuthGuard } from '../user/jwt-auth.guard.js'
import { DependencyService } from './dependency.service.js'
import { Dependency } from './dependency.entity.js'
import { CreateDependencyDto } from '../../dto/create-dependency.dto.js'

@ApiTags('Dependency')
@Controller('dependency')
@UseGuards(JwtAuthGuard)
export class DependencyController {
  constructor(private readonly dependencyService: DependencyService) {}

  @Get()
  @ApiOperation({ summary: 'Get all dependencies (arrows) of the current user' })
  @ApiResponse({ status: 200, type: [Dependency] })
  findAll(@Req() req: Request) {
    const userId = (req as any).user.sub as number
    return this.dependencyService.findAll(userId)
  }

  @Post()
  @ApiOperation({ summary: 'Create a dependency: "to" waits for "from" (bit or packet each)' })
  @ApiResponse({ status: 201, type: Dependency })
  create(@Body() dto: CreateDependencyDto, @Req() req: Request) {
    const userId = (req as any).user.sub as number
    return this.dependencyService.create(dto, userId)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a dependency' })
  @ApiResponse({ status: 200 })
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const userId = (req as any).user.sub as number
    await this.dependencyService.remove(id, userId)
    return { message: 'Deleted' }
  }
}
```

`backend/src/app.module.ts` — add imports, `DependencyController` to `controllers`, `DependencyService` to `providers`:

```ts
import { DependencyService } from './modules/dependency/dependency.service.js'
import { DependencyController } from './modules/dependency/dependency.controller.js'
```

- [ ] **Step 4: Run tests**

Run: `cd backend; npx vitest run; npx tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A backend
git commit -m "feat(backend): add dependency endpoints between bits and packets" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: BitService integration (packet membership + cleanup)

**Files:**
- Modify: `backend/src/modules/bit/bit.service.ts`
- Test: `backend/src/modules/bit/bit.service.spec.ts`

**Interfaces:**
- Consumes: `PacketService.attachBit/detachBit/dissolveSmall` (Task 2).
- Produces: `BitService(bitRepository, deps: Repository<Dependency>, packetService: PacketService)`; `update` honours `packetId`; `remove` deletes bit dependencies and dissolves a too-small packet.

- [ ] **Step 1: Write the failing test** — `backend/src/modules/bit/bit.service.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { FakeRepository } from '../../testing/fake-repository.js'
import { BitService } from './bit.service.js'
import { PacketService } from '../packet/packet.service.js'
import type { Bit } from './bit.entity.js'
import type { Packet } from '../packet/packet.entity.js'
import type { Dependency } from '../dependency/dependency.entity.js'

async function setup() {
  const bits = new FakeRepository<Bit>(
    [
      { id: 1, user: 5 },
      { id: 2, user: 5 },
      { id: 3, user: 5 },
    ],
    { packetId: null, order: 0, status: 0, title: 't' } as Partial<Bit>,
  )
  const packets = new FakeRepository<Packet>()
  const deps = new FakeRepository<Dependency>()
  const packetService = new PacketService(packets.asRepo(), bits.asRepo(), deps.asRepo())
  const service = new BitService(bits.asRepo(), deps.asRepo(), packetService)
  const packet = await packetService.create({ x: 0, y: 0, bitIds: [1, 2] }, 5)
  const member = (id: number) => bits.rows.find((b) => b.id === id)
  return { service, bits, packets, deps, packet, member }
}

describe('BitService', () => {
  it('packetId null macht das Bit lose und löst das zu kleine Packet auf', async () => {
    const { service, packets, member } = await setup()
    await service.update(1, 5, { packetId: null, x: 40, y: 50 })
    expect(member(1)).toMatchObject({ packetId: null, x: 40, y: 50 })
    expect(packets.rows).toHaveLength(0)
  })

  it('packetId hängt ein loses Bit ans Ende und übernimmt andere Felder', async () => {
    const { service, packet, member } = await setup()
    await service.update(3, 5, { packetId: packet.id, title: 'neu' })
    expect(member(3)).toMatchObject({ packetId: packet.id, order: 2, title: 'neu' })
  })

  it('remove löscht Abhängigkeiten des Bits und löst das Packet auf', async () => {
    const { service, deps, packets, member } = await setup()
    await deps.save({ userId: 5, fromType: 'bit', fromId: 1, toType: 'bit', toId: 3 })
    await deps.save({ userId: 5, fromType: 'bit', fromId: 3, toType: 'bit', toId: 1 })
    await service.remove(1, 5)
    expect(member(1)).toBeUndefined()
    expect(deps.rows).toHaveLength(0)
    expect(packets.rows).toHaveLength(0)
    expect(member(2)?.packetId).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend; npx vitest run src/modules/bit`
Expected: FAIL — `BitService` constructor arity / `packetId` not handled.

- [ ] **Step 3: Implement** — replace `backend/src/modules/bit/bit.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Bit } from './bit.entity.js'
import { Dependency } from '../dependency/dependency.entity.js'
import { PacketService } from '../packet/packet.service.js'
import { CreateBitDto } from '../../dto/create-bit.dto.js'
import { UpdateBitDto } from '../../dto/update-bit.dto.js'

@Injectable()
export class BitService {
  constructor(
    @InjectRepository(Bit)
    private readonly bitRepository: Repository<Bit>,
    @InjectRepository(Dependency)
    private readonly deps: Repository<Dependency>,
    private readonly packetService: PacketService,
  ) {}

  async create(createBitDto: CreateBitDto, userId: number): Promise<Bit> {
    const bit = this.bitRepository.create({ ...createBitDto, user: userId })
    return this.bitRepository.save(bit)
  }

  async findAll(userId: number): Promise<Bit[]> {
    return this.bitRepository.find({ where: { user: userId } })
  }

  async findOne(id: number, userId: number): Promise<Bit> {
    const bit = await this.bitRepository.findOne({ where: { id, user: userId } })
    if (!bit) throw new NotFoundException('Bit not found')
    return bit
  }

  async update(id: number, userId: number, updateBitDto: UpdateBitDto): Promise<Bit> {
    await this.findOne(id, userId) // throws 404 if not found or not owned
    const { packetId, ...fields } = updateBitDto
    if (Object.keys(fields).length > 0) {
      await this.bitRepository.update({ id, user: userId }, fields)
    }
    if (packetId === null) await this.packetService.detachBit(id, userId)
    else if (packetId !== undefined) await this.packetService.attachBit(id, packetId, userId)
    return this.findOne(id, userId)
  }

  async remove(id: number, userId: number): Promise<void> {
    const bit = await this.findOne(id, userId) // throws 404 if not found or not owned
    await this.deps.delete({ userId, fromType: 'bit', fromId: id })
    await this.deps.delete({ userId, toType: 'bit', toId: id })
    await this.bitRepository.delete({ id, user: userId })
    if (bit.packetId != null) await this.packetService.dissolveSmall([bit.packetId], userId)
  }
}
```

- [ ] **Step 4: Run full backend checks**

Run: `cd backend; npx vitest run; npx tsc --noEmit -p tsconfig.json; npx eslint "src/**/*.ts"`
Expected: PASS, exit 0.

- [ ] **Step 5: Commit**

```bash
git add -A backend
git commit -m "feat(backend): keep packets consistent when bits move or are deleted" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Frontend types and stores

**Files:**
- Create: `frontend/src/types/flow.ts`, `frontend/src/stores/packetStore.ts`, `frontend/src/stores/dependencyStore.ts`
- Modify: `frontend/src/stores/bitStore.ts`
- Delete: `frontend/src/stores/connectionStore.ts` (its only users, `LWorkspace.vue`/`LBit.vue`, are replaced in Task 11; until then type-check is expected to fail only in those two files)
- Test: `frontend/src/stores/flowStores.test.ts`

**Interfaces:**
- Produces (types): `NodeType = 'bit' | 'packet'`; `NodeRef { type: NodeType; id: number }`; `Packet { id; name; x; y }`; `Dependency { id; fromType; fromId; toType; toId }`; `WorkflowState = 'blocked' | 'ready' | null`; `PacketSummary { total; done; inProgress; blocked; ready; cycles; percent }`; `PacketCard extends PacketSummary { key; name; bitIds }`; `DependencyItem { id; d; mx; my; tx; ty; angle; state: 'pending' | 'done' | 'cycle'; dimmed }`.
- Produces (stores): `Bit.packetId: number | null`, `Bit.order: number`; `useBitStore().updateBit` optimistic; `usePacketStore()` → `packets`, `fetchPackets()`, `createPacket({ name?, x, y, bitIds })`, `updatePacket(id, { name?, x?, y? })` (optimistic), `setBits(id, bitIds)`, `deletePacket(id)`; `useDependencyStore()` → `dependencies`, `fetchDependencies()`, `createDependency(from: NodeRef, to: NodeRef)`, `deleteDependency(id)`.

- [ ] **Step 1: Write the failing test** — `frontend/src/stores/flowStores.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}))
vi.mock('@/helpers/api', () => ({ default: api }))

import { useBitStore } from './bitStore'
import { usePacketStore } from './packetStore'
import { useDependencyStore } from './dependencyStore'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
})

describe('flow stores', () => {
  it('updateBit ändert lokal sofort und rollt bei Fehler zurück', async () => {
    const store = useBitStore()
    store.bits = [
      { id: 1, title: 'a', status: 0, x: 0, y: 0, packetId: null, order: 0, createdAt: '' },
    ]
    let reject!: (e: Error) => void
    api.put.mockReturnValue(new Promise((_, r) => (reject = r)))
    const pending = store.updateBit(1, { x: 50 })
    expect(store.bits[0]!.x).toBe(50)
    reject(new Error('offline'))
    await expect(pending).rejects.toThrow('offline')
    expect(store.bits[0]!.x).toBe(0)
  })

  it('createPacket rundet Koordinaten und speichert das Packet', async () => {
    const store = usePacketStore()
    api.post.mockResolvedValue({ data: { id: 7, name: 'Packet 1', x: 10, y: 20 } })
    await store.createPacket({ x: 10.4, y: 19.6, bitIds: [1, 2] })
    expect(api.post).toHaveBeenCalledWith('/api/packet', { x: 10, y: 20, bitIds: [1, 2] })
    expect(store.packets).toHaveLength(1)
  })

  it('createDependency sendet Typen/IDs und dupliziert nicht', async () => {
    const store = useDependencyStore()
    const dep = { id: 3, fromType: 'bit', fromId: 1, toType: 'packet', toId: 2 }
    api.post.mockResolvedValue({ data: dep })
    await store.createDependency({ type: 'bit', id: 1 }, { type: 'packet', id: 2 })
    await store.createDependency({ type: 'bit', id: 1 }, { type: 'packet', id: 2 })
    expect(api.post).toHaveBeenCalledWith('/api/dependency', {
      fromType: 'bit',
      fromId: 1,
      toType: 'packet',
      toId: 2,
    })
    expect(store.dependencies).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend; npx vitest run src/stores/flowStores.test.ts`
Expected: FAIL — cannot resolve `./packetStore`.

- [ ] **Step 3: Implement**

`frontend/src/types/flow.ts`:

```ts
export type NodeType = 'bit' | 'packet'

export interface NodeRef {
  type: NodeType
  id: number
}

export interface Packet {
  id: number
  name: string
  x: number
  y: number
}

/** "to" waits for "from". */
export interface Dependency {
  id: number
  fromType: NodeType
  fromId: number
  toType: NodeType
  toId: number
}

export type WorkflowState = 'blocked' | 'ready' | null

export interface PacketSummary {
  total: number
  done: number
  inProgress: number
  blocked: number
  ready: number
  cycles: number
  percent: number
}

export interface PacketCard extends PacketSummary {
  key: number
  name: string
  bitIds: number[]
}

export interface DependencyItem {
  id: number
  d: string
  mx: number
  my: number
  tx: number
  ty: number
  angle: number
  state: 'pending' | 'done' | 'cycle'
  dimmed: boolean
}
```

`frontend/src/stores/bitStore.ts` — add the two fields to `Bit` and replace `updateBit`:

```ts
export interface Bit {
  id: number
  title: string
  status: number
  x: number
  y: number
  packetId: number | null
  order: number
  priority?: number
  dueDate?: Date | string
  notes?: string
  workspace?: number
  createdAt: string
  color?: string
}
```

```ts
  // Optimistic: the canvas must not jump back while the request is in flight
  async function updateBit(
    id: number,
    updates: Partial<Omit<Bit, 'id' | 'createdAt' | 'order'>>,
  ): Promise<void> {
    const idx = bits.value.findIndex((b) => b.id === id)
    const before = idx !== -1 ? { ...bits.value[idx]! } : null
    if (idx !== -1) bits.value[idx] = { ...bits.value[idx]!, ...updates }
    try {
      await api.put(`/api/bit/${id}`, updates)
    } catch (e) {
      const at = bits.value.findIndex((b) => b.id === id)
      if (before && at !== -1) bits.value[at] = before
      throw e
    }
  }
```

`frontend/src/stores/packetStore.ts`:

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/helpers/api'
import type { Packet } from '@/types/flow'

export const usePacketStore = defineStore('packet', () => {
  const packets = ref<Packet[]>([])

  async function fetchPackets(): Promise<void> {
    const res = await api.get<Packet[]>('/api/packet')
    packets.value = res.data
  }

  async function createPacket(payload: {
    name?: string
    x: number
    y: number
    bitIds: number[]
  }): Promise<Packet> {
    const res = await api.post<Packet>('/api/packet', {
      ...payload,
      x: Math.round(payload.x),
      y: Math.round(payload.y),
    })
    packets.value.push(res.data)
    return res.data
  }

  async function updatePacket(
    id: number,
    updates: Partial<Pick<Packet, 'name' | 'x' | 'y'>>,
  ): Promise<void> {
    const body = { ...updates }
    if (body.x !== undefined) body.x = Math.round(body.x)
    if (body.y !== undefined) body.y = Math.round(body.y)
    const idx = packets.value.findIndex((p) => p.id === id)
    const before = idx !== -1 ? { ...packets.value[idx]! } : null
    if (idx !== -1) packets.value[idx] = { ...packets.value[idx]!, ...body }
    try {
      await api.put(`/api/packet/${id}`, body)
    } catch (e) {
      const at = packets.value.findIndex((p) => p.id === id)
      if (before && at !== -1) packets.value[at] = before
      throw e
    }
  }

  async function setBits(id: number, bitIds: number[]): Promise<void> {
    await api.put(`/api/packet/${id}/bits`, { bitIds })
  }

  async function deletePacket(id: number): Promise<void> {
    await api.delete(`/api/packet/${id}`)
    packets.value = packets.value.filter((p) => p.id !== id)
  }

  return { packets, fetchPackets, createPacket, updatePacket, setBits, deletePacket }
})
```

`frontend/src/stores/dependencyStore.ts`:

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/helpers/api'
import type { Dependency, NodeRef } from '@/types/flow'

export const useDependencyStore = defineStore('dependency', () => {
  const dependencies = ref<Dependency[]>([])

  async function fetchDependencies(): Promise<void> {
    const res = await api.get<Dependency[]>('/api/dependency')
    dependencies.value = res.data
  }

  async function createDependency(from: NodeRef, to: NodeRef): Promise<Dependency> {
    const res = await api.post<Dependency>('/api/dependency', {
      fromType: from.type,
      fromId: from.id,
      toType: to.type,
      toId: to.id,
    })
    if (!dependencies.value.some((d) => d.id === res.data.id)) dependencies.value.push(res.data)
    return res.data
  }

  async function deleteDependency(id: number): Promise<void> {
    await api.delete(`/api/dependency/${id}`)
    dependencies.value = dependencies.value.filter((d) => d.id !== id)
  }

  return { dependencies, fetchDependencies, createDependency, deleteDependency }
})
```

Delete `frontend/src/stores/connectionStore.ts`.

- [ ] **Step 4: Run the test**

Run: `cd frontend; npx vitest run src/stores/flowStores.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A frontend/src/types frontend/src/stores
git commit -m "feat(frontend): add packet and dependency stores" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `useFlowLayout` and `useFlowState`

**Files:**
- Create: `frontend/src/composables/useFlowLayout.ts`, `frontend/src/composables/useFlowState.ts`
- Test: `frontend/src/composables/useFlowLayout.test.ts`, `frontend/src/composables/useFlowState.test.ts`

**Interfaces:**
- Consumes: `Bit` (Task 5), types from `@/types/flow`.
- Produces (layout): constants `CAPSULE_W=200, CAPSULE_H=32, CAPSULE_EXPANDED_EXTRA=20, STEP_GAP=4, STACK_PAD=8, STACK_HEADER_H=40, STEP_NUM_W=20, STACK_W=236, INSERT_GAP=36, STEP_PITCH=36`; `interface Rect { x; y; w; h }`; `interface FlowLayout { bitRects: Map<number, Rect>; packetRects: Map<number, Rect>; membersOf: Map<number, Bit[]>; looseBitIds: number[] }`; `capsuleHeight(expanded: boolean): number`; `stackGeometry(count, expandedIndex: number | null, gapIndex: number | null): { offsets: number[]; gapY: number | null; height: number }`; `computeLayout({ bits, packets, expandedBitId }): FlowLayout`; `anchor(layout, ref: NodeRef, end: 'out' | 'in'): { x; y } | null`; `dependencyGeometry(from, to): { d; mx; my; tx; ty; angle }`; `unionRect(rects: Rect[]): Rect | null`.
- Produces (state): `interface FlowState { bitState: Map<number, WorkflowState>; cycleDependencyIds: Set<number>; cycleBitIds: Set<number>; packetSummary: Map<number, PacketSummary>; sourceDone(dep: Dependency): boolean }`; `computeFlowState(bits, packets, deps): FlowState`; `isValidLink(from: NodeRef, to: NodeRef, bits: Bit[], deps: Dependency[]): boolean`.

- [ ] **Step 1: Write the failing tests**

`frontend/src/composables/useFlowLayout.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { Bit } from '@/stores/bitStore'
import {
  anchor,
  computeLayout,
  dependencyGeometry,
  stackGeometry,
  unionRect,
  STACK_W,
} from './useFlowLayout'

const bit = (id: number, packetId: number | null = null, order = 0, x = 0, y = 0): Bit => ({
  id,
  title: `B${id}`,
  status: 0,
  x,
  y,
  packetId,
  order,
  createdAt: '',
})

describe('stackGeometry', () => {
  it('stapelt Schritte unter dem Kopf', () => {
    expect(stackGeometry(3, null, null)).toEqual({ offsets: [40, 76, 112], gapY: null, height: 152 })
  })
  it('schiebt Folgeschritte unter einer aufgeklappten Kapsel nach unten', () => {
    expect(stackGeometry(3, 0, null).offsets).toEqual([40, 96, 132])
  })
  it('öffnet eine Lücke an der Einfügeposition', () => {
    const g = stackGeometry(3, null, 1)
    expect(g.offsets).toEqual([40, 112, 148])
    expect(g.gapY).toBe(92)
    expect(g.height).toBe(188)
    expect(stackGeometry(2, null, 2).gapY).toBe(76 + 32 + 4 + 16)
  })
})

describe('computeLayout', () => {
  const bits = [bit(1, 7, 1), bit(2, 7, 0), bit(3, null, 0, 10, 20), bit(4, 99, 0, 5, 6)]
  const layout = computeLayout({
    bits,
    packets: [{ id: 7, name: 'P', x: 100, y: 100 }],
    expandedBitId: null,
  })

  it('ordnet Stapel-Mitglieder nach order und positioniert sie im Stapel', () => {
    expect(layout.membersOf.get(7)!.map((b) => b.id)).toEqual([2, 1])
    expect(layout.bitRects.get(2)).toEqual({ x: 128, y: 140, w: 200, h: 32 })
    expect(layout.packetRects.get(7)).toEqual({ x: 100, y: 100, w: STACK_W, h: 116 })
  })

  it('behandelt Bits ohne existierendes Packet als lose', () => {
    expect(layout.looseBitIds).toEqual([3, 4])
    expect(layout.bitRects.get(4)).toEqual({ x: 5, y: 6, w: 200, h: 32 })
  })

  it('liefert Anker an rechter/linker Kante', () => {
    expect(anchor(layout, { type: 'bit', id: 3 }, 'out')).toEqual({ x: 210, y: 36 })
    expect(anchor(layout, { type: 'bit', id: 3 }, 'in')).toEqual({ x: 10, y: 36 })
    expect(anchor(layout, { type: 'packet', id: 7 }, 'out')).toEqual({ x: 336, y: 120 })
    expect(anchor(layout, { type: 'packet', id: 7 }, 'in')).toEqual({ x: 100, y: 120 })
    expect(anchor(layout, { type: 'bit', id: 404 }, 'in')).toBeNull()
  })

  it('vereinigt Rechtecke', () => {
    expect(unionRect([...layout.bitRects.values()])).toEqual({ x: 5, y: 6, w: 323, h: 202 })
    expect(unionRect([])).toBeNull()
  })
})

describe('dependencyGeometry', () => {
  it('zeichnet eine horizontale Bézier mit Mittelpunkt', () => {
    const g = dependencyGeometry({ x: 0, y: 0 }, { x: 200, y: 0 })
    expect(g.d).toBe('M 0 0 C 100 0 100 0 200 0')
    expect(g.mx).toBe(100)
    expect(g.angle).toBe(0)
  })
})
```

`frontend/src/composables/useFlowState.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { Bit } from '@/stores/bitStore'
import type { Dependency, Packet } from '@/types/flow'
import { computeFlowState, isValidLink } from './useFlowState'

const bit = (id: number, status = 0, packetId: number | null = null, order = 0): Bit => ({
  id,
  title: `B${id}`,
  status,
  x: 0,
  y: 0,
  packetId,
  order,
  createdAt: '',
})
const packet = (id: number): Packet => ({ id, name: `P${id}`, x: 0, y: 0 })
let nextId = 1
const dep = (fromType: 'bit' | 'packet', fromId: number, toType: 'bit' | 'packet', toId: number): Dependency => ({
  id: nextId++,
  fromType,
  fromId,
  toType,
  toId,
})

describe('computeFlowState', () => {
  it('Stapel: erster Schritt neutral, Nachfolger ready/blocked', () => {
    const s = computeFlowState([bit(1, 2, 1, 0), bit(2, 0, 1, 1), bit(3, 0, 1, 2)], [packet(1)], [])
    expect(s.bitState.get(1)).toBeNull()
    expect(s.bitState.get(2)).toBe('ready')
    expect(s.bitState.get(3)).toBe('blocked')
  })

  it('erster offener Schritt ohne Abhängigkeiten ist neutral', () => {
    const s = computeFlowState([bit(1, 0, 1, 0), bit(2, 0, 1, 1)], [packet(1)], [])
    expect(s.bitState.get(1)).toBeNull()
  })

  it('Packet → Packet: Tor öffnet erst, wenn alle Schritte der Quelle fertig sind', () => {
    const bits = [bit(1, 2, 1, 0), bit(2, 0, 1, 1), bit(3, 0, 2, 0), bit(4, 0, 2, 1)]
    const deps = [dep('packet', 1, 'packet', 2)]
    let s = computeFlowState(bits, [packet(1), packet(2)], deps)
    expect(s.bitState.get(3)).toBe('blocked')
    expect(s.bitState.get(4)).toBe('blocked')
    bits[1] = bit(2, 2, 1, 1)
    s = computeFlowState(bits, [packet(1), packet(2)], deps)
    expect(s.bitState.get(3)).toBe('ready')
  })

  it('Bit → Packet und Packet → Bit', () => {
    const bits = [bit(1, 0, 1, 0), bit(2, 0, 1, 1), bit(5, 0), bit(6, 0)]
    const deps = [dep('bit', 5, 'packet', 1), dep('packet', 1, 'bit', 6)]
    const s = computeFlowState(bits, [packet(1)], deps)
    expect(s.bitState.get(1)).toBe('blocked')
    expect(s.bitState.get(6)).toBe('blocked')
    expect(s.bitState.get(5)).toBeNull()
    const done = computeFlowState([bits[0]!, bits[1]!, bit(5, 2), bits[3]!], [packet(1)], deps)
    expect(done.bitState.get(1)).toBe('ready')
  })

  it('Bit → Bit zwischen losen Kapseln', () => {
    const s = computeFlowState([bit(7, 1), bit(8, 0)], [], [dep('bit', 7, 'bit', 8)])
    expect(s.bitState.get(8)).toBe('blocked')
  })

  it('erkennt Zyklen über Stapel und Pfeile', () => {
    const a = dep('bit', 2, 'bit', 9)
    const b = dep('bit', 9, 'packet', 1)
    const c = dep('bit', 1, 'bit', 10)
    const s = computeFlowState(
      [bit(1, 0, 1, 0), bit(2, 0, 1, 1), bit(9), bit(10)],
      [packet(1)],
      [a, b, c],
    )
    expect([...s.cycleDependencyIds].sort()).toEqual([a.id, b.id].sort())
    expect([...s.cycleBitIds].sort()).toEqual([1, 2, 9])
    expect(s.packetSummary.get(1)!.cycles).toBe(2)
  })

  it('fasst Packets zusammen', () => {
    const s = computeFlowState([bit(1, 2, 1, 0), bit(2, 1, 1, 1), bit(3, 0, 1, 2)], [packet(1)], [])
    expect(s.packetSummary.get(1)).toEqual({
      total: 3,
      done: 1,
      inProgress: 1,
      blocked: 1,
      ready: 1,
      cycles: 0,
      percent: 33,
    })
  })

  it('sourceDone prüft Bit- und Packet-Quellen', () => {
    const d1 = dep('bit', 1, 'bit', 3)
    const d2 = dep('packet', 1, 'bit', 3)
    const s = computeFlowState([bit(1, 2, 1, 0), bit(2, 0, 1, 1), bit(3)], [packet(1)], [d1, d2])
    expect(s.sourceDone(d1)).toBe(true)
    expect(s.sourceDone(d2)).toBe(false)
  })
})

describe('isValidLink', () => {
  const bits = [bit(1, 0, 1, 0), bit(2, 0, 1, 1), bit(3)]
  const existing = [dep('bit', 3, 'bit', 1)]
  it.each([
    [{ type: 'bit', id: 3 }, { type: 'bit', id: 3 }, false],
    [{ type: 'bit', id: 1 }, { type: 'packet', id: 1 }, false],
    [{ type: 'packet', id: 1 }, { type: 'bit', id: 2 }, false],
    [{ type: 'bit', id: 3 }, { type: 'bit', id: 1 }, false],
    [{ type: 'bit', id: 3 }, { type: 'packet', id: 1 }, true],
    [{ type: 'bit', id: 1 }, { type: 'bit', id: 3 }, true],
  ] as const)('%o → %o = %s', (from, to, expected) => {
    expect(isValidLink(from, to, bits, existing)).toBe(expected)
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd frontend; npx vitest run src/composables/useFlowLayout.test.ts src/composables/useFlowState.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`frontend/src/composables/useFlowLayout.ts`:

```ts
import type { Bit } from '@/stores/bitStore'
import type { NodeRef, Packet } from '@/types/flow'

export const CAPSULE_W = 200
export const CAPSULE_H = 32
export const CAPSULE_EXPANDED_EXTRA = 20
export const STEP_GAP = 4
export const STACK_PAD = 8
export const STACK_HEADER_H = 40
export const STEP_NUM_W = 20
export const STACK_W = STACK_PAD * 2 + STEP_NUM_W + CAPSULE_W
export const STEP_PITCH = CAPSULE_H + STEP_GAP
/** Space opened between steps while a capsule hovers over a stack. */
export const INSERT_GAP = STEP_PITCH

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface FlowLayout {
  bitRects: Map<number, Rect>
  packetRects: Map<number, Rect>
  /** Members of each existing packet, in step order. */
  membersOf: Map<number, Bit[]>
  looseBitIds: number[]
}

export function capsuleHeight(expanded: boolean): number {
  return CAPSULE_H + (expanded ? CAPSULE_EXPANDED_EXTRA : 0)
}

/** Vertical layout inside a stack, relative to its top edge. */
export function stackGeometry(
  count: number,
  expandedIndex: number | null,
  gapIndex: number | null,
): { offsets: number[]; gapY: number | null; height: number } {
  const offsets: number[] = []
  let gapY: number | null = null
  let y = STACK_HEADER_H
  for (let i = 0; i < count; i++) {
    if (gapIndex === i) {
      gapY = y + (INSERT_GAP - STEP_GAP) / 2
      y += INSERT_GAP
    }
    offsets.push(y)
    y += capsuleHeight(i === expandedIndex) + STEP_GAP
  }
  if (gapIndex !== null && gapIndex >= count) {
    gapY = y + (INSERT_GAP - STEP_GAP) / 2
    y += INSERT_GAP
  }
  const height = count === 0 && gapIndex === null ? STACK_HEADER_H + STACK_PAD : y - STEP_GAP + STACK_PAD
  return { offsets, gapY, height }
}

export function computeLayout(input: {
  bits: Bit[]
  packets: Packet[]
  expandedBitId: number | null
}): FlowLayout {
  const packetIds = new Set(input.packets.map((p) => p.id))
  const membersOf = new Map<number, Bit[]>()
  const looseBitIds: number[] = []
  for (const bit of input.bits) {
    if (bit.packetId != null && packetIds.has(bit.packetId)) {
      const list = membersOf.get(bit.packetId) ?? []
      list.push(bit)
      membersOf.set(bit.packetId, list)
    } else {
      looseBitIds.push(bit.id)
    }
  }
  for (const list of membersOf.values()) list.sort((a, b) => a.order - b.order || a.id - b.id)

  const bitRects = new Map<number, Rect>()
  const packetRects = new Map<number, Rect>()

  for (const packet of input.packets) {
    const members = membersOf.get(packet.id)
    if (!members) continue
    const expandedIndex = members.findIndex((b) => b.id === input.expandedBitId)
    const geo = stackGeometry(members.length, expandedIndex === -1 ? null : expandedIndex, null)
    packetRects.set(packet.id, { x: packet.x, y: packet.y, w: STACK_W, h: geo.height })
    members.forEach((bit, i) => {
      bitRects.set(bit.id, {
        x: packet.x + STACK_PAD + STEP_NUM_W,
        y: packet.y + geo.offsets[i]!,
        w: CAPSULE_W,
        h: capsuleHeight(bit.id === input.expandedBitId),
      })
    })
  }

  for (const bit of input.bits) {
    if (bitRects.has(bit.id)) continue
    bitRects.set(bit.id, {
      x: bit.x ?? 0,
      y: bit.y ?? 0,
      w: CAPSULE_W,
      h: capsuleHeight(bit.id === input.expandedBitId),
    })
  }

  return { bitRects, packetRects, membersOf, looseBitIds }
}

/** Arrow attachment point: right edge for "out", left edge for "in". */
export function anchor(
  layout: FlowLayout,
  ref: NodeRef,
  end: 'out' | 'in',
): { x: number; y: number } | null {
  const rect = ref.type === 'bit' ? layout.bitRects.get(ref.id) : layout.packetRects.get(ref.id)
  if (!rect) return null
  // bits attach at the middle of the (collapsed) capsule row, packets at the header row
  const y = ref.type === 'bit' ? rect.y + CAPSULE_H / 2 : rect.y + 20
  return { x: end === 'out' ? rect.x + rect.w : rect.x, y }
}

export function dependencyGeometry(
  from: { x: number; y: number },
  to: { x: number; y: number },
): { d: string; mx: number; my: number; tx: number; ty: number; angle: number } {
  const dx = Math.max(40, Math.abs(to.x - from.x) / 2)
  const c1 = { x: from.x + dx, y: from.y }
  const c2 = { x: to.x - dx, y: to.y }
  // cubic Bézier at t = 0.5
  const mx = 0.125 * from.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * to.x
  const my = 0.125 * from.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * to.y
  const angle = (Math.atan2(to.y - c2.y, to.x - c2.x) * 180) / Math.PI
  return {
    d: `M ${from.x} ${from.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${to.x} ${to.y}`,
    mx,
    my,
    tx: to.x,
    ty: to.y,
    angle,
  }
}

export function unionRect(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null
  const minX = Math.min(...rects.map((r) => r.x))
  const minY = Math.min(...rects.map((r) => r.y))
  const maxX = Math.max(...rects.map((r) => r.x + r.w))
  const maxY = Math.max(...rects.map((r) => r.y + r.h))
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}
```

`frontend/src/composables/useFlowState.ts`:

```ts
import type { Bit } from '@/stores/bitStore'
import type { Dependency, NodeRef, Packet, PacketSummary, WorkflowState } from '@/types/flow'

export interface FlowState {
  bitState: Map<number, WorkflowState>
  cycleDependencyIds: Set<number>
  cycleBitIds: Set<number>
  packetSummary: Map<number, PacketSummary>
  sourceDone(dep: Dependency): boolean
}

// Graph nodes: "b:<id>" bit, "pi:<id>" packet gate (opens the first step), "po:<id>" packet done
const bitKey = (id: number) => `b:${id}`
const gateKey = (id: number) => `pi:${id}`
const doneKey = (id: number) => `po:${id}`
const sourceKey = (dep: Dependency) => (dep.fromType === 'bit' ? bitKey(dep.fromId) : doneKey(dep.fromId))
const targetKey = (dep: Dependency) => (dep.toType === 'bit' ? bitKey(dep.toId) : gateKey(dep.toId))

interface Edge {
  from: string
  to: string
  depId?: number
}

export function computeFlowState(bits: Bit[], packets: Packet[], deps: Dependency[]): FlowState {
  const packetIds = new Set(packets.map((p) => p.id))
  const members = new Map<number, Bit[]>()
  for (const bit of bits) {
    if (bit.packetId == null || !packetIds.has(bit.packetId)) continue
    const list = members.get(bit.packetId) ?? []
    list.push(bit)
    members.set(bit.packetId, list)
  }
  for (const list of members.values()) list.sort((a, b) => a.order - b.order || a.id - b.id)

  const bitIds = new Set(bits.map((b) => b.id))
  const liveDeps = deps.filter(
    (d) =>
      (d.fromType === 'bit' ? bitIds.has(d.fromId) : members.has(d.fromId)) &&
      (d.toType === 'bit' ? bitIds.has(d.toId) : members.has(d.toId)),
  )

  const edges: Edge[] = []
  for (const [packetId, list] of members) {
    edges.push({ from: gateKey(packetId), to: bitKey(list[0]!.id) })
    list.forEach((bit, i) => {
      if (i > 0) edges.push({ from: bitKey(list[i - 1]!.id), to: bitKey(bit.id) })
      edges.push({ from: bitKey(bit.id), to: doneKey(packetId) })
    })
  }
  for (const dep of liveDeps) edges.push({ from: sourceKey(dep), to: targetKey(dep), depId: dep.id })

  const incoming = new Map<string, string[]>()
  for (const e of edges) incoming.set(e.to, [...(incoming.get(e.to) ?? []), e.from])

  const statusOf = new Map(bits.map((b) => [b.id, b.status]))
  // done() never recurses through a gate twice: gate predecessors are bits or packet-done nodes,
  // and those only look at bit statuses — so cycles in the graph cannot loop here.
  function done(key: string): boolean {
    const [kind, raw] = key.split(':') as [string, string]
    const id = Number(raw)
    if (kind === 'b') return statusOf.get(id) === 2
    if (kind === 'po') return (members.get(id) ?? []).every((b) => b.status === 2)
    return (incoming.get(key) ?? []).every((k) => done(k))
  }

  const bitState = new Map<number, WorkflowState>()
  for (const bit of bits) {
    const prereqs = (incoming.get(bitKey(bit.id)) ?? []).filter(
      // an ungated packet gate is not a real prerequisite
      (k) => !k.startsWith('pi:') || (incoming.get(k) ?? []).length > 0,
    )
    if (bit.status === 2 || prereqs.length === 0) bitState.set(bit.id, null)
    else bitState.set(bit.id, prereqs.every((k) => done(k)) ? 'ready' : 'blocked')
  }

  const cyclic = cyclicNodes(edges)
  const cycleDependencyIds = new Set(
    edges.filter((e) => e.depId !== undefined && cyclic.has(e.from) && cyclic.has(e.to) && sameComponent(cyclic, e))
      .map((e) => e.depId!),
  )
  const cycleBitIds = new Set(bits.filter((b) => cyclic.has(bitKey(b.id))).map((b) => b.id))

  const packetSummary = new Map<number, PacketSummary>()
  for (const [packetId, list] of members) {
    const total = list.length
    const doneCount = list.filter((b) => b.status === 2).length
    const ids = new Set(list.map((b) => b.id))
    const touches = (type: 'bit' | 'packet', id: number) =>
      type === 'packet' ? id === packetId : ids.has(id)
    packetSummary.set(packetId, {
      total,
      done: doneCount,
      inProgress: list.filter((b) => b.status === 1).length,
      blocked: list.filter((b) => bitState.get(b.id) === 'blocked').length,
      ready: list.filter((b) => bitState.get(b.id) === 'ready').length,
      cycles: liveDeps.filter(
        (d) => cycleDependencyIds.has(d.id) && (touches(d.fromType, d.fromId) || touches(d.toType, d.toId)),
      ).length,
      percent: total ? Math.round((doneCount / total) * 100) : 0,
    })
  }

  return {
    bitState,
    cycleDependencyIds,
    cycleBitIds,
    packetSummary,
    sourceDone: (dep) => done(sourceKey(dep)),
  }
}

/** Tarjan SCC: maps every node that sits on a cycle to its component id. */
function cyclicNodes(edges: Edge[]): Map<string, number> {
  const adj = new Map<string, string[]>()
  for (const e of edges) adj.set(e.from, [...(adj.get(e.from) ?? []), e.to])
  const nodes = new Set(edges.flatMap((e) => [e.from, e.to]))

  let index = 0
  let component = 0
  const idx = new Map<string, number>()
  const low = new Map<string, number>()
  const onStack = new Set<string>()
  const stack: string[] = []
  const result = new Map<string, number>()

  function strongConnect(v: string) {
    idx.set(v, index)
    low.set(v, index)
    index++
    stack.push(v)
    onStack.add(v)
    for (const w of adj.get(v) ?? []) {
      if (!idx.has(w)) {
        strongConnect(w)
        low.set(v, Math.min(low.get(v)!, low.get(w)!))
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v)!, idx.get(w)!))
      }
    }
    if (low.get(v) === idx.get(v)) {
      const scc: string[] = []
      let w: string
      do {
        w = stack.pop()!
        onStack.delete(w)
        scc.push(w)
      } while (w !== v)
      const selfLoop = scc.length === 1 && (adj.get(v) ?? []).includes(v)
      if (scc.length > 1 || selfLoop) {
        for (const n of scc) result.set(n, component)
        component++
      }
    }
  }

  for (const n of nodes) if (!idx.has(n)) strongConnect(n)
  return result
}

function sameComponent(cyclic: Map<string, number>, e: Edge): boolean {
  return cyclic.get(e.from) === cyclic.get(e.to)
}

/** Client-side mirror of the server rules, so invalid arrows never hit the API. */
export function isValidLink(from: NodeRef, to: NodeRef, bits: Bit[], deps: Dependency[]): boolean {
  if (from.type === to.type && from.id === to.id) return false
  const packetOf = (id: number) => bits.find((b) => b.id === id)?.packetId ?? null
  if (from.type === 'bit' && to.type === 'packet' && packetOf(from.id) === to.id) return false
  if (from.type === 'packet' && to.type === 'bit' && packetOf(to.id) === from.id) return false
  return !deps.some(
    (d) => d.fromType === from.type && d.fromId === from.id && d.toType === to.type && d.toId === to.id,
  )
}
```

- [ ] **Step 4: Run the tests**

Run: `cd frontend; npx vitest run src/composables/useFlowLayout.test.ts src/composables/useFlowState.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/composables/useFlowLayout.ts frontend/src/composables/useFlowLayout.test.ts frontend/src/composables/useFlowState.ts frontend/src/composables/useFlowState.test.ts
git commit -m "feat(frontend): add flow layout and workflow state logic" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `useStackDrag` (snap target and insert index)

**Files:**
- Create: `frontend/src/composables/useStackDrag.ts`
- Test: `frontend/src/composables/useStackDrag.test.ts`

**Interfaces:**
- Consumes: `FlowLayout`, constants from `useFlowLayout` (Task 6).
- Produces: `type SnapTarget = { kind: 'stack'; packetId: number; index: number } | { kind: 'pair'; bitId: number; position: 'above' | 'below' }`; `STACK_SNAP_MARGIN = 16`; `PAIR_SNAP_DISTANCE = 24`; `insertIndex(pointerY: number, stackTop: number, count: number): number`; `findSnapTarget(probe: { x; y }, draggedBitId: number, layout: FlowLayout): SnapTarget | null` (probe = centre of the dragged capsule).

- [ ] **Step 1: Write the failing test** — `frontend/src/composables/useStackDrag.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { Bit } from '@/stores/bitStore'
import { computeLayout } from './useFlowLayout'
import { findSnapTarget, insertIndex } from './useStackDrag'

const bit = (id: number, packetId: number | null = null, order = 0, x = 0, y = 0): Bit => ({
  id,
  title: `B${id}`,
  status: 0,
  x,
  y,
  packetId,
  order,
  createdAt: '',
})

// Stack at (100,100): rows at y 140 / 176 / 212. Loose bit 4 at (600,100).
const layout = computeLayout({
  bits: [bit(1, 7, 0), bit(2, 7, 1), bit(3, 7, 2), bit(4, null, 0, 600, 100), bit(5, null, 0, 900, 900)],
  packets: [{ id: 7, name: 'P', x: 100, y: 100 }],
  expandedBitId: null,
})

describe('insertIndex', () => {
  it('teilt jede Zeile in obere/untere Hälfte', () => {
    expect(insertIndex(100 + 40 + 8, 100, 3)).toBe(0)
    expect(insertIndex(100 + 40 + 24, 100, 3)).toBe(1)
    expect(insertIndex(100 + 40 + 36 * 2 + 30, 100, 3)).toBe(3)
    expect(insertIndex(0, 100, 3)).toBe(0)
    expect(insertIndex(9999, 100, 3)).toBe(3)
  })
})

describe('findSnapTarget', () => {
  it('über einem Stapel → Einfügen an Pointer-Höhe', () => {
    expect(findSnapTarget({ x: 200, y: 182 }, 5, layout)).toEqual({ kind: 'stack', packetId: 7, index: 1 })
  })

  it('zählt das gezogene Bit beim Umsortieren im eigenen Stapel nicht mit', () => {
    // dragging bit 1 out of its own stack to the very bottom: only 2 remain → index 2
    expect(findSnapTarget({ x: 200, y: 260 }, 1, layout)).toEqual({ kind: 'stack', packetId: 7, index: 2 })
  })

  it('knapp unter einer losen Kapsel → neues Packet darunter', () => {
    expect(findSnapTarget({ x: 700, y: 100 + 32 + 20 }, 5, layout)).toEqual({
      kind: 'pair',
      bitId: 4,
      position: 'below',
    })
  })

  it('knapp über einer losen Kapsel → neues Packet darüber', () => {
    expect(findSnapTarget({ x: 700, y: 100 - 20 }, 5, layout)).toEqual({
      kind: 'pair',
      bitId: 4,
      position: 'above',
    })
  })

  it('weit weg → kein Ziel; sich selbst ignorieren', () => {
    expect(findSnapTarget({ x: 2000, y: 2000 }, 5, layout)).toBeNull()
    expect(findSnapTarget({ x: 1000, y: 916 }, 5, layout)).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend; npx vitest run src/composables/useStackDrag.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `frontend/src/composables/useStackDrag.ts`:

```ts
import { CAPSULE_H, STACK_HEADER_H, STEP_PITCH, type FlowLayout } from './useFlowLayout'

export type SnapTarget =
  | { kind: 'stack'; packetId: number; index: number }
  | { kind: 'pair'; bitId: number; position: 'above' | 'below' }

export const STACK_SNAP_MARGIN = 16
export const PAIR_SNAP_DISTANCE = 24

/** Index to insert before: upper half of row i → i, lower half → i + 1. */
export function insertIndex(pointerY: number, stackTop: number, count: number): number {
  const rel = pointerY - (stackTop + STACK_HEADER_H)
  const index = Math.floor((rel + STEP_PITCH / 2) / STEP_PITCH)
  return Math.max(0, Math.min(count, index))
}

export function findSnapTarget(
  probe: { x: number; y: number },
  draggedBitId: number,
  layout: FlowLayout,
): SnapTarget | null {
  for (const [packetId, rect] of layout.packetRects) {
    const m = STACK_SNAP_MARGIN
    const inside =
      probe.x >= rect.x - m &&
      probe.x <= rect.x + rect.w + m &&
      probe.y >= rect.y - m &&
      probe.y <= rect.y + rect.h + m
    if (!inside) continue
    const count = (layout.membersOf.get(packetId) ?? []).filter((b) => b.id !== draggedBitId).length
    return { kind: 'stack', packetId, index: insertIndex(probe.y, rect.y, count) }
  }

  let best: { target: SnapTarget; distance: number } | null = null
  for (const bitId of layout.looseBitIds) {
    if (bitId === draggedBitId) continue
    const r = layout.bitRects.get(bitId)
    if (!r) continue
    if (probe.x < r.x - STACK_SNAP_MARGIN || probe.x > r.x + r.w + STACK_SNAP_MARGIN) continue
    const centerY = r.y + CAPSULE_H / 2
    const reach = PAIR_SNAP_DISTANCE + CAPSULE_H
    const distance = Math.abs(probe.y - centerY)
    if (distance > reach) continue
    const position = probe.y >= centerY ? 'below' : 'above'
    if (!best || distance < best.distance) best = { target: { kind: 'pair', bitId, position }, distance }
  }
  return best?.target ?? null
}
```

- [ ] **Step 4: Run the test**

Run: `cd frontend; npx vitest run src/composables/useStackDrag.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/composables/useStackDrag.ts frontend/src/composables/useStackDrag.test.ts
git commit -m "feat(frontend): add stack snap detection" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Presentational components (capsule, stack, arrows)

**Files:**
- Create: `frontend/src/components/LBitCapsule.vue`, `frontend/src/components/LPacketStack.vue`, `frontend/src/components/LDependencyLayer.vue`
- Test: `frontend/src/components/flowComponents.test.ts`

**Interfaces:**
- Consumes: `Bit`, `Packet`, `NodeRef`, `WorkflowState`, `PacketSummary`, `DependencyItem`, `stackGeometry`, layout constants.
- Produces:
  - `LBitCapsule` props `{ bit: Bit; state: WorkflowState; expanded: boolean; inCycle?: boolean; lifted?: boolean; dimmed?: boolean; snapHint?: 'above' | 'below' | null }`; emits `pointerdown: [e: PointerEvent]`, `open: []`, `linkstart: [e: PointerEvent]`. Root has `data-node-type="bit"` and `data-node-id`.
  - `LPacketStack` props `{ packet: Packet; members: Bit[]; x: number; y: number; states: Map<number, WorkflowState>; cycleBitIds: Set<number>; summary: PacketSummary; expandedBitId: number | null; gapIndex: number | null; highlighted?: boolean; dimmed?: boolean; dragging?: boolean }`; emits `headerPointerdown: [e: PointerEvent]`, `bitPointerdown: [e: PointerEvent, bitId: number]`, `bitOpen: [bitId: number]`, `linkstart: [e: PointerEvent, from: NodeRef]`, `rename: [name: string]`. Root has `data-node-type="packet"`.
  - `LDependencyLayer` props `{ items: DependencyItem[]; preview: string | null; selectedId: number | null }`; emits `select: [id: number]`, `remove: [id: number]`.

- [ ] **Step 1: Write the failing test** — `frontend/src/components/flowComponents.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Bit } from '@/stores/bitStore'
import LBitCapsule from './LBitCapsule.vue'
import LPacketStack from './LPacketStack.vue'
import LDependencyLayer from './LDependencyLayer.vue'

const bit = (id: number, status = 0, order = 0): Bit => ({
  id,
  title: `Task ${id}`,
  status,
  x: 0,
  y: 0,
  packetId: 7,
  order,
  createdAt: '',
  priority: 3,
})

describe('LBitCapsule', () => {
  it('zeigt Titel, markiert blocked und öffnet per Doppelklick', async () => {
    const w = mount(LBitCapsule, { props: { bit: bit(1), state: 'blocked', expanded: false } })
    expect(w.text()).toContain('Task 1')
    expect(w.attributes('data-node-type')).toBe('bit')
    expect(w.attributes('data-node-id')).toBe('1')
    expect(w.classes()).toContain('capsule--blocked')
    await w.trigger('dblclick')
    expect(w.emitted('open')).toHaveLength(1)
  })

  it('zeigt Details nur aufgeklappt', () => {
    const closed = mount(LBitCapsule, { props: { bit: bit(1), state: null, expanded: false } })
    const open = mount(LBitCapsule, { props: { bit: bit(1), state: null, expanded: true } })
    expect(closed.find('.capsule__meta-wrap').classes()).not.toContain('capsule__meta-wrap--open')
    expect(open.find('.capsule__meta-wrap').classes()).toContain('capsule__meta-wrap--open')
    expect(open.text()).toContain('High')
  })
})

describe('LPacketStack', () => {
  const props = {
    packet: { id: 7, name: 'Release', x: 0, y: 0 },
    members: [bit(1, 2, 0), bit(2, 0, 1)],
    x: 10,
    y: 20,
    states: new Map(),
    cycleBitIds: new Set<number>(),
    summary: { total: 2, done: 1, inProgress: 0, blocked: 0, ready: 1, cycles: 0, percent: 50 },
    expandedBitId: null,
    gapIndex: null,
  }

  it('zeigt Name, Fortschritt und nummerierte Schritte', () => {
    const w = mount(LPacketStack, { props })
    expect(w.text()).toContain('Release')
    expect(w.text()).toContain('1 / 2')
    expect(w.findAll('.stack__num').map((n) => n.text())).toEqual(['1', '2'])
    expect(w.attributes('data-node-type')).toBe('packet')
  })

  it('benennt per Doppelklick um', async () => {
    const w = mount(LPacketStack, { props })
    await w.find('.stack__name').trigger('dblclick')
    const input = w.find('input')
    await input.setValue('Launch')
    await input.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('rename')).toEqual([['Launch']])
  })
})

describe('LDependencyLayer', () => {
  it('wählt aus und löscht über den ✕-Knopf', async () => {
    const item = { id: 4, d: 'M 0 0 C 50 0 50 0 100 0', mx: 50, my: 0, tx: 100, ty: 0, angle: 0, state: 'pending' as const, dimmed: false }
    const w = mount(LDependencyLayer, { props: { items: [item], preview: null, selectedId: null } })
    await w.find('.dep__hit').trigger('click')
    expect(w.emitted('select')).toEqual([[4]])
    await w.setProps({ selectedId: 4 })
    await w.find('.dep__delete').trigger('click')
    expect(w.emitted('remove')).toEqual([[4]])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend; npx vitest run src/components/flowComponents.test.ts`
Expected: FAIL — components not found.

- [ ] **Step 3: Implement**

`frontend/src/components/LBitCapsule.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { Check, Lock } from 'lucide-vue-next'
import type { Bit } from '@/stores/bitStore'
import type { WorkflowState } from '@/types/flow'

const props = defineProps<{
  bit: Bit
  state: WorkflowState
  expanded: boolean
  inCycle?: boolean
  lifted?: boolean
  dimmed?: boolean
  snapHint?: 'above' | 'below' | null
}>()

const emit = defineEmits<{
  pointerdown: [e: PointerEvent]
  open: []
  linkstart: [e: PointerEvent]
}>()

const PRIORITY_LABEL: Record<number, string> = { 1: 'Low', 2: 'Medium', 3: 'High' }

const color = computed(() => props.bit.color ?? '#6366f1')

const meta = computed(() => {
  const parts: string[] = []
  if (props.bit.dueDate) {
    parts.push(
      new Date(props.bit.dueDate).toLocaleDateString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'numeric',
      }),
    )
  }
  if (props.bit.priority) parts.push(PRIORITY_LABEL[props.bit.priority] ?? '')
  const lines = props.bit.notes?.split('\n').filter((l) => l.trim()).length ?? 0
  if (lines > 0) parts.push(lines === 1 ? '1 note' : `${lines} notes`)
  if (parts.length === 0) parts.push(props.bit.status === 2 ? 'Done' : props.bit.status === 1 ? 'In progress' : 'Open')
  return parts.join(' · ')
})
</script>

<template>
  <div
    class="capsule"
    :class="{
      'capsule--expanded': expanded,
      'capsule--ready': state === 'ready',
      'capsule--blocked': state === 'blocked',
      'capsule--cycle': inCycle,
      'capsule--lifted': lifted,
      'capsule--dimmed': dimmed,
      [`capsule--snap-${snapHint}`]: !!snapHint,
    }"
    :style="{ '--c': color }"
    data-node-type="bit"
    :data-node-id="bit.id"
    tabindex="0"
    role="button"
    :aria-label="bit.title"
    :aria-expanded="expanded"
    @pointerdown="emit('pointerdown', $event)"
    @mousedown.stop
    @dblclick.stop="emit('open')"
    @keydown.enter.prevent="emit('open')"
  >
    <div class="capsule__row">
      <span class="capsule__dot" :class="`capsule__dot--s${bit.status}`">
        <Check v-if="bit.status === 2" :size="10" :stroke-width="3" />
      </span>
      <span class="capsule__title">{{ bit.title }}</span>
      <Lock v-if="state === 'blocked'" :size="11" class="capsule__lock" aria-label="Blocked" />
    </div>
    <div class="capsule__meta-wrap" :class="{ 'capsule__meta-wrap--open': expanded }">
      <div class="capsule__meta">{{ meta }}</div>
    </div>
    <button
      class="capsule__handle"
      type="button"
      tabindex="-1"
      aria-label="Draw a dependency from this bit"
      @pointerdown.stop.prevent="emit('linkstart', $event)"
      @mousedown.stop
    />
  </div>
</template>

<style scoped>
.capsule {
  position: relative;
  width: 200px;
  min-height: 32px;
  border-radius: 16px;
  padding: 0 12px 0 7px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background-color: var(--material-regular);
  backdrop-filter: blur(20px) saturate(170%);
  -webkit-backdrop-filter: blur(20px) saturate(170%);
  border: 1px solid var(--material-stroke);
  box-shadow:
    inset 0 1px 0 var(--material-edge),
    0 6px 16px -8px hsl(var(--surface-shadow) / calc(var(--shadow-strength) + 0.1));
  color: var(--text0);
  cursor: grab;
  user-select: none;
  touch-action: none;
  outline: none;
  transition:
    transform var(--spring-duration) var(--ease-spring),
    box-shadow 0.2s ease,
    opacity 0.25s ease;
}
.capsule:hover {
  transform: scale(1.02);
}
.capsule:focus-visible {
  box-shadow:
    inset 0 1px 0 var(--material-edge),
    0 0 0 3px color-mix(in srgb, var(--brand) 45%, transparent);
}
.capsule--expanded {
  border-radius: 16px;
}
.capsule--ready {
  box-shadow:
    inset 0 1px 0 var(--material-edge),
    0 0 0 1.5px rgba(52, 211, 153, 0.7),
    0 6px 16px -8px hsl(var(--surface-shadow) / 0.4);
}
.capsule--blocked {
  opacity: 0.6;
}
.capsule--cycle {
  box-shadow:
    inset 0 1px 0 var(--material-edge),
    0 0 0 1.5px rgba(249, 115, 22, 0.85),
    0 6px 16px -8px hsl(var(--surface-shadow) / 0.4);
}
.capsule--lifted {
  cursor: grabbing;
  transform: scale(1.05) rotate(-1.5deg);
  box-shadow:
    inset 0 1px 0 var(--material-edge),
    0 18px 32px -10px hsl(var(--surface-shadow) / 0.55);
  transition:
    transform 0.15s ease-out,
    box-shadow 0.15s ease-out;
}
.capsule--dimmed {
  opacity: 0.2;
}

.capsule__row {
  height: 30px;
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.capsule__dot {
  width: 17px;
  height: 17px;
  flex-shrink: 0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid var(--c);
  color: #fff;
  transition: background 0.2s ease;
}
.capsule__dot--s1 {
  background: conic-gradient(var(--c) 0 50%, transparent 50% 100%);
}
.capsule__dot--s2 {
  background: var(--c);
}

.capsule__title {
  flex: 1;
  min-width: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.capsule__lock {
  flex-shrink: 0;
  color: #f87171;
}

/* grid-rows trick: animates height between 0 and the 20px detail line */
.capsule__meta-wrap {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--spring-duration) var(--ease-spring);
}
.capsule__meta-wrap--open {
  grid-template-rows: 1fr;
}
.capsule__meta {
  overflow: hidden;
  padding-left: 24px;
  font-size: 0.6875rem;
  line-height: 14px;
  color: var(--text2);
  white-space: nowrap;
  text-overflow: ellipsis;
}
.capsule__meta-wrap--open .capsule__meta {
  height: 20px;
}

/* arrow handle: appears on hover at the right edge */
.capsule__handle {
  position: absolute;
  right: -6px;
  top: 9px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--surface1);
  border: 2px solid var(--c);
  opacity: 0;
  transform: scale(0.6);
  cursor: crosshair;
  transition:
    opacity 0.15s ease,
    transform var(--spring-duration) var(--ease-spring-bounce);
}
.capsule:hover .capsule__handle,
.capsule:focus-visible .capsule__handle {
  opacity: 1;
  transform: scale(1);
}
.capsule--lifted .capsule__handle {
  display: none;
}

/* snap hint: insert line above/below a loose capsule */
.capsule--snap-above::before,
.capsule--snap-below::before {
  content: '';
  position: absolute;
  left: 12px;
  right: 12px;
  height: 3px;
  border-radius: 2px;
  background: #818cf8;
  box-shadow: 0 0 10px rgba(129, 140, 248, 0.7);
}
.capsule--snap-above::before {
  top: -8px;
}
.capsule--snap-below::before {
  bottom: -8px;
}
</style>
```

`frontend/src/components/LPacketStack.vue`:

```vue
<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type { Bit } from '@/stores/bitStore'
import type { NodeRef, Packet, PacketSummary, WorkflowState } from '@/types/flow'
import { stackGeometry } from '@/composables/useFlowLayout'
import LBitCapsule from './LBitCapsule.vue'

const props = defineProps<{
  packet: Packet
  members: Bit[]
  x: number
  y: number
  states: Map<number, WorkflowState>
  cycleBitIds: Set<number>
  summary: PacketSummary
  expandedBitId: number | null
  gapIndex: number | null
  highlighted?: boolean
  dimmed?: boolean
  dragging?: boolean
}>()

const emit = defineEmits<{
  headerPointerdown: [e: PointerEvent]
  bitPointerdown: [e: PointerEvent, bitId: number]
  bitOpen: [bitId: number]
  linkstart: [e: PointerEvent, from: NodeRef]
  rename: [name: string]
}>()

const geometry = computed(() => {
  const expanded = props.members.findIndex((b) => b.id === props.expandedBitId)
  return stackGeometry(props.members.length, expanded === -1 ? null : expanded, props.gapIndex)
})

const editing = ref(false)
const draft = ref('')
const input = ref<HTMLInputElement | null>(null)

async function startRename() {
  draft.value = props.packet.name
  editing.value = true
  await nextTick()
  input.value?.select()
}

function commitRename() {
  if (!editing.value) return
  const name = draft.value.trim()
  editing.value = false
  if (name && name !== props.packet.name) emit('rename', name)
}
</script>

<template>
  <div
    class="stack"
    :class="{ 'stack--highlighted': highlighted, 'stack--dimmed': dimmed, 'stack--dragging': dragging }"
    :style="{ transform: `translate3d(${x}px, ${y}px, 0)`, height: `${geometry.height}px` }"
    data-node-type="packet"
    :data-node-id="packet.id"
    @mousedown.stop
  >
    <div class="stack__head" @pointerdown="emit('headerPointerdown', $event)">
      <input
        v-if="editing"
        ref="input"
        v-model="draft"
        class="stack__input"
        maxlength="60"
        @pointerdown.stop
        @keydown.enter.prevent="commitRename"
        @keydown.escape.prevent="editing = false"
        @blur="commitRename"
      />
      <span v-else class="stack__name" @dblclick.stop="startRename">{{ packet.name }}</span>
      <span class="stack__count">{{ summary.done }} / {{ summary.total }}</span>
      <button
        class="stack__handle"
        type="button"
        tabindex="-1"
        aria-label="Draw a dependency from this packet"
        @pointerdown.stop.prevent="emit('linkstart', $event, { type: 'packet', id: packet.id })"
        @mousedown.stop
      />
    </div>
    <div class="stack__bar">
      <i :style="{ transform: `scaleX(${summary.percent / 100})` }" />
    </div>

    <div
      v-for="(bit, i) in members"
      :key="bit.id"
      class="stack__row"
      :style="{ transform: `translateY(${geometry.offsets[i]}px)` }"
    >
      <span class="stack__num">{{ i + 1 }}</span>
      <LBitCapsule
        :bit="bit"
        :state="states.get(bit.id) ?? null"
        :expanded="expandedBitId === bit.id"
        :in-cycle="cycleBitIds.has(bit.id)"
        @pointerdown="emit('bitPointerdown', $event, bit.id)"
        @open="emit('bitOpen', bit.id)"
        @linkstart="emit('linkstart', $event, { type: 'bit', id: bit.id })"
      />
    </div>

    <div
      v-if="geometry.gapY !== null"
      class="stack__insert"
      :style="{ transform: `translateY(${geometry.gapY - 1.5}px)` }"
    />
  </div>
</template>

<style scoped>
.stack {
  position: absolute;
  left: 0;
  top: 0;
  width: 236px;
  border-radius: 20px;
  background: color-mix(in srgb, var(--surface2) 55%, transparent);
  border: 1px solid var(--material-stroke);
  box-shadow: inset 0 1px 0 var(--material-edge);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  will-change: transform;
  transition:
    transform var(--spring-duration) var(--ease-spring),
    height var(--spring-duration) var(--ease-spring),
    box-shadow 0.2s ease,
    opacity 0.25s ease;
}
.stack--dragging {
  transition:
    height var(--spring-duration) var(--ease-spring),
    box-shadow 0.15s ease;
  box-shadow:
    inset 0 1px 0 var(--material-edge),
    0 20px 40px -14px hsl(var(--surface-shadow) / 0.5);
}
.stack--highlighted {
  box-shadow:
    inset 0 1px 0 var(--material-edge),
    0 0 0 2px color-mix(in srgb, var(--brand) 60%, transparent),
    0 0 0 6px color-mix(in srgb, var(--brand) 14%, transparent);
}
.stack--dimmed {
  opacity: 0.25;
}

.stack__head {
  position: absolute;
  left: 8px;
  right: 8px;
  top: 8px;
  height: 22px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px 0 6px;
  cursor: grab;
  touch-action: none;
}
.stack--dragging .stack__head {
  cursor: grabbing;
}
.stack__name {
  flex: 1;
  min-width: 0;
  font-size: 0.8125rem;
  font-weight: 650;
  letter-spacing: -0.01em;
  color: var(--text0);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.stack__input {
  flex: 1;
  min-width: 0;
  font-size: 0.8125rem;
  font-weight: 650;
  color: var(--text0);
  background: var(--surface1);
  border: 1px solid var(--brand);
  border-radius: 6px;
  padding: 1px 6px;
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 16%, transparent);
}
.stack__count {
  font-size: 0.6875rem;
  font-variant-numeric: tabular-nums;
  color: var(--text2);
}
.stack__handle {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--surface1);
  border: 2px solid var(--brand);
  opacity: 0;
  transform: scale(0.6);
  cursor: crosshair;
  transition:
    opacity 0.15s ease,
    transform var(--spring-duration) var(--ease-spring-bounce);
}
.stack__head:hover .stack__handle {
  opacity: 1;
  transform: scale(1);
}

.stack__bar {
  position: absolute;
  left: 14px;
  right: 14px;
  top: 33px;
  height: 3px;
  border-radius: 2px;
  background: var(--fill-press);
  overflow: hidden;
}
.stack__bar i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #10b981, #34d399);
  transform-origin: left center;
  transition: transform 0.6s var(--ease-spring);
}

.stack__row {
  position: absolute;
  left: 8px;
  top: 0;
  display: flex;
  align-items: flex-start;
  transition: transform var(--spring-duration) var(--ease-spring);
}
.stack__num {
  width: 20px;
  height: 32px;
  line-height: 32px;
  font-size: 0.6875rem;
  font-variant-numeric: tabular-nums;
  color: var(--text2);
  text-align: center;
}

.stack__insert {
  position: absolute;
  left: 34px;
  right: 14px;
  top: 0;
  height: 3px;
  border-radius: 2px;
  background: #818cf8;
  box-shadow: 0 0 10px rgba(129, 140, 248, 0.7);
  transition: transform var(--spring-duration) var(--ease-spring);
}
</style>
```

`frontend/src/components/LDependencyLayer.vue`:

```vue
<script setup lang="ts">
import type { DependencyItem } from '@/types/flow'

defineProps<{
  items: DependencyItem[]
  preview: string | null
  selectedId: number | null
}>()

const emit = defineEmits<{
  select: [id: number]
  remove: [id: number]
}>()

const COLORS: Record<DependencyItem['state'], string> = {
  pending: 'rgba(148,163,184,0.7)',
  done: 'rgba(52,211,153,0.85)',
  cycle: 'rgba(249,115,22,0.9)',
}
</script>

<template>
  <svg class="deps" aria-hidden="false">
    <g
      v-for="item in items"
      :key="item.id"
      class="dep"
      :class="{ 'dep--dimmed': item.dimmed, 'dep--selected': selectedId === item.id }"
    >
      <path
        :d="item.d"
        class="dep__line"
        :class="`dep__line--${item.state}`"
        :stroke="COLORS[item.state]"
      />
      <polygon
        points="0,0 -9,-4.5 -9,4.5"
        :transform="`translate(${item.tx},${item.ty}) rotate(${item.angle})`"
        :fill="COLORS[item.state]"
      />
      <path :d="item.d" class="dep__hit" @click.stop="emit('select', item.id)" @mousedown.stop />
      <g
        v-if="selectedId === item.id"
        class="dep__delete"
        role="button"
        aria-label="Delete dependency"
        :transform="`translate(${item.mx},${item.my})`"
        @click.stop="emit('remove', item.id)"
        @mousedown.stop
      >
        <circle r="12" class="dep__delete-bg" />
        <line x1="-4" y1="-4" x2="4" y2="4" />
        <line x1="4" y1="-4" x2="-4" y2="4" />
      </g>
    </g>
    <path v-if="preview" :d="preview" class="dep__preview" />
  </svg>
</template>

<style scoped>
.deps {
  position: absolute;
  inset: 0;
  width: 0;
  height: 0;
  overflow: visible;
  pointer-events: none;
}
.dep {
  transition: opacity 0.25s ease;
}
.dep--dimmed {
  opacity: 0.08;
}
.dep__line {
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  transition: stroke 0.3s ease;
}
.dep--selected .dep__line {
  stroke-width: 3;
}
.dep__line--pending {
  stroke-dasharray: 6 5;
}
.dep__hit {
  fill: none;
  stroke: transparent;
  stroke-width: 20;
  pointer-events: stroke;
  cursor: pointer;
}
.dep__delete {
  pointer-events: all;
  cursor: pointer;
}
.dep__delete-bg {
  fill: var(--surface1);
  stroke: #ef4444;
  stroke-width: 1.5;
}
.dep__delete line {
  stroke: #ef4444;
  stroke-width: 2;
  stroke-linecap: round;
}
.dep__preview {
  fill: none;
  stroke: #818cf8;
  stroke-width: 2;
  stroke-dasharray: 4 4;
  stroke-linecap: round;
}
</style>
```

- [ ] **Step 4: Run the test**

Run: `cd frontend; npx vitest run src/components/flowComponents.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/LBitCapsule.vue frontend/src/components/LPacketStack.vue frontend/src/components/LDependencyLayer.vue frontend/src/components/flowComponents.test.ts
git commit -m "feat(frontend): add capsule, stack and dependency components" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: `useFlowGestures` (drag bit, drag stack, draw arrow)

**Files:**
- Create: `frontend/src/composables/useFlowGestures.ts`
- Test: `frontend/src/composables/useFlowGestures.test.ts`

**Interfaces:**
- Consumes: `FlowLayout`, `CAPSULE_W`, `CAPSULE_H`, `findSnapTarget`, `SnapTarget`, `VelocityTracker`, `project`, `NodeRef`.
- Produces:
  ```ts
  interface FlowGestureOptions {
    toCanvas(clientX: number, clientY: number): { x: number; y: number }
    zoom: Ref<number>
    layout: ComputedRef<FlowLayout>
    onTapBit(bitId: number): void
    onDropBit(bitId: number, target: SnapTarget | null, pos: { x: number; y: number }): Promise<void>
    onMovePacketEnd(packetId: number, x: number, y: number): Promise<void>
    onCreateDependency(from: NodeRef, to: NodeRef): void
  }
  useFlowGestures(opts) → {
    bitDrag: Ref<{ bitId: number; x: number; y: number; target: SnapTarget | null } | null>
    packetDrag: Ref<{ packetId: number; x: number; y: number } | null>
    linkDrag: Ref<{ from: NodeRef; x: number; y: number } | null>
    startBitPointer(e: PointerEvent, bitId: number): void
    startPacketPointer(e: PointerEvent, packetId: number): void
    startLinkPointer(e: PointerEvent, from: NodeRef): void
  }
  nodeAt(clientX: number, clientY: number): NodeRef | null
  ```

- [ ] **Step 1: Write the failing test** — `frontend/src/composables/useFlowGestures.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { computed, ref } from 'vue'
import type { Bit } from '@/stores/bitStore'
import { computeLayout } from './useFlowLayout'
import { useFlowGestures } from './useFlowGestures'

const bit = (id: number, packetId: number | null, order: number, x = 0, y = 0): Bit => ({
  id, title: `B${id}`, status: 0, x, y, packetId, order, createdAt: '',
})

function pointer(type: string, x: number, y: number) {
  return new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, button: 0, pointerType: 'mouse', bubbles: true })
}

function setup() {
  const layout = computed(() =>
    computeLayout({
      bits: [bit(1, null, 0, 0, 0), bit(2, null, 0, 0, 300)],
      packets: [],
      expandedBitId: null,
    }),
  )
  const opts = {
    toCanvas: (x: number, y: number) => ({ x, y }),
    zoom: ref(1),
    layout,
    onTapBit: vi.fn(),
    onDropBit: vi.fn().mockResolvedValue(undefined),
    onMovePacketEnd: vi.fn().mockResolvedValue(undefined),
    onCreateDependency: vi.fn(),
  }
  return { opts, g: useFlowGestures(opts) }
}

describe('useFlowGestures', () => {
  it('ein Klick ohne Bewegung ist ein Tap', () => {
    const { opts, g } = setup()
    g.startBitPointer(pointer('pointerdown', 10, 10), 1)
    window.dispatchEvent(pointer('pointerup', 11, 11))
    expect(opts.onTapBit).toHaveBeenCalledWith(1)
    expect(opts.onDropBit).not.toHaveBeenCalled()
  })

  it('ziehen folgt dem Pointer mit Greif-Versatz und erkennt Snap auf lose Kapsel', async () => {
    const { opts, g } = setup()
    g.startBitPointer(pointer('pointerdown', 10, 300), 2)
    // grabbed 10px from the left edge, at the top edge → grab offset (10, 0)
    window.dispatchEvent(pointer('pointermove', 60, 100))
    window.dispatchEvent(pointer('pointermove', 60, 40))
    expect(g.bitDrag.value).toMatchObject({ bitId: 2, x: 50, y: 40 })
    // probe = capsule centre (150, 56) is 40px below bit 1's centre → pair snap
    expect(g.bitDrag.value!.target).toEqual({ kind: 'pair', bitId: 1, position: 'below' })
    window.dispatchEvent(pointer('pointerup', 60, 40))
    await Promise.resolve()
    expect(opts.onDropBit).toHaveBeenCalledWith(2, { kind: 'pair', bitId: 1, position: 'below' }, { x: 50, y: 40 })
  })

  it('pointercancel beendet einen Drag sauber', async () => {
    const { g } = setup()
    g.startBitPointer(pointer('pointerdown', 10, 10), 1)
    window.dispatchEvent(pointer('pointermove', 400, 400))
    window.dispatchEvent(pointer('pointercancel', 400, 400))
    await Promise.resolve()
    await Promise.resolve()
    expect(g.bitDrag.value).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend; npx vitest run src/composables/useFlowGestures.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `frontend/src/composables/useFlowGestures.ts`:

```ts
import { ref, type ComputedRef, type Ref } from 'vue'
import { VelocityTracker, project } from '@/helpers/motion'
import type { NodeRef } from '@/types/flow'
import { CAPSULE_H, CAPSULE_W, type FlowLayout } from './useFlowLayout'
import { findSnapTarget, type SnapTarget } from './useStackDrag'

interface Point {
  x: number
  y: number
}

export interface FlowGestureOptions {
  toCanvas(clientX: number, clientY: number): Point
  zoom: Ref<number>
  layout: ComputedRef<FlowLayout>
  onTapBit(bitId: number): void
  onDropBit(bitId: number, target: SnapTarget | null, pos: Point): Promise<void>
  onMovePacketEnd(packetId: number, x: number, y: number): Promise<void>
  onCreateDependency(from: NodeRef, to: NodeRef): void
}

// Free drops glide a little: objects on a table, not a scroll view
const DECELERATION = 0.985

export function nodeAt(clientX: number, clientY: number): NodeRef | null {
  const el = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-node-type]')
  const type = el?.dataset.nodeType
  const id = Number(el?.dataset.nodeId)
  return (type === 'bit' || type === 'packet') && Number.isFinite(id) ? { type, id } : null
}

export function useFlowGestures(opts: FlowGestureOptions) {
  const bitDrag = ref<{ bitId: number; x: number; y: number; target: SnapTarget | null } | null>(null)
  const packetDrag = ref<{ packetId: number; x: number; y: number } | null>(null)
  const linkDrag = ref<{ from: NodeRef; x: number; y: number } | null>(null)

  /**
   * Window-level tracking: the pressed element may unmount mid-drag (a capsule leaving
   * its stack), so pointer capture on it would be lost.
   */
  function track(
    e: PointerEvent,
    handlers: {
      move(ev: PointerEvent): void
      end(ev: PointerEvent, moved: boolean, velocity: Point): void
    },
  ) {
    const threshold = e.pointerType === 'mouse' ? 4 : 10
    const sx = e.clientX
    const sy = e.clientY
    let moved = false
    const tracker = new VelocityTracker()
    tracker.add(sx, sy)

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < threshold) return
      moved = true
      tracker.add(ev.clientX, ev.clientY)
      handlers.move(ev)
    }
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      const v = ev.type === 'pointercancel' ? { x: 0, y: 0 } : tracker.velocity()
      const z = opts.zoom.value
      handlers.end(ev, moved, { x: v.x / z, y: v.y / z })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  function startBitPointer(e: PointerEvent, bitId: number) {
    if (e.button !== 0 || e.shiftKey) return
    e.stopPropagation()
    const rect = opts.layout.value.bitRects.get(bitId)
    if (!rect) return
    const start = opts.toCanvas(e.clientX, e.clientY)
    // respect where the capsule was grabbed
    const grab = { x: start.x - rect.x, y: start.y - rect.y }

    track(e, {
      move(ev) {
        const c = opts.toCanvas(ev.clientX, ev.clientY)
        const x = c.x - grab.x
        const y = c.y - grab.y
        const probe = { x: x + CAPSULE_W / 2, y: y + CAPSULE_H / 2 }
        bitDrag.value = { bitId, x, y, target: findSnapTarget(probe, bitId, opts.layout.value) }
      },
      async end(ev, moved, v) {
        const drag = bitDrag.value
        if (!moved || !drag || ev.type === 'pointercancel') {
          bitDrag.value = null
          if (!moved) opts.onTapBit(bitId)
          return
        }
        if (!drag.target) {
          // free drop: the capsule glides on from where it was released (CSS spring)
          bitDrag.value = null
          await opts.onDropBit(bitId, null, {
            x: drag.x + project(v.x, DECELERATION),
            y: drag.y + project(v.y, DECELERATION),
          })
          return
        }
        // snap drop: keep the floating capsule until the store has the new structure
        await opts.onDropBit(bitId, drag.target, { x: drag.x, y: drag.y })
        bitDrag.value = null
      },
    })
  }

  function startPacketPointer(e: PointerEvent, packetId: number) {
    if (e.button !== 0 || e.shiftKey) return
    e.stopPropagation()
    const rect = opts.layout.value.packetRects.get(packetId)
    if (!rect) return
    const start = opts.toCanvas(e.clientX, e.clientY)
    const grab = { x: start.x - rect.x, y: start.y - rect.y }

    track(e, {
      move(ev) {
        const c = opts.toCanvas(ev.clientX, ev.clientY)
        packetDrag.value = { packetId, x: c.x - grab.x, y: c.y - grab.y }
      },
      async end(ev, moved, v) {
        const drag = packetDrag.value
        packetDrag.value = null
        if (!moved || !drag || ev.type === 'pointercancel') return
        await opts.onMovePacketEnd(
          packetId,
          drag.x + project(v.x, DECELERATION),
          drag.y + project(v.y, DECELERATION),
        )
      },
    })
  }

  function startLinkPointer(e: PointerEvent, from: NodeRef) {
    if (e.button !== 0) return
    e.stopPropagation()
    const c = opts.toCanvas(e.clientX, e.clientY)
    linkDrag.value = { from, x: c.x, y: c.y }

    track(e, {
      move(ev) {
        const p = opts.toCanvas(ev.clientX, ev.clientY)
        linkDrag.value = { from, x: p.x, y: p.y }
      },
      end(ev) {
        linkDrag.value = null
        if (ev.type === 'pointercancel') return
        const to = nodeAt(ev.clientX, ev.clientY)
        if (to) opts.onCreateDependency(from, to)
      },
    })
  }

  return { bitDrag, packetDrag, linkDrag, startBitPointer, startPacketPointer, startLinkPointer }
}
```

- [ ] **Step 4: Run the test**

Run: `cd frontend; npx vitest run src/composables/useFlowGestures.test.ts`
Expected: PASS. (If jsdom lacks `PointerEvent`, add `globalThis.PointerEvent ??= class extends MouseEvent { pointerId: number; pointerType: string; constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 0; this.pointerType = init.pointerType ?? 'mouse' } } as typeof PointerEvent` at the top of the test file.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/composables/useFlowGestures.ts frontend/src/composables/useFlowGestures.test.ts
git commit -m "feat(frontend): add flow gestures for bits, stacks and arrows" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: `useFlowActions` (store orchestration)

**Files:**
- Create: `frontend/src/composables/useFlowActions.ts`
- Test: `frontend/src/composables/useFlowActions.test.ts`

**Interfaces:**
- Consumes: stores (Task 5), `FlowLayout` + constants (Task 6), `SnapTarget` (Task 7), `isValidLink` (Task 6).
- Produces: `useFlowActions()` → `{ reloadAll(): Promise<void>; dropBit(bitId, target: SnapTarget | null, pos: {x,y}, layout: FlowLayout): Promise<void>; movePacket(id, x, y): Promise<void>; renamePacket(id, name): Promise<void>; createDependency(from: NodeRef, to: NodeRef): Promise<void>; deleteDependency(id): Promise<void>; deleteBit(id, layout: FlowLayout): Promise<void> }`.

- [ ] **Step 1: Write the failing test** — `frontend/src/composables/useFlowActions.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }))
vi.mock('@/helpers/api', () => ({ default: api }))

import type { Bit } from '@/stores/bitStore'
import { useBitStore } from '@/stores/bitStore'
import { usePacketStore } from '@/stores/packetStore'
import { computeLayout } from './useFlowLayout'
import { useFlowActions } from './useFlowActions'

const bit = (id: number, packetId: number | null, order: number, x = 0, y = 0): Bit => ({
  id, title: `B${id}`, status: 0, x, y, packetId, order, createdAt: '',
})

let server: { bits: Bit[]; packets: { id: number; name: string; x: number; y: number }[] }

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
  server = { bits: [], packets: [] }
  api.get.mockImplementation((url: string) =>
    Promise.resolve({
      data: url === '/api/bit' ? server.bits : url === '/api/packet' ? server.packets : [],
    }),
  )
  api.put.mockResolvedValue({ data: {} })
  api.post.mockResolvedValue({ data: { id: 50, name: 'Packet 1', x: 0, y: 0 } })
})

function seed(bits: Bit[], packets: { id: number; name: string; x: number; y: number }[]) {
  useBitStore().bits = bits.map((b) => ({ ...b }))
  usePacketStore().packets = packets.map((p) => ({ ...p }))
  return computeLayout({ bits, packets, expandedBitId: null })
}

describe('useFlowActions.dropBit', () => {
  it('Stack-Ziel: setzt die neue Reihenfolge inkl. eingefügtem Bit', async () => {
    const layout = seed([bit(1, 7, 0), bit(2, 7, 1), bit(3, null, 0)], [{ id: 7, name: 'P', x: 100, y: 100 }])
    await useFlowActions().dropBit(3, { kind: 'stack', packetId: 7, index: 1 }, { x: 0, y: 0 }, layout)
    expect(api.put).toHaveBeenCalledWith('/api/packet/7/bits', { bitIds: [1, 3, 2] })
  })

  it('Pair-Ziel: legt ein Packet so an, dass die Ziel-Kapsel an ihrem Platz bleibt', async () => {
    const layout = seed([bit(1, null, 0, 500, 300), bit(2, null, 0)], [])
    await useFlowActions().dropBit(2, { kind: 'pair', bitId: 1, position: 'below' }, { x: 0, y: 0 }, layout)
    expect(api.post).toHaveBeenCalledWith('/api/packet', { x: 472, y: 260, bitIds: [1, 2] })
  })

  it('Herausziehen bis zur Auflösung: das übrige Bit behält seine Bildschirmposition', async () => {
    const layout = seed([bit(1, 7, 0, 5, 5), bit(2, 7, 1, 5, 5)], [{ id: 7, name: 'P', x: 100, y: 100 }])
    server.bits = [bit(1, null, 0, 700, 700), bit(2, null, 0, 5, 5)]
    server.packets = []
    await useFlowActions().dropBit(1, null, { x: 700, y: 700 }, layout)
    expect(api.put).toHaveBeenCalledWith('/api/bit/1', { packetId: null, x: 700, y: 700 })
    // bit 2 was the second step: rect y = 100 + 76
    expect(api.put).toHaveBeenCalledWith('/api/bit/2', { x: 128, y: 176 })
  })

  it('freies Verschieben einer losen Kapsel speichert nur x/y', async () => {
    const layout = seed([bit(1, null, 0)], [])
    await useFlowActions().dropBit(1, null, { x: 40.4, y: 80.6 }, layout)
    expect(api.put).toHaveBeenCalledWith('/api/bit/1', { x: 40, y: 81 })
    expect(api.get).not.toHaveBeenCalled()
  })

  it('ungültige Pfeile werden gar nicht erst gesendet', async () => {
    seed([bit(1, null, 0)], [])
    await useFlowActions().createDependency({ type: 'bit', id: 1 }, { type: 'bit', id: 1 })
    expect(api.post).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend; npx vitest run src/composables/useFlowActions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `frontend/src/composables/useFlowActions.ts`:

```ts
import { useBitStore } from '@/stores/bitStore'
import { usePacketStore } from '@/stores/packetStore'
import { useDependencyStore } from '@/stores/dependencyStore'
import type { NodeRef } from '@/types/flow'
import {
  CAPSULE_H,
  STACK_HEADER_H,
  STACK_PAD,
  STEP_GAP,
  STEP_NUM_W,
  type FlowLayout,
} from './useFlowLayout'
import { isValidLink } from './useFlowState'
import type { SnapTarget } from './useStackDrag'

export function useFlowActions() {
  const bitStore = useBitStore()
  const packetStore = usePacketStore()
  const dependencyStore = useDependencyStore()

  async function reloadAll(): Promise<void> {
    await Promise.all([
      bitStore.fetchBits(),
      packetStore.fetchPackets(),
      dependencyStore.fetchDependencies(),
    ])
  }

  /** On any failure the server state wins and the canvas springs back to it. */
  async function guarded(op: () => Promise<void>): Promise<void> {
    try {
      await op()
    } catch (e) {
      console.error('Flow update failed:', e)
      await reloadAll().catch(() => {})
    }
  }

  /** Bits that just left a packet keep their last on-screen position. */
  async function restoreFreedPositions(
    before: FlowLayout,
    packetBefore: Map<number, number | null>,
    skipId: number,
  ): Promise<void> {
    const freed = bitStore.bits.filter(
      (b) => b.packetId == null && packetBefore.get(b.id) != null && b.id !== skipId,
    )
    await Promise.all(
      freed.map((b) => {
        const r = before.bitRects.get(b.id)
        return r ? bitStore.updateBit(b.id, { x: Math.round(r.x), y: Math.round(r.y) }) : Promise.resolve()
      }),
    )
  }

  function dropBit(
    bitId: number,
    target: SnapTarget | null,
    pos: { x: number; y: number },
    layout: FlowLayout,
  ): Promise<void> {
    return guarded(async () => {
      const bit = bitStore.bits.find((b) => b.id === bitId)
      if (!bit) return
      const packetBefore = new Map(bitStore.bits.map((b) => [b.id, b.packetId] as const))

      if (target?.kind === 'stack') {
        const ids = (layout.membersOf.get(target.packetId) ?? [])
          .map((b) => b.id)
          .filter((id) => id !== bitId)
        ids.splice(target.index, 0, bitId)
        await packetStore.setBits(target.packetId, ids)
      } else if (target?.kind === 'pair') {
        const t = layout.bitRects.get(target.bitId)
        if (!t) return
        const above = target.position === 'above'
        await packetStore.createPacket({
          x: t.x - STACK_PAD - STEP_NUM_W,
          // the target capsule stays where it is; the stack grows around it
          y: (above ? t.y - (CAPSULE_H + STEP_GAP) : t.y) - STACK_HEADER_H,
          bitIds: above ? [bitId, target.bitId] : [target.bitId, bitId],
        })
      } else if (bit.packetId != null) {
        await bitStore.updateBit(bitId, {
          packetId: null,
          x: Math.round(pos.x),
          y: Math.round(pos.y),
        })
      } else {
        await bitStore.updateBit(bitId, { x: Math.round(pos.x), y: Math.round(pos.y) })
        return
      }

      await reloadAll()
      await restoreFreedPositions(layout, packetBefore, bitId)
    })
  }

  function movePacket(id: number, x: number, y: number): Promise<void> {
    return guarded(() => packetStore.updatePacket(id, { x, y }))
  }

  function renamePacket(id: number, name: string): Promise<void> {
    return guarded(() => packetStore.updatePacket(id, { name }))
  }

  function createDependency(from: NodeRef, to: NodeRef): Promise<void> {
    if (!isValidLink(from, to, bitStore.bits, dependencyStore.dependencies)) return Promise.resolve()
    return guarded(async () => {
      await dependencyStore.createDependency(from, to)
    })
  }

  function deleteDependency(id: number): Promise<void> {
    return guarded(() => dependencyStore.deleteDependency(id))
  }

  function deleteBit(id: number, layout: FlowLayout): Promise<void> {
    return guarded(async () => {
      const packetBefore = new Map(bitStore.bits.map((b) => [b.id, b.packetId] as const))
      await bitStore.deleteBit(id)
      await reloadAll()
      await restoreFreedPositions(layout, packetBefore, id)
    })
  }

  return { reloadAll, dropBit, movePacket, renamePacket, createDependency, deleteDependency, deleteBit }
}
```

- [ ] **Step 4: Run the test**

Run: `cd frontend; npx vitest run src/composables/useFlowActions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/composables/useFlowActions.ts frontend/src/composables/useFlowActions.test.ts
git commit -m "feat(frontend): add flow actions that keep canvas and server in sync" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Rewrite `LWorkspace.vue`, adapt `LPacketsHud.vue`, remove `LBit.vue`

**Files:**
- Modify (rewrite script + template, keep the view-controls/sheet styles): `frontend/src/views/LWorkspace.vue`
- Modify: `frontend/src/components/LPacketsHud.vue`
- Delete: `frontend/src/components/LBit.vue`
- Test: `frontend/src/views/LWorkspace.test.ts` (existing, must stay green) + add one case

**Interfaces:**
- Consumes: everything from Tasks 5–10; `useCanvas` (`zoom`, `panX`, `panY`, `canvasTransform`, `isDragging`, `zoomIn`, `zoomOut`, `animateView`, mouse/touch/wheel handlers).
- Produces: `LPacketsHud` props `{ cards: PacketCard[] }`, emits `highlight: [packetId: number]`, `unhighlight: []`.

- [ ] **Step 1: Extend the workspace test** — append to `frontend/src/views/LWorkspace.test.ts` inside the `describe`:

```ts
  it('rendert Stapel und lose Kapseln aus den Stores', async () => {
    const { default: api } = await import('../helpers/api')
    vi.mocked(api.get).mockImplementation((url: string) =>
      Promise.resolve({
        data:
          url === '/api/bit'
            ? [
                { id: 1, title: 'Plan', status: 2, x: 0, y: 0, packetId: 7, order: 0, createdAt: '' },
                { id: 2, title: 'Build', status: 0, x: 0, y: 0, packetId: 7, order: 1, createdAt: '' },
                { id: 3, title: 'Loose', status: 0, x: 400, y: 0, packetId: null, order: 0, createdAt: '' },
              ]
            : url === '/api/packet'
              ? [{ id: 7, name: 'Release', x: 0, y: 0 }]
              : [],
      }),
    )
    const wrapper = mount(LWorkspace, { global: { plugins: [router, createPinia()] } })
    await router.isReady()
    await new Promise((r) => setTimeout(r, 0))
    expect(wrapper.findAll('[data-node-type="packet"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-node-type="bit"]')).toHaveLength(3)
    expect(wrapper.text()).toContain('Release')
  })
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend; npx vitest run src/views/LWorkspace.test.ts`
Expected: FAIL (old workspace imports `connectionStore`, which no longer exists).

- [ ] **Step 3: Implement**

Replace the `<script setup>` and `<template>` of `frontend/src/views/LWorkspace.vue` with the following, and keep its `<style scoped>` block but delete every rule from `@keyframes conn-draw` to the end of the block (the connection animations), so only the `.view-controls*`, `.sheet-*` rules and the reduced-motion `.sheet-*` media query remain; then append the `.flow-item` rules shown below.

```vue
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Fullscreen, ScanSearch, ZoomIn, ZoomOut } from 'lucide-vue-next'
import LContextMenu from '@/components/LContextMenu.vue'
import LBitPanel from '@/components/LBitPanel.vue'
import LBitCapsule from '@/components/LBitCapsule.vue'
import LPacketStack from '@/components/LPacketStack.vue'
import LDependencyLayer from '@/components/LDependencyLayer.vue'
import LPacketsHud from '@/components/LPacketsHud.vue'
import LTaskbar from '@/layout/LTaskbar.vue'
import LMenu from '@/layout/LMenu.vue'
import { useTheme } from '@/composables/useTheme.ts'
import { useCanvas } from '@/composables/useCanvas.ts'
import {
  CAPSULE_H,
  CAPSULE_W,
  anchor,
  computeLayout,
  dependencyGeometry,
  unionRect,
} from '@/composables/useFlowLayout'
import { computeFlowState } from '@/composables/useFlowState'
import { useFlowGestures } from '@/composables/useFlowGestures'
import { useFlowActions } from '@/composables/useFlowActions'
import { useBitStore } from '@/stores/bitStore'
import { usePacketStore } from '@/stores/packetStore'
import { useDependencyStore } from '@/stores/dependencyStore'
import type { Dependency, DependencyItem, PacketCard } from '@/types/flow'

const containerRef = ref<HTMLElement | null>(null)

const {
  zoom,
  panX,
  panY,
  canvasTransform,
  isDragging,
  zoomIn,
  zoomOut,
  animateView,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  handleWheel,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
} = useCanvas(containerRef)

const bitStore = useBitStore()
const packetStore = usePacketStore()
const dependencyStore = useDependencyStore()
const actions = useFlowActions()

function toCanvas(clientX: number, clientY: number) {
  const rect = containerRef.value!.getBoundingClientRect()
  return {
    x: (clientX - rect.left - panX.value) / zoom.value,
    y: (clientY - rect.top - panY.value) / zoom.value,
  }
}

const selectedBitId = ref<number | null>(null)
const selectedDependencyId = ref<number | null>(null)
const highlightedPacketId = ref<number | null>(null)

// Layout of the stored state — what snap detection and drops reason about
const baseLayout = computed(() =>
  computeLayout({
    bits: bitStore.bits,
    packets: packetStore.packets,
    expandedBitId: selectedBitId.value,
  }),
)

const { bitDrag, packetDrag, linkDrag, startBitPointer, startPacketPointer, startLinkPointer } =
  useFlowGestures({
    toCanvas,
    zoom,
    layout: baseLayout,
    onTapBit: (id) => {
      selectedDependencyId.value = null
      selectedBitId.value = selectedBitId.value === id ? null : id
    },
    onDropBit: (id, target, pos) => actions.dropBit(id, target, pos, baseLayout.value),
    onMovePacketEnd: (id, x, y) => actions.movePacket(id, x, y),
    onCreateDependency: (from, to) => {
      void actions.createDependency(from, to)
    },
  })

// Layout including in-flight gestures — what is rendered and where arrows attach
const liveLayout = computed(() => {
  const pd = packetDrag.value
  const packets = pd
    ? packetStore.packets.map((p) => (p.id === pd.packetId ? { ...p, x: pd.x, y: pd.y } : p))
    : packetStore.packets
  const layout = computeLayout({
    bits: bitStore.bits,
    packets,
    expandedBitId: selectedBitId.value,
  })
  const bd = bitDrag.value
  if (bd) layout.bitRects.set(bd.bitId, { x: bd.x, y: bd.y, w: CAPSULE_W, h: CAPSULE_H })
  return layout
})

const flow = computed(() =>
  computeFlowState(bitStore.bits, packetStore.packets, dependencyStore.dependencies),
)

const looseBits = computed(() =>
  liveLayout.value.looseBitIds
    .map((id) => bitStore.bits.find((b) => b.id === id)!)
    .filter(Boolean),
)

/** A bit dragged out of a stack floats above everything until it is dropped. */
const floatingBit = computed(() => {
  const bd = bitDrag.value
  if (!bd) return null
  const bit = bitStore.bits.find((b) => b.id === bd.bitId)
  return bit && bit.packetId != null && liveLayout.value.packetRects.has(bit.packetId) ? bit : null
})

const stacks = computed(() =>
  packetStore.packets
    .filter((p) => liveLayout.value.membersOf.has(p.id))
    .map((p) => {
      const bd = bitDrag.value
      const rect = liveLayout.value.packetRects.get(p.id)!
      const target = bd?.target
      return {
        packet: p,
        x: rect.x,
        y: rect.y,
        members: (liveLayout.value.membersOf.get(p.id) ?? []).filter((b) => b.id !== bd?.bitId),
        gapIndex: target?.kind === 'stack' && target.packetId === p.id ? target.index : null,
      }
    }),
)

function packetOfBit(id: number): number | null {
  return bitStore.bits.find((b) => b.id === id)?.packetId ?? null
}

function isBitDimmed(id: number): boolean {
  return highlightedPacketId.value !== null && packetOfBit(id) !== highlightedPacketId.value
}

function isDependencyDimmed(dep: Dependency): boolean {
  const hp = highlightedPacketId.value
  if (hp === null) return false
  const touches = (type: 'bit' | 'packet', id: number) =>
    type === 'packet' ? id === hp : packetOfBit(id) === hp
  return !touches(dep.fromType, dep.fromId) && !touches(dep.toType, dep.toId)
}

const dependencyItems = computed<DependencyItem[]>(() =>
  dependencyStore.dependencies.flatMap((dep) => {
    const from = anchor(liveLayout.value, { type: dep.fromType, id: dep.fromId }, 'out')
    const to = anchor(liveLayout.value, { type: dep.toType, id: dep.toId }, 'in')
    if (!from || !to) return []
    const state = flow.value.cycleDependencyIds.has(dep.id)
      ? 'cycle'
      : flow.value.sourceDone(dep)
        ? 'done'
        : 'pending'
    return [{ id: dep.id, ...dependencyGeometry(from, to), state, dimmed: isDependencyDimmed(dep) }]
  }),
)

const linkPreview = computed(() => {
  const l = linkDrag.value
  if (!l) return null
  const from = anchor(liveLayout.value, l.from, 'out')
  return from ? dependencyGeometry(from, { x: l.x, y: l.y }).d : null
})

const packetCards = computed<PacketCard[]>(() =>
  packetStore.packets
    .filter((p) => flow.value.packetSummary.has(p.id))
    .map((p) => ({
      key: p.id,
      name: p.name,
      bitIds: (liveLayout.value.membersOf.get(p.id) ?? []).map((b) => b.id),
      ...flow.value.packetSummary.get(p.id)!,
    })),
)

function focusPacket(id: number) {
  highlightedPacketId.value = id
  const rect = liveLayout.value.packetRects.get(id)
  const el = containerRef.value
  if (!rect || !el) return
  const { width, height } = el.getBoundingClientRect()
  const z = zoom.value
  animateView(z, width / 2 - (rect.x + rect.w / 2) * z, height / 2 - (rect.y + rect.h / 2) * z)
}

function resetViewToBits() {
  const el = containerRef.value
  const bounds = unionRect([
    ...liveLayout.value.bitRects.values(),
    ...liveLayout.value.packetRects.values(),
  ])
  if (!el || !bounds) {
    animateView(1, 0, 0)
    return
  }
  const { width, height } = el.getBoundingClientRect()
  const PADDING = 80
  const z = Math.min(
    3,
    Math.max(0.25, Math.min((width - PADDING * 2) / bounds.w, (height - PADDING * 2) / bounds.h)),
  )
  animateView(z, width / 2 - (bounds.x + bounds.w / 2) * z, height / 2 - (bounds.y + bounds.h / 2) * z)
}

// --- Context menu (create bit) ---
type ContextMenuState = { visible: boolean; x: number; y: number }
const contextMenu = ref<ContextMenuState>({ visible: false, x: 0, y: 0 })
const contextCanvasPos = ref({ x: 0, y: 0 })

function showContextMenu(clientX: number, clientY: number) {
  contextCanvasPos.value = toCanvas(clientX, clientY)
  contextMenu.value = { visible: true, x: clientX, y: clientY }
}

function closeContextMenu() {
  contextMenu.value.visible = false
}

function handleContextMenu(event: MouseEvent) {
  event.preventDefault()
  showContextMenu(event.clientX, event.clientY)
}

let longPressTimer: number | null = null
const LONG_PRESS_DURATION = 500

function clearLongPress() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function handleTouchStartWithLongPress(event: TouchEvent) {
  clearLongPress()
  if (event.touches.length === 1) {
    const touch = event.touches[0]!
    longPressTimer = window.setTimeout(
      () => showContextMenu(touch.clientX, touch.clientY),
      LONG_PRESS_DURATION,
    )
  }
  handleTouchStart(event)
}

function handleTouchMoveWithLongPress(event: TouchEvent) {
  clearLongPress()
  handleTouchMove(event)
}

function handleTouchEndWithLongPress() {
  clearLongPress()
  handleTouchEnd()
}

// --- Detail panel ---
const showPanel = ref(false)
const panelMode = ref<'create' | 'edit'>('create')
const panelBitId = ref<number | null>(null)
const panelBit = computed(() =>
  panelBitId.value !== null ? bitStore.bits.find((b) => b.id === panelBitId.value) : undefined,
)

function createBit() {
  closeContextMenu()
  panelMode.value = 'create'
  panelBitId.value = null
  showPanel.value = true
}

function openBitDetail(id: number) {
  panelMode.value = 'edit'
  panelBitId.value = id
  showPanel.value = true
}

async function onPanelConfirm(data: {
  title: string
  status: number
  priority: number | undefined
  dueDate: string | undefined
  notes: string | undefined
  color: string
}) {
  if (panelMode.value === 'create') {
    showPanel.value = false
    try {
      await bitStore.createBit({
        ...data,
        x: contextCanvasPos.value.x - CAPSULE_W / 2,
        y: contextCanvasPos.value.y - CAPSULE_H / 2,
      })
    } catch (e) {
      console.error('Failed to create bit:', e)
    }
  } else if (panelBitId.value !== null) {
    try {
      await bitStore.updateBit(panelBitId.value, data)
      showPanel.value = false
    } catch (e) {
      console.error('Failed to update bit:', e)
    }
  }
}

async function onPanelDelete() {
  if (panelBitId.value === null) return
  const id = panelBitId.value
  showPanel.value = false
  if (selectedBitId.value === id) selectedBitId.value = null
  await actions.deleteBit(id, baseLayout.value)
}

const menuItems = [{ label: 'Create Bit', icon: '+', action: createBit }]

// --- View controls ---
const showControls = ref(false)
let hideTimer: number | null = null

function handleEnter() {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  showControls.value = true
}

function handleLeaveDelay() {
  hideTimer = window.setTimeout(() => {
    showControls.value = false
  }, 300)
}

function openControls() {
  handleEnter()
}

function onWorkspaceMouseDown(e: MouseEvent) {
  selectedBitId.value = null
  selectedDependencyId.value = null
  showControls.value = false
  handleMouseDown(e)
}

const { initTheme, applyTheme, isDark } = useTheme()

onMounted(() => {
  initTheme()
  applyTheme()
  window.addEventListener('mouseup', handleMouseUp)
  window.addEventListener('mousemove', handleMouseMove)
  actions.reloadAll().catch((e) => console.error('Failed to load workspace:', e))
})

onUnmounted(() => {
  window.removeEventListener('mouseup', handleMouseUp)
  window.removeEventListener('mousemove', handleMouseMove)
  clearLongPress()
})
</script>

<template>
  <div style="position: relative; width: 100vw; height: 100vh; overflow: hidden">
    <Transition name="sheet">
      <LBitPanel
        v-if="showPanel"
        :mode="panelMode"
        :bit="panelBit"
        @confirm="onPanelConfirm"
        @cancel="showPanel = false"
        @delete="onPanelDelete"
      />
    </Transition>

    <div
      ref="containerRef"
      class="w-full h-screen overflow-hidden bg-surface1 relative"
      :class="isDark ? 'bg-dotted-grid-dark' : 'bg-dotted-grid-light'"
      @wheel.prevent="handleWheel"
      @mousedown="onWorkspaceMouseDown"
      @contextmenu="handleContextMenu"
      @touchstart="handleTouchStartWithLongPress"
      @touchmove="handleTouchMoveWithLongPress"
      @touchend="handleTouchEndWithLongPress"
      :style="{
        cursor: isDragging ? 'grabbing' : 'default',
        transform: showPanel ? 'translateX(300px)' : 'translateX(0)',
        transition: 'transform var(--spring-duration) var(--ease-spring)',
      }"
    >
      <div class="absolute inset-0 origin-top-left" :style="{ transform: canvasTransform }">
        <div v-if="bitStore.bits.length === 0" class="p-5">
          <div class="max-w-7xl">
            <h1 class="text-[2rem] text-text0 mb-2">Workspace</h1>
            <p class="text-text2 text-[0.9375rem] leading-relaxed">
              Right-click or long-press to create a bit. Drag a bit under another to build a
              packet; drag from the handle to draw a dependency.
            </p>
          </div>
        </div>

        <LDependencyLayer
          :items="dependencyItems"
          :preview="linkPreview"
          :selected-id="selectedDependencyId"
          @select="(id) => (selectedDependencyId = selectedDependencyId === id ? null : id)"
          @remove="
            (id) => {
              selectedDependencyId = null
              actions.deleteDependency(id)
            }
          "
        />

        <LPacketStack
          v-for="s in stacks"
          :key="s.packet.id"
          :packet="s.packet"
          :members="s.members"
          :x="s.x"
          :y="s.y"
          :states="flow.bitState"
          :cycle-bit-ids="flow.cycleBitIds"
          :summary="flow.packetSummary.get(s.packet.id)!"
          :expanded-bit-id="selectedBitId"
          :gap-index="s.gapIndex"
          :highlighted="highlightedPacketId === s.packet.id"
          :dimmed="highlightedPacketId !== null && highlightedPacketId !== s.packet.id"
          :dragging="packetDrag?.packetId === s.packet.id"
          @header-pointerdown="(e) => startPacketPointer(e, s.packet.id)"
          @bit-pointerdown="(e, id) => startBitPointer(e, id)"
          @bit-open="openBitDetail"
          @linkstart="(e, from) => startLinkPointer(e, from)"
          @rename="(name) => actions.renamePacket(s.packet.id, name)"
        />

        <div
          v-for="bit in looseBits"
          :key="bit.id"
          class="flow-item"
          :class="{ 'flow-item--dragging': bitDrag?.bitId === bit.id }"
          :style="{
            transform: `translate3d(${liveLayout.bitRects.get(bit.id)!.x}px, ${liveLayout.bitRects.get(bit.id)!.y}px, 0)`,
          }"
        >
          <LBitCapsule
            :bit="bit"
            :state="flow.bitState.get(bit.id) ?? null"
            :expanded="selectedBitId === bit.id"
            :in-cycle="flow.cycleBitIds.has(bit.id)"
            :lifted="bitDrag?.bitId === bit.id"
            :dimmed="isBitDimmed(bit.id)"
            :snap-hint="
              bitDrag?.target?.kind === 'pair' && bitDrag.target.bitId === bit.id
                ? bitDrag.target.position
                : null
            "
            @pointerdown="(e) => startBitPointer(e, bit.id)"
            @open="openBitDetail(bit.id)"
            @linkstart="(e) => startLinkPointer(e, { type: 'bit', id: bit.id })"
          />
        </div>

        <div
          v-if="floatingBit && bitDrag"
          class="flow-item flow-item--dragging"
          :style="{ transform: `translate3d(${bitDrag.x}px, ${bitDrag.y}px, 0)` }"
        >
          <LBitCapsule
            :bit="floatingBit"
            :state="flow.bitState.get(floatingBit.id) ?? null"
            :expanded="false"
            lifted
          />
        </div>
      </div>

      <div
        class="view-controls material"
        :class="{ 'view-controls--open': showControls }"
        @mouseenter="handleEnter"
        @mouseleave="handleLeaveDelay"
        @mousedown.stop
      >
        <div class="view-controls__extra" :aria-hidden="!showControls">
          <button
            class="view-controls__btn pressable"
            title="Zoom In"
            aria-label="Zoom in"
            :tabindex="showControls ? 0 : -1"
            @click="zoomIn"
          >
            <ZoomIn :size="20" />
          </button>
          <button
            class="view-controls__btn pressable"
            title="Zoom Out"
            aria-label="Zoom out"
            :tabindex="showControls ? 0 : -1"
            @click="zoomOut"
          >
            <ZoomOut :size="20" />
          </button>
          <button
            class="view-controls__btn pressable"
            title="Fit all Bits"
            aria-label="Fit all bits into view"
            :tabindex="showControls ? 0 : -1"
            @click="resetViewToBits"
          >
            <Fullscreen :size="20" />
          </button>
          <div class="view-controls__sep" />
        </div>
        <button
          class="view-controls__btn pressable"
          title="View Controls"
          aria-label="View controls"
          :aria-expanded="showControls"
          @click="openControls"
        >
          <ScanSearch :size="20" />
        </button>
      </div>
    </div>

    <LTaskbar />
    <LMenu />

    <LPacketsHud
      :cards="packetCards"
      @highlight="focusPacket"
      @unhighlight="highlightedPacketId = null"
    />
    <LContextMenu
      v-if="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :items="menuItems"
      @close="closeContextMenu"
    />
  </div>
</template>
```

Append to the `<style scoped>` block of `LWorkspace.vue`:

```css
/* Loose capsules glide to new positions; while dragged they follow the pointer 1:1 */
.flow-item {
  position: absolute;
  left: 0;
  top: 0;
  will-change: transform;
  transition: transform var(--spring-duration) var(--ease-spring);
}
.flow-item--dragging {
  transition: none;
  z-index: 20;
}
```

`frontend/src/components/LPacketsHud.vue` changes:

1. In `<script setup>`: replace the import line `import { Pencil, TriangleAlert } from 'lucide-vue-next'` with `import { TriangleAlert } from 'lucide-vue-next'`, add `import type { PacketCard } from '@/types/flow'`, delete the local `interface PacketCard { … }`, and replace the emits with:

```ts
const emit = defineEmits<{
  highlight: [packetId: number]
  unhighlight: []
}>()
```

2. Delete the whole block from `const STORAGE_KEY = 'listion-packet-names'` through the end of `cancelRename()`, but keep the `onMounted(() => { measurePageHeight() })` call by replacing the removed `onMounted` with:

```ts
onMounted(() => {
  measurePageHeight()
})
```

3. Replace `toggleHighlight` with:

```ts
function toggleHighlight(card: PacketCard) {
  if (highlightedKey.value === card.key) {
    highlightedKey.value = null
    emit('unhighlight')
  } else {
    highlightedKey.value = card.key
    emit('highlight', card.key)
  }
}
```

4. In the template, replace the whole `<template v-if="editingKey === card.key"> … </template><template v-else> … </template>` block with:

```html
                <button class="packet-name" @click="toggleHighlight(card)" @pointerdown.stop>
                  <span class="packet-name__text">{{ card.name }}</span>
                </button>
```

5. In `<style scoped>`, delete the `.edit-icon`, `.packet-name:hover .edit-icon, .packet-name:focus-visible .edit-icon` and `.packet-name-input` rules.

Delete `frontend/src/components/LBit.vue`.

- [ ] **Step 4: Run all frontend checks**

Run: `cd frontend; npx vitest run; npx vue-tsc --build; npx eslint .`
Expected: all tests PASS, vue-tsc exit 0, eslint exit 0.

- [ ] **Step 5: Commit**

```bash
git add -A frontend/src
git commit -m "feat(frontend): rebuild workspace around capsules, stacks and dependencies" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: End-to-end verification in the running app

**Files:**
- Modify: `docs/superpowers/specs/2026-10-13-bit-packet-flow-design.md` (only if behaviour deviates; note it under "Offene Punkte")

- [ ] **Step 1: Rebuild and start the stack**

Run: `./docker-start.sh` (rebuilds images, renews `node_modules` volumes). Wait until `docker logs listion-backend` shows `Nest application successfully started` and the mapped routes include `/api/packet`, `/api/packet/:id/bits` and `/api/dependency`.

- [ ] **Step 2: Drop the orphaned table (local dev DB only)**

Run: `docker compose exec postgres psql -U listion_user -d listion -c "DROP TABLE IF EXISTS bit_connection;"`
Expected: `DROP TABLE`.

- [ ] **Step 3: API smoke test through the frontend proxy**

Log in with the local test account from `.claude/test-account.local.json` and run, with the cookie jar:

```bash
curl -s -c /tmp/j -H "Content-Type: application/json" -d '{"email":"design-check@listion.test","password":"<from file>"}' http://localhost:5173/api/auth/login
curl -s -b /tmp/j -H "Content-Type: application/json" -d '{"title":"A","x":0,"y":0}' http://localhost:5173/api/bit
curl -s -b /tmp/j -H "Content-Type: application/json" -d '{"title":"B","x":0,"y":60}' http://localhost:5173/api/bit
curl -s -b /tmp/j -H "Content-Type: application/json" -d '{"x":0,"y":0,"bitIds":[<A>,<B>]}' http://localhost:5173/api/packet
curl -s -b /tmp/j http://localhost:5173/api/bit
```

Expected: packet 201 with name `Packet N`; both bits show `packetId` and `order` 0/1.

- [ ] **Step 4: Manual browser check** (`http://localhost:5173/workspace`, logged in)

Check each, fix anything broken before continuing:
1. Right-click → Create Bit twice → two loose capsules.
2. Drag one capsule just under the other → insert line + glow → release → stack with header, „0 / 2“, numbers 1/2.
3. Third capsule over the stack between the steps → gap opens → release → it becomes step 2.
4. Drag a step back out onto empty canvas → it becomes loose; repeat until one step remains → stack dissolves, remaining capsule stays in place.
5. Hover a capsule → handle → drag onto a stack header → arrow; arrow from a stack header to a loose capsule; bit → bit; packet → packet.
6. Mark source bits done in the detail panel (double-click) → arrows turn green, targets show the ready ring; blocked targets show the lock.
7. Build a cycle → orange arrows/rings, HUD shows the cycle chip.
8. HUD card click → canvas springs to the stack, others dim; click again → undimmed.
9. Rename a stack via double-click on its name; reload → name persists.
10. Light and dark theme both readable.

- [ ] **Step 5: Final checks and commit**

Run: `npm run lint; npm run type-check; npm test` (repo root)
Expected: all pass.

```bash
git add -A
git commit -m "chore: verify bit and packet flow end to end" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Skip the commit if nothing changed.)
