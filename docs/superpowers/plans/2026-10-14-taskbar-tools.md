# Taskbar Tools (Flow & Filter) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first canvas tools to the taskbar: a lasso **Flow** tool that groups loose bits and stacks into a named, subtly tinted frame, and a **Filter** that dims bits not matching workflow state, priority or due date.

**Architecture:** Backend gains a `flow` table plus `flowId` on `bit` and `packet`; a shared `pruneEmptyFlows` helper enforces "no empty flows", PacketService keeps flow membership consistent when bits join/leave stacks. Frontend adds pure, unit-tested modules (`useFlowGroups`, `useFilter`), a `toolStore` (tool mode + filters) and `flowStore`, components (`LFlowFrame`, `LFilterPopover`, `LLassoPath`), extends the gestures/actions composables and wires everything into `LWorkspace` and `LTaskbar` (whose look stays unchanged).

**Tech Stack:** NestJS 12 + TypeORM (Postgres, `synchronize` in dev), class-validator, Vitest + FakeRepository (backend); Vue 3 `<script setup>` + TS, Pinia, Vitest + jsdom, lucide-vue-next, existing `helpers/motion.ts`.

**Spec:** `docs/superpowers/specs/2026-10-14-taskbar-tools-design.md`

## Global Constraints

- Taskbar design unchanged: corner SVGs, middle tab classes `flex-[0.7] … rounded-b-2xl bg-taskbar shadow-lg`, logo `<img>` exactly centered. Tools left (Select `MousePointer2`, Flow `Lasso`), Filter `ListFilter` far right.
- Tool buttons 32 px, radius 10 px, icon colour `var(--surface1)` (light on the dark light-mode tab, dark on the light dark-mode tab); active = 16 % icon-colour pill; filter badge in `--brand`.
- Shortcuts only when no input/textarea/contenteditable is focused: `V` select, `F` flow, `Esc` select + close popover (+ cancel lasso).
- Lasso: dashed `#a5b4fc`, 1.5 px, canvas coordinates; member = loose bit whose capsule centre / stack whose rect centre is inside the polygon; < 10 px screen path or no hit → nothing, tool stays `flow`; hit → flow "Flow N", colour `#818cf8`, tool → `select`.
- Flow frame ("dezent"): union of member rects + 24 px padding, +8 px extra at top; radius 22 px; 1 px line at 28 % flow colour; fill at 4.5 %; name on the top line, 20 px from the left, 11.5 px / 600, background `--surface1`.
- Flow colours: `#818cf8` `#34d399` `#fbbf24` `#f472b6` `#38bdf8` `#a3a3a3`.
- Membership: one flow max per loose bit / stack; bits in stacks have `flowId = null` and belong via the stack; joining a stack clears a bit's `flowId`; dissolving a stack hands its `flowId` to the freed bits; empty flows are deleted server-side; drop membership is measured against frames from before the drag; overlapping frames → newest (highest id) wins.
- Filter: groups Workflow (ready/blocked), Priority (3/2/1), Due (overdue/today/week = today … Sunday, Mon–Sun weeks, local time); OR within, AND across; non-matching bits dimmed (stack steps individually, stacks themselves not); arrow dimmed when neither end matches (packet end matches if any step matches); flow frames never dimmed; persisted in `localStorage` key `listion-filter`, errors ignored.
- Backend: `@UseGuards(JwtAuthGuard)` + `@Throttle({ default: { limit: 300, ttl: 60000 } })` at controller level, userId from `req.user.sub`, owner filter on every query, class-validator DTOs, Swagger on every endpoint; foreign/unknown ids → 404 (flowId on bit/packet) or 400 (member ids on flow create).
- Vue conventions: `<script setup lang="ts">`, `defineProps<>()`, typed emits, `L` prefix; strict TS, no `any` in frontend.
- Commits: Conventional Commits, body lines ≤ 100 chars, trailer `Co-Authored-By: Claude <model> <noreply@anthropic.com>` naming the authoring model.

## Review Focus

1. **Dragging a member of a flow out of its frame and back in** — membership must flip exactly once per drop and must be judged against the frame from before the drag (the live frame grows with the dragged item). Pinned in Task 8 (`dropBit` leave/join tests) and Task 6 (`flowAt`).
2. **Dissolving a stack that belongs to a flow** — the freed bits must stay in the flow, the flow must not be pruned. Pinned in Task 3 (`dissolve inherits flowId`).
3. **Lasso started on top of a capsule or stack** — must draw a lasso, not drag the node. Pinned in Task 9 (capture layer above nodes in flow mode; workspace test).
4. **Typing `v`/`f` in the bit panel or a rename input** — must not switch tools. Pinned in Task 5 (`handleShortcut` ignores editable targets).
5. **Corrupt `listion-filter` in localStorage** — app must start with empty filters. Pinned in Task 5.

---

## File Structure

**Backend (`backend/src`)**

| File | Responsibility |
|---|---|
| `modules/flow/flow.entity.ts` (new) | `Flow` entity, `DEFAULT_FLOW_COLOR` |
| `modules/flow/flow-membership.ts` (new) | `pruneEmptyFlows(flowIds, userId, repos)` |
| `modules/flow/flow.service.ts` (new) | flow CRUD with membership |
| `modules/flow/flow.controller.ts` (new) | `/api/flow` |
| `dto/create-flow.dto.ts`, `dto/update-flow.dto.ts` (new) | validation |
| `dto/update-bit.dto.ts`, `dto/update-packet.dto.ts` | `flowId` |
| `modules/bit/bit.entity.ts`, `modules/packet/packet.entity.ts` | `flowId` column |
| `modules/packet/packet.service.ts` | flow rules on assign/attach/dissolve/update, `assertFlow`, `pruneEmptyFlows` |
| `modules/bit/bit.service.ts` | `flowId` on update, prune on remove |
| `app.module.ts` | wire Flow |
| `DOCKER.md` (repo root) | production DDL for flows |

**Frontend (`frontend/src`)**

| File | Responsibility |
|---|---|
| `types/flow.ts` | `Flow`, `Packet.flowId?` |
| `stores/bitStore.ts` | `Bit.flowId?` |
| `stores/packetStore.ts` | `updatePacket` accepts `flowId` |
| `stores/flowStore.ts` (new) | flow API |
| `stores/toolStore.ts` (new) | tool mode, filter popover, filters + persistence, shortcuts |
| `composables/useFilter.ts` (new) | `matchesFilter`, `dueMatches` |
| `composables/useFlowGroups.ts` (new) | frames, polygon tests, lasso hits, `flowAt`, colours |
| `composables/useFlowGestures.ts` | lasso + flow-frame drag |
| `composables/useFlowActions.ts` | flows in snapshot, flow actions, drop membership |
| `components/LFlowFrame.vue`, `components/LFilterPopover.vue`, `components/LLassoPath.vue` (new) | presentation |
| `components/LPacketStack.vue` | `dimmedBitIds` prop |
| `layout/LTaskbar.vue` | tool buttons + filter popover |
| `views/LWorkspace.vue` | integration |

---

### Task 1: Backend data model, DTOs, docs

**Files:**
- Create: `backend/src/modules/flow/flow.entity.ts`, `backend/src/dto/create-flow.dto.ts`, `backend/src/dto/update-flow.dto.ts`
- Modify: `backend/src/modules/bit/bit.entity.ts`, `backend/src/modules/packet/packet.entity.ts`, `backend/src/dto/update-bit.dto.ts`, `backend/src/dto/update-packet.dto.ts`, `backend/src/app.module.ts`, `DOCKER.md`
- Test: `backend/src/dto/validation.spec.ts`

**Interfaces:**
- Produces: `Flow { id, user, name, color, createdAt }`, `DEFAULT_FLOW_COLOR = '#818cf8'`; `Bit.flowId?: number | null`; `Packet.flowId?: number | null`; `CreateFlowDto { name?, color?, bitIds, packetIds }`; `UpdateFlowDto { name?, color? }`; `UpdateBitDto.flowId?`, `UpdatePacketDto.flowId?` (number | null).

- [ ] **Step 1: Write the failing test** — append inside `describe('Request-Validierung', …)` in `backend/src/dto/validation.spec.ts` (add the imports at the top):

```ts
import { CreateFlowDto } from './create-flow.dto.js'
import { UpdateFlowDto } from './update-flow.dto.js'
import { UpdatePacketDto } from './update-packet.dto.js'
```

```ts
  it('validiert Flows und flowId', async () => {
    const flow = await validate(CreateFlowDto, { bitIds: [1], packetIds: [], user: 9 })
    expect(flow).toEqual({ bitIds: [1], packetIds: [] })
    await expect(
      validate(CreateFlowDto, { bitIds: [1], packetIds: [], color: 'blue' }),
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(
      validate(CreateFlowDto, { bitIds: [1, 1], packetIds: [] }),
    ).rejects.toBeInstanceOf(BadRequestException)
    await expect(validate(UpdateFlowDto, { name: '' })).rejects.toBeInstanceOf(BadRequestException)
    await expect(
      validate(UpdateFlowDto, { name: 'x'.repeat(61) }),
    ).rejects.toBeInstanceOf(BadRequestException)
    expect(await validate(UpdateFlowDto, { color: '#34d399' })).toEqual({ color: '#34d399' })
    expect(await validate(UpdateBitDto, { flowId: null })).toEqual({ flowId: null })
    expect(await validate(UpdatePacketDto, { flowId: 3 })).toEqual({ flowId: 3 })
  })
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend; npx vitest run src/dto/validation.spec.ts`
Expected: FAIL — cannot resolve `./create-flow.dto.js`.

- [ ] **Step 3: Implement**

`backend/src/modules/flow/flow.entity.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger'
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm'

export const DEFAULT_FLOW_COLOR = '#818cf8'

/** A named group of loose bits and packets, drawn as a frame on the canvas. */
@Entity()
export class Flow {
  @ApiProperty()
  @PrimaryGeneratedColumn()
  id!: number

  @Column()
  user!: number

  @ApiProperty({ example: 'Release Q4' })
  @Column({ type: 'varchar', length: 60 })
  name!: string

  @ApiProperty({ example: DEFAULT_FLOW_COLOR })
  @Column({ type: 'varchar', length: 7, default: DEFAULT_FLOW_COLOR })
  color!: string

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date
}
```

`backend/src/modules/bit/bit.entity.ts` — add after `order`:

```ts
  // only loose bits carry a flow; bits inside a packet belong to it through their packet
  @Column({ type: 'int', nullable: true })
  flowId?: number | null
```

`backend/src/modules/packet/packet.entity.ts` — add before `createdAt`:

```ts
  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'int', nullable: true })
  flowId?: number | null
```

`backend/src/dto/create-flow.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger'
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator'

export class CreateFlowDto {
  @ApiProperty({ example: 'Release Q4', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name?: string

  @ApiProperty({ example: '#818cf8', required: false })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color?: string

  @ApiProperty({ type: [Number], example: [1, 4], description: 'Loose bits to put into the flow' })
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  bitIds!: number[]

  @ApiProperty({ type: [Number], example: [2], description: 'Packets to put into the flow' })
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  packetIds!: number[]
}
```

`backend/src/dto/update-flow.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator'

export class UpdateFlowDto {
  @ApiProperty({ example: 'Release Q4', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name?: string

  @ApiProperty({ example: '#34d399', required: false })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color?: string
}
```

`backend/src/dto/update-bit.dto.ts` — add to the class:

```ts
  @ApiProperty({
    required: false,
    nullable: true,
    example: 2,
    description: 'Put the loose bit into this flow, or null to take it out',
  })
  @IsOptional()
  @IsInt()
  flowId?: number | null
```

`backend/src/dto/update-packet.dto.ts` — add to the class:

```ts
  @ApiProperty({ example: 2, required: false, nullable: true })
  @IsOptional()
  @IsInt()
  flowId?: number | null
```

`backend/src/app.module.ts` — import `Flow` from `./modules/flow/flow.entity.js` and add it to both `entities: [...]` and `TypeOrmModule.forFeature([...])`.

`DOCKER.md` — in the section "Upgrading an existing production database (bit/packet flow)" append a sub-section:

````markdown
### Taskbar tools (flows)

```sql
CREATE TABLE "flow" ("id" SERIAL PRIMARY KEY, "user" integer NOT NULL, "name" varchar(60) NOT NULL,
  "color" varchar(7) NOT NULL DEFAULT '#818cf8', "createdAt" TIMESTAMP NOT NULL DEFAULT now());
ALTER TABLE "bit" ADD COLUMN "flowId" integer NULL;
ALTER TABLE "packet" ADD COLUMN "flowId" integer NULL;
```
````

- [ ] **Step 4: Run tests and type-check**

Run: `cd backend; npx vitest run; npx tsc --noEmit -p tsconfig.json`
Expected: PASS, exit 0.

- [ ] **Step 5: Commit**

```bash
git add backend DOCKER.md
git commit -m "feat(backend): add flow data model" -m "Co-Authored-By: Claude <model> <noreply@anthropic.com>"
```

---

### Task 2: FlowService, pruneEmptyFlows and `/api/flow`

**Files:**
- Create: `backend/src/modules/flow/flow-membership.ts`, `backend/src/modules/flow/flow.service.ts`, `backend/src/modules/flow/flow.controller.ts`
- Modify: `backend/src/app.module.ts`
- Test: `backend/src/modules/flow/flow.service.spec.ts`

**Interfaces:**
- Consumes: `Flow`, `Bit`, `Packet`, DTOs (Task 1), `FakeRepository`.
- Produces: `pruneEmptyFlows(flowIds: (number | null | undefined)[], userId: number, repos: { flows: Repository<Flow>; bits: Repository<Bit>; packets: Repository<Packet> }): Promise<void>`; `FlowService(flows, bits, packets)` with `findAll`, `findOne(id, userId)`, `create(dto, userId)`, `update(id, userId, dto)`, `remove(id, userId)`.

- [ ] **Step 1: Write the failing test** — `backend/src/modules/flow/flow.service.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { FakeRepository } from '../../testing/fake-repository.js'
import { FlowService } from './flow.service.js'
import type { Flow } from './flow.entity.js'
import type { Bit } from '../bit/bit.entity.js'
import type { Packet } from '../packet/packet.entity.js'

function setup() {
  const bits = new FakeRepository<Bit>(
    [
      { id: 1, user: 5 },
      { id: 2, user: 5 },
      { id: 3, user: 5, packetId: 10 },
      { id: 9, user: 6 },
    ],
    { packetId: null, order: 0, flowId: null, status: 0, title: 't' } as Partial<Bit>,
  )
  const packets = new FakeRepository<Packet>(
    [{ id: 10, user: 5, name: 'P', x: 0, y: 0 }],
    { flowId: null } as Partial<Packet>,
  )
  const flows = new FakeRepository<Flow>()
  const service = new FlowService(flows.asRepo(), bits.asRepo(), packets.asRepo())
  const bit = (id: number) => bits.rows.find((b) => b.id === id)!
  const packet = (id: number) => packets.rows.find((p) => p.id === id)!
  return { service, bits, packets, flows, bit, packet }
}

describe('FlowService', () => {
  it('legt einen Flow mit Standardname und -farbe an und setzt die Mitglieder', async () => {
    const { service, bit, packet } = setup()
    const flow = await service.create({ bitIds: [1], packetIds: [10] }, 5)
    expect(flow).toMatchObject({ name: 'Flow 1', color: '#818cf8', user: 5 })
    expect(bit(1).flowId).toBe(flow.id)
    expect(packet(10).flowId).toBe(flow.id)
  })

  it('übernimmt Mitglieder aus einem alten Flow und löscht ihn, wenn er leer wird', async () => {
    const { service, flows } = setup()
    const old = await service.create({ bitIds: [1], packetIds: [] }, 5)
    const keep = await service.create({ bitIds: [2], packetIds: [10] }, 5)
    await service.create({ bitIds: [1], packetIds: [10] }, 5)
    const ids = flows.rows.map((f) => f.id)
    expect(ids).not.toContain(old.id)
    expect(ids).toContain(keep.id) // still has bit 2
  })

  it.each([
    ['ohne Mitglieder', { bitIds: [], packetIds: [] }],
    ['mit fremdem Bit', { bitIds: [9], packetIds: [] }],
    ['mit Bit in einem Stapel', { bitIds: [3], packetIds: [] }],
    ['mit unbekanntem Packet', { bitIds: [], packetIds: [99] }],
  ])('lehnt einen Flow %s ab', async (_name, dto) => {
    const { service, flows } = setup()
    await expect(service.create(dto, 5)).rejects.toBeInstanceOf(BadRequestException)
    expect(flows.rows).toHaveLength(0)
  })

  it('benennt um und färbt um, fremde Flows sind unbekannt', async () => {
    const { service, flows } = setup()
    const flow = await service.create({ bitIds: [1], packetIds: [] }, 5)
    expect(await service.update(flow.id, 5, { name: 'Release', color: '#34d399' })).toMatchObject({
      name: 'Release',
      color: '#34d399',
    })
    await expect(service.update(flow.id, 6, { name: 'x' })).rejects.toBeInstanceOf(
      NotFoundException,
    )
    expect(flows.rows[0]!.name).toBe('Release')
  })

  it('auflösen behält die Mitglieder', async () => {
    const { service, flows, bit, packet } = setup()
    const flow = await service.create({ bitIds: [1], packetIds: [10] }, 5)
    await service.remove(flow.id, 5)
    expect(flows.rows).toHaveLength(0)
    expect(bit(1)).toMatchObject({ id: 1, flowId: null })
    expect(packet(10)).toMatchObject({ id: 10, flowId: null })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend; npx vitest run src/modules/flow`
Expected: FAIL — cannot resolve `./flow.service.js`.

- [ ] **Step 3: Implement**

`backend/src/modules/flow/flow-membership.ts`:

```ts
import type { Repository } from 'typeorm'
import type { Flow } from './flow.entity.js'
import type { Bit } from '../bit/bit.entity.js'
import type { Packet } from '../packet/packet.entity.js'

export interface FlowRepos {
  flows: Repository<Flow>
  bits: Repository<Bit>
  packets: Repository<Packet>
}

/**
 * A flow without members cannot exist. Members are loose bits and packets carrying its id
 * (bits inside a packet never carry a flowId), so both are counted.
 */
export async function pruneEmptyFlows(
  flowIds: (number | null | undefined)[],
  userId: number,
  repos: FlowRepos,
): Promise<void> {
  for (const id of new Set(flowIds.filter((f): f is number => f != null))) {
    const bits = await repos.bits.count({ where: { flowId: id, user: userId } })
    const packets = await repos.packets.count({ where: { flowId: id, user: userId } })
    if (bits + packets === 0) await repos.flows.delete({ id, user: userId })
  }
}
```

`backend/src/modules/flow/flow.service.ts`:

```ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { In, Repository } from 'typeorm'
import { DEFAULT_FLOW_COLOR, Flow } from './flow.entity.js'
import { pruneEmptyFlows, type FlowRepos } from './flow-membership.js'
import { Bit } from '../bit/bit.entity.js'
import { Packet } from '../packet/packet.entity.js'
import { CreateFlowDto } from '../../dto/create-flow.dto.js'
import { UpdateFlowDto } from '../../dto/update-flow.dto.js'

@Injectable()
export class FlowService {
  constructor(
    @InjectRepository(Flow)
    private readonly flows: Repository<Flow>,
    @InjectRepository(Bit)
    private readonly bits: Repository<Bit>,
    @InjectRepository(Packet)
    private readonly packets: Repository<Packet>,
  ) {}

  private get repos(): FlowRepos {
    return { flows: this.flows, bits: this.bits, packets: this.packets }
  }

  findAll(userId: number): Promise<Flow[]> {
    return this.flows.find({ where: { user: userId } })
  }

  async findOne(id: number, userId: number): Promise<Flow> {
    const flow = await this.flows.findOne({ where: { id, user: userId } })
    if (!flow) throw new NotFoundException('Flow not found')
    return flow
  }

  async create(dto: CreateFlowDto, userId: number): Promise<Flow> {
    if (dto.bitIds.length + dto.packetIds.length === 0) {
      throw new BadRequestException('A flow needs at least one member')
    }
    const bits =
      dto.bitIds.length > 0
        ? await this.bits.find({ where: { id: In(dto.bitIds), user: userId } })
        : []
    if (bits.length !== dto.bitIds.length) throw new BadRequestException('Unknown bit')
    if (bits.some((b) => b.packetId != null)) {
      throw new BadRequestException('Bits inside a packet belong to a flow through their packet')
    }
    const packets =
      dto.packetIds.length > 0
        ? await this.packets.find({ where: { id: In(dto.packetIds), user: userId } })
        : []
    if (packets.length !== dto.packetIds.length) throw new BadRequestException('Unknown packet')

    const count = await this.flows.count({ where: { user: userId } })
    const flow = await this.flows.save(
      this.flows.create({
        user: userId,
        name: dto.name ?? `Flow ${count + 1}`,
        color: dto.color ?? DEFAULT_FLOW_COLOR,
      }),
    )
    if (dto.bitIds.length > 0) {
      await this.bits.update({ id: In(dto.bitIds), user: userId }, { flowId: flow.id })
    }
    if (dto.packetIds.length > 0) {
      await this.packets.update({ id: In(dto.packetIds), user: userId }, { flowId: flow.id })
    }
    await pruneEmptyFlows(
      [...bits, ...packets].map((m) => m.flowId),
      userId,
      this.repos,
    )
    return flow
  }

  async update(id: number, userId: number, dto: UpdateFlowDto): Promise<Flow> {
    await this.findOne(id, userId)
    // TypeORM rejects an UPDATE without values, so an empty PUT body is a no-op here.
    if (Object.keys(dto).length > 0) await this.flows.update({ id, user: userId }, dto)
    return this.findOne(id, userId)
  }

  /** Dissolve the flow; its members stay where they are. */
  async remove(id: number, userId: number): Promise<void> {
    await this.findOne(id, userId)
    await this.bits.update({ flowId: id, user: userId }, { flowId: null })
    await this.packets.update({ flowId: id, user: userId }, { flowId: null })
    await this.flows.delete({ id, user: userId })
  }
}
```

`backend/src/modules/flow/flow.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import type { Request } from 'express'
import { JwtAuthGuard } from '../user/jwt-auth.guard.js'
import { FlowService } from './flow.service.js'
import { Flow } from './flow.entity.js'
import { CreateFlowDto } from '../../dto/create-flow.dto.js'
import { UpdateFlowDto } from '../../dto/update-flow.dto.js'

@ApiTags('Flow')
@Controller('flow')
@UseGuards(JwtAuthGuard)
// same canvas burst budget as the other flow controllers
@Throttle({ default: { limit: 300, ttl: 60000 } })
export class FlowController {
  constructor(private readonly flowService: FlowService) {}

  @Get()
  @ApiOperation({ summary: 'Get all flows (canvas groups) of the current user' })
  @ApiResponse({ status: 200, type: [Flow] })
  findAll(@Req() req: Request) {
    const userId = (req as any).user.sub as number
    return this.flowService.findAll(userId)
  }

  @Post()
  @ApiOperation({ summary: 'Create a flow from loose bits and packets' })
  @ApiResponse({ status: 201, type: Flow })
  create(@Body() dto: CreateFlowDto, @Req() req: Request) {
    const userId = (req as any).user.sub as number
    return this.flowService.create(dto, userId)
  }

  @Put(':id')
  @ApiOperation({ summary: 'Rename or recolour a flow' })
  @ApiResponse({ status: 200, type: Flow })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateFlowDto, @Req() req: Request) {
    const userId = (req as any).user.sub as number
    return this.flowService.update(id, userId, dto)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Dissolve a flow (its members stay)' })
  @ApiResponse({ status: 200 })
  async remove(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const userId = (req as any).user.sub as number
    await this.flowService.remove(id, userId)
    return { message: 'Deleted' }
  }
}
```

`backend/src/app.module.ts` — import `FlowService` / `FlowController` and add them to `providers` / `controllers`.

- [ ] **Step 4: Run tests**

Run: `cd backend; npx vitest run; npx tsc --noEmit -p tsconfig.json; npx eslint "src/**/*.ts"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "feat(backend): add flow endpoints with membership rules" -m "Co-Authored-By: Claude <model> <noreply@anthropic.com>"
```

---

### Task 3: Flow rules in PacketService and BitService

**Files:**
- Modify: `backend/src/modules/packet/packet.service.ts`, `backend/src/modules/bit/bit.service.ts`
- Test: `backend/src/modules/packet/packet.service.spec.ts`, `backend/src/modules/bit/bit.service.spec.ts`, `backend/src/modules/dependency/dependency.service.spec.ts` (constructor call only if it builds a PacketService — it does not; leave it)

**Interfaces:**
- Consumes: `Flow`, `pruneEmptyFlows`, `FlowRepos` (Tasks 1–2).
- Produces: `PacketService(packets, bits, deps, flows)` (new 4th constructor arg) with new public `assertFlow(flowId, userId): Promise<void>` (404 if unknown/foreign) and `pruneEmptyFlows(flowIds, userId): Promise<void>`; `update` accepts `flowId`; joining a stack clears `bit.flowId`; dissolving hands `packet.flowId` to freed bits. `BitService.update` accepts `flowId`; `remove` prunes.

- [ ] **Step 1: Write the failing tests**

In `backend/src/modules/packet/packet.service.spec.ts`: change `setup()` to add a flows repo and pass it as 4th constructor argument, give the bit defaults `flowId: null`, and append tests:

```ts
import type { Flow } from '../flow/flow.entity.js'
// in setup():
  const flows = new FakeRepository<Flow>()
  const service = new PacketService(packets.asRepo(), bits.asRepo(), deps.asRepo(), flows.asRepo())
  return { service, bits, packets, deps, flows, member }
// and add `flowId: null` to the bit defaults object
```

```ts
  it('ein Bit, das einem Stapel beitritt, verliert seinen Flow; ein leerer Flow verschwindet', async () => {
    const { service, flows, member } = setup()
    flows.rows.push({ id: 70, user: 5, name: 'F', color: '#818cf8', createdAt: new Date() })
    member(1).flowId = 70
    await service.create({ x: 0, y: 0, bitIds: [1, 2] }, 5)
    expect(member(1).flowId).toBeNull()
    expect(flows.rows).toHaveLength(0)
  })

  it('beim Auflösen eines Stapels erben die Bits seinen Flow', async () => {
    const { service, packets, flows, member } = setup()
    flows.rows.push({ id: 70, user: 5, name: 'F', color: '#818cf8', createdAt: new Date() })
    const p = await service.create({ x: 0, y: 0, bitIds: [1, 2] }, 5)
    packets.rows.find((r) => r.id === p.id)!.flowId = 70
    await service.detachBit(1, 5) // leaves only bit 2 → dissolve
    expect(member(2).flowId).toBe(70)
    expect(flows.rows.map((f) => f.id)).toEqual([70])
  })

  it('update setzt flowId nur auf eigene Flows und räumt den alten Flow auf', async () => {
    const { service, packets, flows } = setup()
    flows.rows.push(
      { id: 70, user: 5, name: 'A', color: '#818cf8', createdAt: new Date() },
      { id: 71, user: 5, name: 'B', color: '#818cf8', createdAt: new Date() },
      { id: 80, user: 6, name: 'X', color: '#818cf8', createdAt: new Date() },
    )
    const p = await service.create({ x: 0, y: 0, bitIds: [1, 2] }, 5)
    packets.rows.find((r) => r.id === p.id)!.flowId = 70
    await expect(service.update(p.id, 5, { flowId: 80 })).rejects.toBeInstanceOf(NotFoundException)
    await service.update(p.id, 5, { flowId: 71 })
    expect(packets.rows.find((r) => r.id === p.id)!.flowId).toBe(71)
    expect(flows.rows.map((f) => f.id)).toEqual([71, 80])
  })
```

In `backend/src/modules/bit/bit.service.spec.ts`: update `setup()` to create a flows repo, pass it to `new PacketService(packets.asRepo(), bits.asRepo(), deps.asRepo(), flows.asRepo())`, return `flows`, add `flowId: null` to bit defaults, and append:

```ts
import { BadRequestException } from '@nestjs/common'
import type { Flow } from '../flow/flow.entity.js'
```

```ts
  it('flowId setzt ein loses Bit in einen Flow und räumt den alten auf', async () => {
    const { service, flows, member } = await setup()
    flows.rows.push(
      { id: 70, user: 5, name: 'A', color: '#818cf8', createdAt: new Date() },
      { id: 71, user: 5, name: 'B', color: '#818cf8', createdAt: new Date() },
    )
    member(3)!.flowId = 70
    await service.update(3, 5, { flowId: 71 })
    expect(member(3)!.flowId).toBe(71)
    expect(flows.rows.map((f) => f.id)).toEqual([71])
  })

  it('ein Bit in einem Stapel kann keinen eigenen Flow haben', async () => {
    const { service, flows } = await setup()
    flows.rows.push({ id: 70, user: 5, name: 'A', color: '#818cf8', createdAt: new Date() })
    await expect(service.update(1, 5, { flowId: 70 })).rejects.toBeInstanceOf(BadRequestException)
  })

  it('aus dem Stapel lösen und gleichzeitig in einen Flow setzen ist erlaubt', async () => {
    const { service, flows, member } = await setup()
    flows.rows.push({ id: 70, user: 5, name: 'A', color: '#818cf8', createdAt: new Date() })
    await service.update(1, 5, { packetId: null, flowId: 70, x: 5, y: 6 })
    expect(member(1)).toMatchObject({ packetId: null, flowId: 70, x: 5, y: 6 })
  })

  it('remove löscht einen Flow, der dadurch leer wird', async () => {
    const { service, flows, member } = await setup()
    flows.rows.push({ id: 70, user: 5, name: 'A', color: '#818cf8', createdAt: new Date() })
    member(3)!.flowId = 70
    await service.remove(3, 5)
    expect(flows.rows).toHaveLength(0)
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd backend; npx vitest run src/modules/packet src/modules/bit`
Expected: FAIL (constructor arity / flow rules missing).

- [ ] **Step 3: Implement**

`packet.service.ts`:

1. Imports: add `import { Flow } from '../flow/flow.entity.js'` and `import { pruneEmptyFlows } from '../flow/flow-membership.js'`.
2. Constructor: add a 4th parameter

```ts
    @InjectRepository(Flow)
    private readonly flows: Repository<Flow>,
```

3. Add public helpers:

```ts
  /** 404 unless the flow exists and belongs to the user. */
  async assertFlow(flowId: number, userId: number): Promise<void> {
    const flow = await this.flows.findOne({ where: { id: flowId, user: userId } })
    if (!flow) throw new NotFoundException('Flow not found')
  }

  pruneEmptyFlows(flowIds: (number | null | undefined)[], userId: number): Promise<void> {
    return pruneEmptyFlows(flowIds, userId, {
      flows: this.flows,
      bits: this.bits,
      packets: this.packets,
    })
  }
```

4. `create`: after `await this.dissolveSmall(previousPackets(owned, packet.id), userId)` add `await this.pruneEmptyFlows(owned.map((b) => b.flowId), userId)`.
5. `setBits`: same line after its `dissolveSmall`.
6. `update`: replace the body with

```ts
    const packet = await this.findOne(id, userId)
    if (typeof dto.flowId === 'number') await this.assertFlow(dto.flowId, userId)
    // TypeORM rejects an UPDATE without values, so an empty PUT body is a no-op here.
    if (Object.keys(dto).length > 0) {
      await this.packets.update({ id, user: userId }, dto)
    }
    if (dto.flowId !== undefined && dto.flowId !== packet.flowId) {
      await this.pruneEmptyFlows([packet.flowId], userId)
    }
    return this.findOne(id, userId)
```

7. `attachBit`: change the update to `{ packetId, order, flowId: null }` and after `dropOwnPacketDeps` add `await this.pruneEmptyFlows([bit.flowId], userId)`.
8. `assign`: change the update to `{ packetId, order, flowId: null }`.
9. `dissolve`: replace with

```ts
  private async dissolve(id: number, userId: number): Promise<void> {
    const packet = await this.packets.findOne({ where: { id, user: userId } })
    // freed bits keep the packet's flow, so dissolving a stack inside a flow keeps it there
    await this.bits.update(
      { packetId: id, user: userId },
      { packetId: null, order: 0, flowId: packet?.flowId ?? null },
    )
    await this.deps.delete({ userId, fromType: 'packet', fromId: id })
    await this.deps.delete({ userId, toType: 'packet', toId: id })
    await this.packets.delete({ id, user: userId })
    await this.pruneEmptyFlows([packet?.flowId], userId)
  }
```

`bit.service.ts` — add `BadRequestException` to the `@nestjs/common` import and replace `update` / `remove`:

```ts
  async update(id: number, userId: number, updateBitDto: UpdateBitDto): Promise<Bit> {
    const bit = await this.findOne(id, userId) // throws 404 if not found or not owned
    const { packetId, flowId, ...fields } = updateBitDto
    // validate before any write
    if (typeof packetId === 'number') await this.packetService.findOne(packetId, userId)
    if (typeof flowId === 'number') {
      await this.packetService.assertFlow(flowId, userId)
      const inPacketAfter = typeof packetId === 'number' || (bit.packetId != null && packetId !== null)
      if (inPacketAfter) {
        throw new BadRequestException('Bits inside a packet belong to a flow through their packet')
      }
    }
    if (packetId === null) await this.packetService.detachBit(id, userId)
    const write = flowId === undefined ? fields : { ...fields, flowId }
    if (Object.keys(write).length > 0) {
      await this.bitRepository.update({ id, user: userId }, write)
    }
    if (typeof packetId === 'number') await this.packetService.attachBit(id, packetId, userId)
    if (flowId !== undefined && flowId !== bit.flowId) {
      await this.packetService.pruneEmptyFlows([bit.flowId], userId)
    }
    return this.findOne(id, userId)
  }

  async remove(id: number, userId: number): Promise<void> {
    const bit = await this.findOne(id, userId) // throws 404 if not found or not owned
    await this.deps.delete({ userId, fromType: 'bit', fromId: id })
    await this.deps.delete({ userId, toType: 'bit', toId: id })
    await this.bitRepository.delete({ id, user: userId })
    if (bit.packetId != null) await this.packetService.dissolveSmall([bit.packetId], userId)
    await this.packetService.pruneEmptyFlows([bit.flowId], userId)
  }
```

- [ ] **Step 4: Run all backend checks**

Run: `cd backend; npx vitest run; npx tsc --noEmit -p tsconfig.json; npx eslint "src/**/*.ts"`
Expected: PASS (all previous tests still green).

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "feat(backend): keep flow membership consistent with packets" -m "Co-Authored-By: Claude <model> <noreply@anthropic.com>"
```

---

### Task 4: Frontend types, flowStore, flows in the snapshot

**Files:**
- Modify: `frontend/src/types/flow.ts`, `frontend/src/stores/bitStore.ts`, `frontend/src/stores/packetStore.ts`, `frontend/src/composables/useFlowActions.ts`
- Create: `frontend/src/stores/flowStore.ts`
- Test: `frontend/src/stores/flowStores.test.ts` (append), `frontend/src/composables/useFlowActions.test.ts` (append)

**Interfaces:**
- Produces: `interface Flow { id: number; name: string; color: string }`; `Packet.flowId?: number | null`; `Bit.flowId?: number | null`; `useFlowStore()` → `flows`, `fetchFlows()`, `createFlow({ name?, color?, bitIds, packetIds }): Promise<Flow>`, `updateFlow(id, { name?, color? })` (optimistic, rollback on error), `deleteFlow(id)`; `packetStore.updatePacket(id, Partial<Pick<Packet,'name'|'x'|'y'|'flowId'>>)`; `useFlowActions().reloadAll()` also loads `/api/flow` into `flowStore.flows` in the same synchronous commit.

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/stores/flowStores.test.ts`:

```ts
import { useFlowStore } from './flowStore'

describe('flowStore', () => {
  it('legt Flows an, benennt optimistisch um und rollt bei Fehler zurück', async () => {
    const store = useFlowStore()
    api.post.mockResolvedValue({ data: { id: 4, name: 'Flow 1', color: '#818cf8' } })
    await store.createFlow({ bitIds: [1], packetIds: [] })
    expect(api.post).toHaveBeenCalledWith('/api/flow', { bitIds: [1], packetIds: [] })
    let reject!: (e: Error) => void
    api.put.mockReturnValue(new Promise((_, r) => (reject = r)))
    const pending = store.updateFlow(4, { name: 'Release' })
    expect(store.flows[0]!.name).toBe('Release')
    reject(new Error('offline'))
    await expect(pending).rejects.toThrow('offline')
    expect(store.flows[0]!.name).toBe('Flow 1')
  })
})
```

Append to `frontend/src/composables/useFlowActions.test.ts` inside the existing `describe` (or a new one):

```ts
import { useFlowStore } from '@/stores/flowStore'

describe('useFlowActions.reloadAll', () => {
  it('lädt Flows zusammen mit Bits, Packets und Pfeilen', async () => {
    api.get.mockImplementation((url: string) =>
      Promise.resolve({ data: url === '/api/flow' ? [{ id: 1, name: 'F', color: '#818cf8' }] : [] }),
    )
    await useFlowActions().reloadAll()
    expect(useFlowStore().flows).toEqual([{ id: 1, name: 'F', color: '#818cf8' }])
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd frontend; npx vitest run src/stores/flowStores.test.ts src/composables/useFlowActions.test.ts`
Expected: FAIL — `./flowStore` missing.

- [ ] **Step 3: Implement**

`frontend/src/types/flow.ts` — add `flowId?: number | null` to `Packet` and:

```ts
/** A named group of loose bits and packets, drawn as a frame on the canvas. */
export interface Flow {
  id: number
  name: string
  color: string
}
```

`frontend/src/stores/bitStore.ts` — add to `Bit` after `order`: `flowId?: number | null`.

`frontend/src/stores/packetStore.ts` — change the `updatePacket` updates type to `Partial<Pick<Packet, 'name' | 'x' | 'y' | 'flowId'>>`.

`frontend/src/stores/flowStore.ts`:

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/helpers/api'
import type { Flow } from '@/types/flow'

export const useFlowStore = defineStore('flow', () => {
  const flows = ref<Flow[]>([])

  async function fetchFlows(): Promise<void> {
    const res = await api.get<Flow[]>('/api/flow')
    flows.value = res.data
  }

  async function createFlow(payload: {
    name?: string
    color?: string
    bitIds: number[]
    packetIds: number[]
  }): Promise<Flow> {
    const res = await api.post<Flow>('/api/flow', payload)
    flows.value.push(res.data)
    return res.data
  }

  // Optimistic: the frame must not flicker back while the request is in flight
  async function updateFlow(
    id: number,
    updates: Partial<Pick<Flow, 'name' | 'color'>>,
  ): Promise<void> {
    const idx = flows.value.findIndex((f) => f.id === id)
    const before = idx !== -1 ? { ...flows.value[idx]! } : null
    if (idx !== -1) flows.value[idx] = { ...flows.value[idx]!, ...updates }
    try {
      await api.put(`/api/flow/${id}`, updates)
    } catch (e) {
      const at = flows.value.findIndex((f) => f.id === id)
      if (before && at !== -1) flows.value[at] = before
      throw e
    }
  }

  async function deleteFlow(id: number): Promise<void> {
    await api.delete(`/api/flow/${id}`)
    flows.value = flows.value.filter((f) => f.id !== id)
  }

  return { flows, fetchFlows, createFlow, updateFlow, deleteFlow }
})
```

`frontend/src/composables/useFlowActions.ts`:
- import `useFlowStore` and `Flow`; add `const flowStore = useFlowStore()`;
- `fetchSnapshot` returns `{ bits, packets, dependencies, flows }`, adding `api.get<Flow[]>('/api/flow')` to the `Promise.all`;
- `commit` gains the `flows` field and assigns `flowStore.flows = snapshot.flows` in the same block;
- update the `fetchSnapshot` return type and `commit` parameter type accordingly.

- [ ] **Step 4: Run tests**

Run: `cd frontend; npx vitest run src/stores src/composables`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): add flow store and load flows with the workspace" -m "Co-Authored-By: Claude <model> <noreply@anthropic.com>"
```

---

### Task 5: toolStore and useFilter

**Files:**
- Create: `frontend/src/stores/toolStore.ts`, `frontend/src/composables/useFilter.ts`
- Test: `frontend/src/stores/toolStore.test.ts`, `frontend/src/composables/useFilter.test.ts`

**Interfaces:**
- Produces: `type Tool = 'select' | 'flow'`; `type WorkflowFilter = 'ready' | 'blocked'`; `type DueFilter = 'overdue' | 'today' | 'week'`; `interface FilterState { workflow: WorkflowFilter[]; priority: number[]; due: DueFilter[] }`; `FILTER_STORAGE_KEY = 'listion-filter'`; `useToolStore()` → `activeTool`, `filterOpen`, `filters`, `activeFilterCount`, `setTool(t)`, `toggleFilter(group, value)`, `resetFilters()`, `handleShortcut(e: KeyboardEvent): boolean`; `dueMatches(due, kinds, today): boolean`; `matchesFilter(bit, state, filters, today = new Date()): boolean`.

- [ ] **Step 1: Write the failing tests**

`frontend/src/composables/useFilter.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { Bit } from '@/stores/bitStore'
import { dueMatches, matchesFilter } from './useFilter'

// Wednesday 14 Oct 2026, 15:00 local → week runs Mon 12 … Sun 18
const TODAY = new Date(2026, 9, 14, 15, 0)
const day = (d: number) => new Date(2026, 9, d, 9, 30).toISOString()
const bit = (extra: Partial<Bit> = {}): Bit => ({
  id: 1,
  title: 'B',
  status: 0,
  x: 0,
  y: 0,
  packetId: null,
  order: 0,
  createdAt: '',
  ...extra,
})
const none = { workflow: [], priority: [], due: [] }

describe('dueMatches', () => {
  it.each([
    [day(13), ['overdue'], true],
    [day(14), ['overdue'], false],
    [day(14), ['today'], true],
    [day(15), ['today'], false],
    [day(14), ['week'], true],
    [day(18), ['week'], true],
    [day(19), ['week'], false],
    [day(13), ['week'], false],
    [day(19), ['today', 'overdue'], false],
  ] as const)('%s / %o → %s', (due, kinds, expected) => {
    expect(dueMatches(due, [...kinds], TODAY)).toBe(expected)
  })

  it('ohne Datum passt kein Fälligkeitsfilter', () => {
    expect(dueMatches(undefined, ['today'], TODAY)).toBe(false)
  })
})

describe('matchesFilter', () => {
  it('ohne Auswahl passt alles', () => {
    expect(matchesFilter(bit(), null, none, TODAY)).toBe(true)
  })

  it('ODER innerhalb einer Gruppe', () => {
    const f = { ...none, priority: [3, 2] }
    expect(matchesFilter(bit({ priority: 2 }), null, f, TODAY)).toBe(true)
    expect(matchesFilter(bit({ priority: 1 }), null, f, TODAY)).toBe(false)
    expect(matchesFilter(bit(), null, f, TODAY)).toBe(false)
  })

  it('UND zwischen Gruppen', () => {
    const f = { workflow: ['ready' as const], priority: [3], due: [] }
    expect(matchesFilter(bit({ priority: 3 }), 'ready', f, TODAY)).toBe(true)
    expect(matchesFilter(bit({ priority: 3 }), 'blocked', f, TODAY)).toBe(false)
    expect(matchesFilter(bit({ priority: 1 }), 'ready', f, TODAY)).toBe(false)
    expect(matchesFilter(bit({ priority: 3 }), null, f, TODAY)).toBe(false)
  })

  it('Fälligkeit als Gruppe', () => {
    const f = { ...none, due: ['today' as const] }
    expect(matchesFilter(bit({ dueDate: day(14) }), null, f, TODAY)).toBe(true)
    expect(matchesFilter(bit({ dueDate: day(16) }), null, f, TODAY)).toBe(false)
  })
})
```

`frontend/src/stores/toolStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { FILTER_STORAGE_KEY, useToolStore } from './toolStore'

function key(k: string, target: EventTarget = document.body, extra: KeyboardEventInit = {}) {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, ...extra })
  Object.defineProperty(e, 'target', { value: target })
  return e
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('toolStore', () => {
  it('V / F / Esc schalten Werkzeuge, Esc schließt den Filter', () => {
    const s = useToolStore()
    expect(s.handleShortcut(key('f'))).toBe(true)
    expect(s.activeTool).toBe('flow')
    s.filterOpen = true
    expect(s.handleShortcut(key('Escape'))).toBe(true)
    expect(s.activeTool).toBe('select')
    expect(s.filterOpen).toBe(false)
    s.setTool('flow')
    s.handleShortcut(key('V'))
    expect(s.activeTool).toBe('select')
  })

  it('ignoriert Kürzel in Eingabefeldern und mit Modifikatoren', () => {
    const s = useToolStore()
    const input = document.createElement('input')
    const textarea = document.createElement('textarea')
    const editable = document.createElement('div')
    editable.contentEditable = 'true'
    expect(s.handleShortcut(key('f', input))).toBe(false)
    expect(s.handleShortcut(key('f', textarea))).toBe(false)
    expect(s.handleShortcut(key('f', editable))).toBe(false)
    expect(s.handleShortcut(key('f', document.body, { ctrlKey: true }))).toBe(false)
    expect(s.activeTool).toBe('select')
  })

  it('zählt, speichert und setzt Filter zurück', () => {
    const s = useToolStore()
    s.toggleFilter('workflow', 'ready')
    s.toggleFilter('priority', 3)
    s.toggleFilter('due', 'today')
    s.toggleFilter('due', 'today')
    expect(s.activeFilterCount).toBe(2)
    expect(JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY)!)).toEqual({
      workflow: ['ready'],
      priority: [3],
      due: [],
    })
    setActivePinia(createPinia())
    expect(useToolStore().activeFilterCount).toBe(2)
    useToolStore().resetFilters()
    expect(useToolStore().activeFilterCount).toBe(0)
  })

  it('startet mit leeren Filtern bei kaputtem localStorage', () => {
    localStorage.setItem(FILTER_STORAGE_KEY, '{not json')
    expect(useToolStore().filters).toEqual({ workflow: [], priority: [], due: [] })
    setActivePinia(createPinia())
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({ workflow: 'x', priority: [9, 2] }))
    expect(useToolStore().filters).toEqual({ workflow: [], priority: [2], due: [] })
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd frontend; npx vitest run src/stores/toolStore.test.ts src/composables/useFilter.test.ts`
Expected: FAIL — modules missing.

- [ ] **Step 3: Implement**

`frontend/src/composables/useFilter.ts`:

```ts
import type { Bit } from '@/stores/bitStore'
import type { WorkflowState } from '@/types/flow'
import type { DueFilter, FilterState } from '@/stores/toolStore'

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** Due-date groups in local time; weeks run Monday … Sunday. */
export function dueMatches(
  due: Date | string | undefined,
  kinds: DueFilter[],
  today: Date,
): boolean {
  if (!due) return false
  const d = startOfDay(new Date(due))
  const t0 = startOfDay(today)
  const mondayIndex = (today.getDay() + 6) % 7
  const sunday = startOfDay(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + (6 - mondayIndex)),
  )
  return kinds.some((k) =>
    k === 'overdue' ? d < t0 : k === 'today' ? d === t0 : d >= t0 && d <= sunday,
  )
}

/** OR within a group, AND across groups; an empty group does not restrict. */
export function matchesFilter(
  bit: Bit,
  state: WorkflowState,
  filters: FilterState,
  today: Date = new Date(),
): boolean {
  if (filters.workflow.length > 0 && !(state && filters.workflow.includes(state))) return false
  if (filters.priority.length > 0 && !(bit.priority && filters.priority.includes(bit.priority)))
    return false
  if (filters.due.length > 0 && !dueMatches(bit.dueDate, filters.due, today)) return false
  return true
}
```

`frontend/src/stores/toolStore.ts`:

```ts
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type Tool = 'select' | 'flow'
export type WorkflowFilter = 'ready' | 'blocked'
export type DueFilter = 'overdue' | 'today' | 'week'

export interface FilterState {
  workflow: WorkflowFilter[]
  priority: number[]
  due: DueFilter[]
}

export const FILTER_STORAGE_KEY = 'listion-filter'

const WORKFLOW: readonly WorkflowFilter[] = ['ready', 'blocked']
const PRIORITY: readonly number[] = [1, 2, 3]
const DUE: readonly DueFilter[] = ['overdue', 'today', 'week']

function emptyFilters(): FilterState {
  return { workflow: [], priority: [], due: [] }
}

function pick<T>(value: unknown, allowed: readonly T[]): T[] {
  return Array.isArray(value) ? allowed.filter((a) => value.includes(a)) : []
}

/** Per-viewer convenience: anything unreadable simply means "no filters". */
function loadFilters(): FilterState {
  try {
    const raw = localStorage.getItem(FILTER_STORAGE_KEY)
    if (!raw) return emptyFilters()
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      workflow: pick(parsed.workflow, WORKFLOW),
      priority: pick(parsed.priority, PRIORITY),
      due: pick(parsed.due, DUE),
    }
  } catch {
    return emptyFilters()
  }
}

function saveFilters(filters: FilterState): void {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters))
  } catch {
    /* storage may be unavailable */
  }
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  )
}

export const useToolStore = defineStore('tool', () => {
  const activeTool = ref<Tool>('select')
  const filterOpen = ref(false)
  const filters = ref<FilterState>(loadFilters())

  const activeFilterCount = computed(
    () => filters.value.workflow.length + filters.value.priority.length + filters.value.due.length,
  )

  function setTool(tool: Tool) {
    activeTool.value = tool
  }

  function toggleFilter<K extends keyof FilterState>(group: K, value: FilterState[K][number]) {
    const list = filters.value[group] as FilterState[K][number][]
    const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
    filters.value = { ...filters.value, [group]: next }
    saveFilters(filters.value)
  }

  function resetFilters() {
    filters.value = emptyFilters()
    saveFilters(filters.value)
  }

  /** Returns true when the key was a tool shortcut and has been handled. */
  function handleShortcut(e: KeyboardEvent): boolean {
    if (e.ctrlKey || e.metaKey || e.altKey || isEditable(e.target)) return false
    const k = e.key.toLowerCase()
    if (k === 'v') setTool('select')
    else if (k === 'f') setTool('flow')
    else if (k === 'escape') {
      setTool('select')
      filterOpen.value = false
    } else return false
    return true
  }

  return {
    activeTool,
    filterOpen,
    filters,
    activeFilterCount,
    setTool,
    toggleFilter,
    resetFilters,
    handleShortcut,
  }
})
```

- [ ] **Step 4: Run tests**

Run: `cd frontend; npx vitest run src/stores/toolStore.test.ts src/composables/useFilter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/stores/toolStore.ts frontend/src/stores/toolStore.test.ts frontend/src/composables/useFilter.ts frontend/src/composables/useFilter.test.ts
git commit -m "feat(frontend): add tool store and filter matching" -m "Co-Authored-By: Claude <model> <noreply@anthropic.com>"
```

---

### Task 6: useFlowGroups (frames, lasso, flowAt)

**Files:**
- Create: `frontend/src/composables/useFlowGroups.ts`
- Test: `frontend/src/composables/useFlowGroups.test.ts`

**Interfaces:**
- Consumes: `FlowLayout`, `Rect`, `unionRect`, `CAPSULE_W`, `CAPSULE_H` (useFlowLayout), `Bit`, `Packet`, `Flow`.
- Produces: `FLOW_PAD = 24`, `FLOW_LABEL_EXTRA = 8`, `FLOW_COLORS` (6 hex strings, first = default), `type Point = { x: number; y: number }`, `flowFrames(layout, bits, packets, flows): Map<number, Rect>`, `pointInPolygon(p, poly): boolean`, `pathLength(points): number`, `lassoHits(poly, layout): { bitIds: number[]; packetIds: number[] }`, `flowAt(p, frames, flows): number | null`, `rectCenter(r): Point`.

- [ ] **Step 1: Write the failing test** — `frontend/src/composables/useFlowGroups.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { Bit } from '@/stores/bitStore'
import type { Flow, Packet } from '@/types/flow'
import { computeLayout } from './useFlowLayout'
import { flowAt, flowFrames, lassoHits, pathLength, pointInPolygon } from './useFlowGroups'

const bit = (id: number, x: number, y: number, extra: Partial<Bit> = {}): Bit => ({
  id,
  title: `B${id}`,
  status: 0,
  x,
  y,
  packetId: null,
  order: 0,
  createdAt: '',
  ...extra,
})

// loose bits 1 (0,0) and 2 (300,0) in flow 5; stack 7 at (0,200) with bits 3,4 in flow 5
const bits = [
  bit(1, 0, 0, { flowId: 5 }),
  bit(2, 300, 0, { flowId: 5 }),
  bit(3, 0, 0, { packetId: 7 }),
  bit(4, 0, 0, { packetId: 7, order: 1 }),
  bit(6, 900, 900),
]
const packets: Packet[] = [{ id: 7, name: 'P', x: 0, y: 200, flowId: 5 }]
const flows: Flow[] = [{ id: 5, name: 'F', color: '#818cf8' }]
const layout = computeLayout({ bits, packets, expandedBitId: null })

describe('flowFrames', () => {
  it('umschließt alle Mitglieder mit Abstand und Platz für den Namen', () => {
    // members span x 0…500, y 0…316 (stack 236×116 at y 200)
    expect(flowFrames(layout, bits, packets, flows).get(5)).toEqual({
      x: -24,
      y: -32,
      w: 548,
      h: 372,
    })
  })

  it('ohne Mitglieder kein Rahmen', () => {
    expect(flowFrames(layout, bits, packets, [{ id: 9, name: 'X', color: '#818cf8' }]).size).toBe(0)
  })
})

describe('pointInPolygon', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ]
  // a "C" shape whose opening is at x 4…10, y 4…6
  const concave = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 4 },
    { x: 4, y: 4 },
    { x: 4, y: 6 },
    { x: 10, y: 6 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ]
  it('konvex und konkav', () => {
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true)
    expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false)
    expect(pointInPolygon({ x: 2, y: 5 }, concave)).toBe(true)
    expect(pointInPolygon({ x: 7, y: 5 }, concave)).toBe(false)
  })
})

describe('lassoHits', () => {
  it('trifft lose Bits und Stapel über ihren Mittelpunkt, nicht Bits im Stapel', () => {
    const lasso = [
      { x: -10, y: -10 },
      { x: 250, y: -10 },
      { x: 250, y: 400 },
      { x: -10, y: 400 },
    ]
    expect(lassoHits(lasso, layout)).toEqual({ bitIds: [1], packetIds: [7] })
  })
})

describe('pathLength', () => {
  it('summiert die Segmente', () => {
    expect(
      pathLength([
        { x: 0, y: 0 },
        { x: 3, y: 4 },
        { x: 3, y: 10 },
      ]),
    ).toBe(11)
  })
})

describe('flowAt', () => {
  const frames = new Map([
    [5, { x: 0, y: 0, w: 100, h: 100 }],
    [8, { x: 50, y: 50, w: 100, h: 100 }],
  ])
  const two: Flow[] = [
    { id: 5, name: 'A', color: '#818cf8' },
    { id: 8, name: 'B', color: '#818cf8' },
  ]
  it('liefert den Flow unter dem Punkt, bei Überlappung den jüngsten', () => {
    expect(flowAt({ x: 10, y: 10 }, frames, two)).toBe(5)
    expect(flowAt({ x: 75, y: 75 }, frames, two)).toBe(8)
    expect(flowAt({ x: 500, y: 500 }, frames, two)).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend; npx vitest run src/composables/useFlowGroups.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement** — `frontend/src/composables/useFlowGroups.ts`:

```ts
import type { Bit } from '@/stores/bitStore'
import type { Flow, Packet } from '@/types/flow'
import { unionRect, type FlowLayout, type Rect } from './useFlowLayout'

export const FLOW_PAD = 24
/** Extra room above the members for the name sitting on the top line. */
export const FLOW_LABEL_EXTRA = 8
/** Subtle flow colours; the first one is the default. */
export const FLOW_COLORS = ['#818cf8', '#34d399', '#fbbf24', '#f472b6', '#38bdf8', '#a3a3a3'] as const

export interface Point {
  x: number
  y: number
}

export function rectCenter(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
}

/** Frame per flow: union of its loose bits and stacks, padded; flows without members get none. */
export function flowFrames(
  layout: FlowLayout,
  bits: Bit[],
  packets: Packet[],
  flows: Flow[],
): Map<number, Rect> {
  const loose = new Set(layout.looseBitIds)
  const frames = new Map<number, Rect>()
  for (const flow of flows) {
    const rects: Rect[] = []
    for (const b of bits) {
      if (b.flowId !== flow.id || !loose.has(b.id)) continue
      const r = layout.bitRects.get(b.id)
      if (r) rects.push(r)
    }
    for (const p of packets) {
      if (p.flowId !== flow.id) continue
      const r = layout.packetRects.get(p.id)
      if (r) rects.push(r)
    }
    const u = unionRect(rects)
    if (!u) continue
    frames.set(flow.id, {
      x: u.x - FLOW_PAD,
      y: u.y - FLOW_PAD - FLOW_LABEL_EXTRA,
      w: u.w + FLOW_PAD * 2,
      h: u.h + FLOW_PAD * 2 + FLOW_LABEL_EXTRA,
    })
  }
  return frames
}

/** Ray casting; works for concave lasso shapes. */
export function pointInPolygon(p: Point, poly: Point[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!
    const b = poly[j]!
    const crosses = a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    if (crosses) inside = !inside
  }
  return inside
}

export function pathLength(points: Point[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y)
  }
  return total
}

/** Loose bits and stacks whose centre lies inside the lasso; bits inside stacks come with their stack. */
export function lassoHits(poly: Point[], layout: FlowLayout): { bitIds: number[]; packetIds: number[] } {
  const bitIds = layout.looseBitIds.filter((id) => {
    const r = layout.bitRects.get(id)
    return r ? pointInPolygon(rectCenter(r), poly) : false
  })
  const packetIds = [...layout.packetRects.entries()]
    .filter(([, r]) => pointInPolygon(rectCenter(r), poly))
    .map(([id]) => id)
  return { bitIds, packetIds }
}

/** Flow whose frame contains the point; on overlap the newest (highest id) wins. */
export function flowAt(p: Point, frames: Map<number, Rect>, flows: Flow[]): number | null {
  let best: number | null = null
  for (const f of flows) {
    const r = frames.get(f.id)
    if (!r) continue
    const inside = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h
    if (inside && (best === null || f.id > best)) best = f.id
  }
  return best
}
```

- [ ] **Step 4: Run the test**

Run: `cd frontend; npx vitest run src/composables/useFlowGroups.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/composables/useFlowGroups.ts frontend/src/composables/useFlowGroups.test.ts
git commit -m "feat(frontend): add flow frame and lasso geometry" -m "Co-Authored-By: Claude <model> <noreply@anthropic.com>"
```

---

### Task 7: Components — LFlowFrame, LFilterPopover, LLassoPath, taskbar tools, stack step dimming

**Files:**
- Create: `frontend/src/components/LFlowFrame.vue`, `frontend/src/components/LFilterPopover.vue`, `frontend/src/components/LLassoPath.vue`
- Modify: `frontend/src/layout/LTaskbar.vue`, `frontend/src/components/LPacketStack.vue`
- Test: `frontend/src/components/toolComponents.test.ts`

**Interfaces:**
- Consumes: `Flow`, `Rect`, `FLOW_COLORS`, `Point`, `FilterState`, `useToolStore`.
- Produces:
  - `LFlowFrame` props `{ flow: Flow; rect: Rect; dragging?: boolean }`, emits `rename: [name: string]`, `recolor: [color: string]`, `dissolve: []`, `dragstart: [e: PointerEvent]`; root has `data-flow-id`.
  - `LFilterPopover` props `{ filters: FilterState }`, emits `toggle: [group: keyof FilterState, value: string | number]`, `reset: []`.
  - `LLassoPath` props `{ points: Point[] }`.
  - `LPacketStack` new optional prop `dimmedBitIds?: Set<number>` forwarded as each capsule's `dimmed`.
  - `LTaskbar` no props; reads/writes `useToolStore()`.

- [ ] **Step 1: Write the failing test** — `frontend/src/components/toolComponents.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import LFlowFrame from './LFlowFrame.vue'
import LFilterPopover from './LFilterPopover.vue'
import LLassoPath from './LLassoPath.vue'
import LTaskbar from '@/layout/LTaskbar.vue'
import { useToolStore } from '@/stores/toolStore'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

const flow = { id: 5, name: 'Release', color: '#818cf8' }
const rect = { x: 10, y: 20, w: 300, h: 200 }

describe('LFlowFrame', () => {
  it('zeigt den Namen auf der Linie und benennt per Klick um', async () => {
    const w = mount(LFlowFrame, { props: { flow, rect } })
    expect(w.attributes('data-flow-id')).toBe('5')
    expect(w.attributes('style')).toContain('translate3d(10px, 20px, 0')
    await w.find('.flow__name').trigger('click')
    const input = w.find('input')
    await input.setValue('Launch')
    await input.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('rename')).toEqual([['Launch']])
  })

  it('Hover-Leiste: Farbe wählen und Flow auflösen', async () => {
    const w = mount(LFlowFrame, { props: { flow, rect } })
    await w.find('.flow__label').trigger('mouseenter')
    const swatches = w.findAll('.flow__swatch')
    expect(swatches).toHaveLength(6)
    expect(swatches[0]!.attributes('aria-pressed')).toBe('true')
    await swatches[1]!.trigger('click')
    expect(w.emitted('recolor')).toEqual([['#34d399']])
    await w.find('.flow__dissolve').trigger('click')
    expect(w.emitted('dissolve')).toHaveLength(1)
  })

  it('Ziehen auf der freien Fläche meldet dragstart, auf dem Namen nicht', async () => {
    const w = mount(LFlowFrame, { props: { flow, rect } })
    await w.find('.flow__name').trigger('pointerdown', { button: 0 })
    expect(w.emitted('dragstart')).toBeUndefined()
    await w.trigger('pointerdown', { button: 0 })
    expect(w.emitted('dragstart')).toHaveLength(1)
  })
})

describe('LFilterPopover', () => {
  it('Chips schalten Filter, Zurücksetzen leert', async () => {
    const w = mount(LFilterPopover, {
      props: { filters: { workflow: ['ready'], priority: [], due: [] } },
    })
    const ready = w.find('[data-filter="workflow:ready"]')
    expect(ready.attributes('aria-pressed')).toBe('true')
    await w.find('[data-filter="priority:3"]').trigger('click')
    await w.find('[data-filter="due:today"]').trigger('click')
    expect(w.emitted('toggle')).toEqual([
      ['priority', 3],
      ['due', 'today'],
    ])
    await w.find('.filter__reset').trigger('click')
    expect(w.emitted('reset')).toHaveLength(1)
  })
})

describe('LLassoPath', () => {
  it('zeichnet die Spur als Polylinie', () => {
    const w = mount(LLassoPath, {
      props: {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 5 },
        ],
      },
    })
    expect(w.find('polyline').attributes('points')).toBe('0,0 10,5')
  })
})

describe('LTaskbar', () => {
  it('Werkzeuge links, Logo mittig, Filter rechts mit Zähler', async () => {
    const w = mount(LTaskbar, { attachTo: document.body })
    const store = useToolStore()
    const select = w.find('[aria-label="Select"]')
    const flowBtn = w.find('[aria-label="Flow"]')
    expect(select.attributes('aria-pressed')).toBe('true')
    await flowBtn.trigger('click')
    expect(store.activeTool).toBe('flow')
    expect(flowBtn.attributes('aria-pressed')).toBe('true')
    expect(w.find('img[alt="Listion Logo"]').exists()).toBe(true)

    store.toggleFilter('priority', 3)
    await w.vm.$nextTick()
    expect(w.find('.tool__badge').text()).toBe('1')
    await w.find('[aria-label="Filter"]').trigger('click')
    expect(store.filterOpen).toBe(true)
    expect(w.find('.filter').exists()).toBe(true)
    w.unmount()
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend; npx vitest run src/components/toolComponents.test.ts`
Expected: FAIL — components missing.

- [ ] **Step 3: Implement**

`frontend/src/components/LLassoPath.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { Point } from '@/composables/useFlowGroups'

const props = defineProps<{ points: Point[] }>()

const polyline = computed(() => props.points.map((p) => `${p.x},${p.y}`).join(' '))
</script>

<template>
  <svg class="lasso" aria-hidden="true">
    <polyline :points="polyline" />
  </svg>
</template>

<style scoped>
.lasso {
  position: absolute;
  inset: 0;
  /* Not 0x0: Chrome does not paint the contents of a zero-size svg. */
  width: 1px;
  height: 1px;
  overflow: visible;
  pointer-events: none;
}
.lasso polyline {
  fill: rgba(165, 180, 252, 0.06);
  stroke: #a5b4fc;
  stroke-width: 1.5;
  stroke-dasharray: 5 4;
  stroke-linejoin: round;
  stroke-linecap: round;
}
</style>
```

`frontend/src/components/LFlowFrame.vue`:

```vue
<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue'
import { Ungroup } from 'lucide-vue-next'
import type { Flow } from '@/types/flow'
import type { Rect } from '@/composables/useFlowLayout'
import { FLOW_COLORS } from '@/composables/useFlowGroups'

const props = defineProps<{ flow: Flow; rect: Rect; dragging?: boolean }>()

const emit = defineEmits<{
  rename: [name: string]
  recolor: [color: string]
  dissolve: []
  dragstart: [e: PointerEvent]
}>()

const COLOR_NAMES: Record<string, string> = {
  '#818cf8': 'Indigo',
  '#34d399': 'Green',
  '#fbbf24': 'Amber',
  '#f472b6': 'Pink',
  '#38bdf8': 'Sky',
  '#a3a3a3': 'Grey',
}

const editing = ref(false)
const draft = ref('')
const input = ref<HTMLInputElement | null>(null)
const toolsOpen = ref(false)
let closeTimer: ReturnType<typeof setTimeout> | null = null

async function startRename() {
  draft.value = props.flow.name
  editing.value = true
  toolsOpen.value = false
  await nextTick()
  input.value?.select()
}

function commitRename() {
  if (!editing.value) return
  const name = draft.value.trim()
  editing.value = false
  if (name && name !== props.flow.name) emit('rename', name)
}

function openTools() {
  if (closeTimer) clearTimeout(closeTimer)
  closeTimer = null
  if (!editing.value) toolsOpen.value = true
}

// a short grace period so the pointer can travel from the name to the bar
function closeToolsSoon() {
  closeTimer = setTimeout(() => (toolsOpen.value = false), 200)
}

function onPointerDown(e: PointerEvent) {
  // only the empty frame area moves the flow — not the name or its tool bar
  if (e.target !== e.currentTarget) return
  emit('dragstart', e)
}

onBeforeUnmount(() => {
  if (closeTimer) clearTimeout(closeTimer)
})
</script>

<template>
  <div
    class="flow"
    :class="{ 'flow--dragging': dragging }"
    :style="{
      '--flow': flow.color,
      transform: `translate3d(${rect.x}px, ${rect.y}px, 0)`,
      width: `${rect.w}px`,
      height: `${rect.h}px`,
    }"
    :data-flow-id="flow.id"
    @pointerdown="onPointerDown"
    @mousedown.left.exact.stop
  >
    <div
      class="flow__label"
      @mouseenter="openTools"
      @mouseleave="closeToolsSoon"
      @focusin="openTools"
      @focusout="closeToolsSoon"
    >
      <input
        v-if="editing"
        ref="input"
        v-model="draft"
        class="flow__input"
        maxlength="60"
        aria-label="Flow name"
        @pointerdown.stop
        @keydown.enter.prevent="commitRename"
        @keydown.escape.prevent.stop="editing = false"
        @blur="commitRename"
      />
      <button
        v-else
        class="flow__name"
        type="button"
        :aria-label="`Rename flow ${flow.name}`"
        @pointerdown.stop
        @click.stop="startRename"
      >
        {{ flow.name }}
      </button>

      <Transition name="flow-tools">
        <div v-if="toolsOpen" class="flow__tools material" role="toolbar" aria-label="Flow options">
          <button
            v-for="c in FLOW_COLORS"
            :key="c"
            class="flow__swatch"
            type="button"
            :style="{ background: c }"
            :aria-label="`Colour ${COLOR_NAMES[c]}`"
            :aria-pressed="flow.color === c"
            @pointerdown.stop
            @click.stop="emit('recolor', c)"
          />
          <span class="flow__sep" />
          <button
            class="flow__dissolve"
            type="button"
            aria-label="Dissolve flow"
            title="Dissolve flow"
            @pointerdown.stop
            @click.stop="emit('dissolve')"
          >
            <Ungroup :size="14" />
          </button>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.flow {
  position: absolute;
  left: 0;
  top: 0;
  border-radius: 22px;
  border: 1px solid color-mix(in srgb, var(--flow) 28%, transparent);
  background: color-mix(in srgb, var(--flow) 4.5%, transparent);
  cursor: grab;
  will-change: transform;
  transition:
    transform var(--spring-duration) var(--ease-spring),
    width var(--spring-duration) var(--ease-spring),
    height var(--spring-duration) var(--ease-spring),
    border-color 0.3s ease,
    background-color 0.3s ease;
}
.flow--dragging {
  cursor: grabbing;
  transition:
    width var(--spring-duration) var(--ease-spring),
    height var(--spring-duration) var(--ease-spring);
}

.flow__label {
  position: absolute;
  left: 20px;
  top: -9px;
  display: flex;
  align-items: center;
}

.flow__name,
.flow__input {
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: -0.005em;
  line-height: 18px;
  padding: 0 7px;
  border-radius: 6px;
  background: var(--surface1);
  color: color-mix(in srgb, color-mix(in srgb, var(--flow) 55%, var(--text1)) 85%, transparent);
}
.flow__name {
  border: none;
  cursor: text;
  white-space: nowrap;
  transition: color 0.2s ease;
}
.flow__name:hover {
  color: var(--text0);
}
.flow__input {
  border: 1px solid var(--brand);
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 16%, transparent);
  color: var(--text0);
}

.flow__tools {
  position: absolute;
  left: 0;
  bottom: calc(100% + 6px);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 12px;
  transform-origin: bottom left;
}
.flow__swatch {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: none;
  padding: 0;
  cursor: pointer;
  transition: transform var(--spring-duration) var(--ease-spring);
}
.flow__swatch:hover {
  transform: scale(1.15);
}
.flow__swatch[aria-pressed='true'] {
  box-shadow:
    0 0 0 2px var(--surface1),
    0 0 0 3.5px var(--text1);
}
.flow__sep {
  width: 1px;
  height: 14px;
  background: var(--separator);
}
.flow__dissolve {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 11px;
  border: none;
  background: transparent;
  color: var(--text2);
  cursor: pointer;
}
.flow__dissolve:hover {
  background: var(--fill-hover);
  color: var(--text0);
}

.flow-tools-enter-active {
  transition:
    opacity 0.15s ease,
    transform var(--spring-duration) var(--ease-spring);
}
.flow-tools-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.15s ease;
}
.flow-tools-enter-from,
.flow-tools-leave-to {
  opacity: 0;
  transform: scale(0.92);
}
</style>
```

`frontend/src/components/LFilterPopover.vue`:

```vue
<script setup lang="ts">
import type { FilterState } from '@/stores/toolStore'

defineProps<{ filters: FilterState }>()

const emit = defineEmits<{
  toggle: [group: keyof FilterState, value: string | number]
  reset: []
}>()

const GROUPS: { key: keyof FilterState; title: string; options: { value: string | number; label: string }[] }[] = [
  {
    key: 'workflow',
    title: 'Workflow',
    options: [
      { value: 'ready', label: 'Ready' },
      { value: 'blocked', label: 'Blocked' },
    ],
  },
  {
    key: 'priority',
    title: 'Priority',
    options: [
      { value: 3, label: 'High' },
      { value: 2, label: 'Medium' },
      { value: 1, label: 'Low' },
    ],
  },
  {
    key: 'due',
    title: 'Due',
    options: [
      { value: 'overdue', label: 'Overdue' },
      { value: 'today', label: 'Today' },
      { value: 'week', label: 'This week' },
    ],
  },
]

function isOn(filters: FilterState, key: keyof FilterState, value: string | number): boolean {
  return (filters[key] as (string | number)[]).includes(value)
}
</script>

<template>
  <div class="filter material" role="dialog" aria-label="Filter bits">
    <section v-for="g in GROUPS" :key="g.key" class="filter__group">
      <h4 class="filter__title">{{ g.title }}</h4>
      <div class="filter__chips">
        <button
          v-for="o in g.options"
          :key="o.value"
          class="filter__chip pressable"
          type="button"
          :data-filter="`${g.key}:${o.value}`"
          :aria-pressed="isOn(filters, g.key, o.value)"
          @click="emit('toggle', g.key, o.value)"
        >
          {{ o.label }}
        </button>
      </div>
    </section>
    <button class="filter__reset" type="button" @click="emit('reset')">Reset</button>
  </div>
</template>

<style scoped>
.filter {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  width: 248px;
  padding: 12px;
  border-radius: 16px;
  transform-origin: top right;
  text-align: left;
}
.filter__group + .filter__group {
  margin-top: 10px;
}
.filter__title {
  margin: 0 0 6px 2px;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text2);
}
.filter__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.filter__chip {
  padding: 4px 10px;
  border-radius: 999px;
  border: none;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text1);
  background: var(--fill-hover);
  cursor: pointer;
}
.filter__chip:hover {
  background: var(--fill-press);
}
.filter__chip[aria-pressed='true'] {
  background: var(--brand);
  color: hsl(0 0% 100%);
}
.filter__reset {
  display: block;
  margin: 12px 0 0 auto;
  border: none;
  background: none;
  font-size: 0.8125rem;
  font-weight: 500;
  color: color-mix(in srgb, var(--brand) 75%, var(--text0));
  cursor: pointer;
}
.filter__reset:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
```

`frontend/src/layout/LTaskbar.vue` — keep the corner SVGs and the outer structure exactly; replace the script and the middle `<div>` only:

```vue
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Lasso, ListFilter, MousePointer2 } from 'lucide-vue-next'
import { useTheme } from '@/composables/useTheme.ts'
import { useToolStore } from '@/stores/toolStore'
import LFilterPopover from '@/components/LFilterPopover.vue'

const { isDark } = useTheme()
const toolStore = useToolStore()

// Dark taskbar in light mode → light logo; light taskbar in dark mode → dark logo
const logoSrc = computed(() =>
  isDark.value ? '/listion/listion_written_dark.svg' : '/listion/listion_written_light.svg',
)

const filterGroup = ref<HTMLElement | null>(null)

// a click anywhere outside the filter button/popover closes it
function onDocumentPointerDown(e: PointerEvent) {
  if (!toolStore.filterOpen) return
  if (filterGroup.value && !filterGroup.value.contains(e.target as Node)) {
    toolStore.filterOpen = false
  }
}

onMounted(() => document.addEventListener('pointerdown', onDocumentPointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocumentPointerDown))
</script>
```

Middle element (replaces `<div class="flex-[0.7] flex items-center justify-center rounded-b-2xl bg-taskbar shadow-lg">…</div>`):

```vue
    <div
      class="flex-[0.7] grid grid-cols-[1fr_auto_1fr] items-center rounded-b-2xl bg-taskbar shadow-lg px-3"
    >
      <div class="flex items-center gap-1">
        <button
          class="tool pressable"
          :class="{ 'tool--active': toolStore.activeTool === 'select' }"
          type="button"
          aria-label="Select"
          title="Select (V)"
          :aria-pressed="toolStore.activeTool === 'select'"
          @click="toolStore.setTool('select')"
        >
          <MousePointer2 :size="17" />
        </button>
        <button
          class="tool pressable"
          :class="{ 'tool--active': toolStore.activeTool === 'flow' }"
          type="button"
          aria-label="Flow"
          title="Flow (F)"
          :aria-pressed="toolStore.activeTool === 'flow'"
          @click="toolStore.setTool('flow')"
        >
          <Lasso :size="17" />
        </button>
      </div>
      <img :src="logoSrc" alt="Listion Logo" class="h-8" />
      <div ref="filterGroup" class="relative flex items-center justify-end">
        <button
          class="tool pressable"
          :class="{ 'tool--active': toolStore.filterOpen }"
          type="button"
          aria-label="Filter"
          title="Filter"
          aria-haspopup="dialog"
          :aria-expanded="toolStore.filterOpen"
          @click="toolStore.filterOpen = !toolStore.filterOpen"
        >
          <ListFilter :size="17" />
          <span v-if="toolStore.activeFilterCount > 0" class="tool__badge">
            {{ toolStore.activeFilterCount }}
          </span>
        </button>
        <Transition name="filter-pop">
          <LFilterPopover
            v-if="toolStore.filterOpen"
            :filters="toolStore.filters"
            @toggle="(group, value) => toolStore.toggleFilter(group, value as never)"
            @reset="toolStore.resetFilters()"
          />
        </Transition>
      </div>
    </div>
```

Replace `<style scoped></style>` with:

```vue
<style scoped>
/* Tool icons take the logo's contrast: light on the dark tab, dark on the light tab */
.tool {
  position: relative;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--surface1);
  background: transparent;
  cursor: pointer;
}
.tool:hover {
  background: color-mix(in srgb, var(--surface1) 10%, transparent);
}
.tool--active,
.tool--active:hover {
  background: color-mix(in srgb, var(--surface1) 16%, transparent);
}
.tool__badge {
  position: absolute;
  top: 1px;
  right: 0;
  min-width: 15px;
  height: 15px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--brand);
  color: hsl(0 0% 100%);
  font-size: 9.5px;
  font-weight: 700;
  line-height: 15px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.filter-pop-enter-active {
  transition:
    opacity 0.15s ease,
    transform var(--spring-duration) var(--ease-spring);
}
.filter-pop-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.15s ease;
}
.filter-pop-enter-from,
.filter-pop-leave-to {
  opacity: 0;
  transform: scale(0.92);
}
</style>
```

Note on `as never` in the toggle handler: `toggleFilter` is generic over the group; the popover emits a widened `string | number`. If vue-tsc rejects the cast, replace the inline handler with a typed function `function onToggle(group: keyof FilterState, value: string | number) { toolStore.toggleFilter(group, value as FilterState[typeof group][number]) }`.

`frontend/src/components/LPacketStack.vue` — add the optional prop `dimmedBitIds?: Set<number>` to `defineProps` and pass `:dimmed="dimmedBitIds?.has(bit.id) ?? false"` to `LBitCapsule`.

- [ ] **Step 4: Run tests**

Run: `cd frontend; npx vitest run src/components; npx vue-tsc --build`
Expected: PASS, exit 0.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): add flow frame, filter popover and taskbar tools" -m "Co-Authored-By: Claude <model> <noreply@anthropic.com>"
```

---

### Task 8: Gestures and actions for flows

**Files:**
- Modify: `frontend/src/composables/useFlowGestures.ts`, `frontend/src/composables/useFlowActions.ts`
- Test: `frontend/src/composables/useFlowGestures.test.ts`, `frontend/src/composables/useFlowActions.test.ts` (append)

**Interfaces:**
- Consumes: `lassoHits`, `flowAt`, `rectCenter`, `Point` (Task 6), `useFlowStore` (Task 4), layout constants.
- Produces:
  - `FlowGestureOptions` gains `onLassoEnd(points: Point[]): void` and `onMoveFlowEnd(flowId: number, dx: number, dy: number): Promise<void>`.
  - `useFlowGestures` returns additionally `lasso: Ref<Point[] | null>`, `flowDrag: Ref<{ flowId: number; dx: number; dy: number } | null>`, `startLasso(e: PointerEvent): void`, `cancelLasso(): void`, `startFlowPointer(e: PointerEvent, flowId: number): void`.
  - `useFlowActions` gains `createFlowFromLasso(points, layout): Promise<boolean>`, `renameFlow(id, name)`, `recolorFlow(id, color)`, `dissolveFlow(id)`, `moveFlow(flowId, dx, dy)`; **signature changes**: `dropBit(bitId, target, pos, layout, frames: Map<number, Rect>)` and `movePacket(id, x, y, layout, frames: Map<number, Rect>)`.

- [ ] **Step 1: Write the failing tests**

Append to `frontend/src/composables/useFlowGestures.test.ts` (the `setup()` helper must add `onLassoEnd: vi.fn()` and `onMoveFlowEnd: vi.fn().mockResolvedValue(undefined)` to `opts`):

```ts
  it('Lasso sammelt die Spur in Canvas-Koordinaten und meldet sie beim Loslassen', () => {
    const { opts, g } = setup()
    g.startLasso(pointer('pointerdown', 0, 0))
    window.dispatchEvent(pointer('pointermove', 20, 0))
    window.dispatchEvent(pointer('pointermove', 20, 20))
    expect(g.lasso.value).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
    ])
    window.dispatchEvent(pointer('pointerup', 20, 20))
    expect(g.lasso.value).toBeNull()
    expect(opts.onLassoEnd).toHaveBeenCalledWith([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
    ])
  })

  it('cancelLasso bricht ab, ohne etwas zu melden', () => {
    const { opts, g } = setup()
    g.startLasso(pointer('pointerdown', 0, 0))
    window.dispatchEvent(pointer('pointermove', 30, 30))
    g.cancelLasso()
    window.dispatchEvent(pointer('pointerup', 30, 30))
    expect(g.lasso.value).toBeNull()
    expect(opts.onLassoEnd).not.toHaveBeenCalled()
  })

  it('Rahmen ziehen liefert den Versatz und meldet ihn beim Loslassen', async () => {
    const { opts, g } = setup()
    g.startFlowPointer(pointer('pointerdown', 100, 100), 5)
    window.dispatchEvent(pointer('pointermove', 140, 130))
    expect(g.flowDrag.value).toEqual({ flowId: 5, dx: 40, dy: 30 })
    vi.spyOn(performance, 'now').mockReturnValue(10_000) // released after resting: no glide
    window.dispatchEvent(pointer('pointerup', 140, 130))
    await Promise.resolve()
    expect(g.flowDrag.value).toBeNull()
    expect(opts.onMoveFlowEnd).toHaveBeenCalledWith(5, 40, 30)
  })
```

Append to `frontend/src/composables/useFlowActions.test.ts` (reuse the file's `api` mock, `seed`, `bit` helpers; import `useFlowStore`):

```ts
describe('useFlowActions flows', () => {
  it('Lasso ohne Treffer legt nichts an, mit Treffern einen Flow', async () => {
    const layout = seed([bit(1, null, 0, 0, 0)], [])
    const a = useFlowActions()
    const miss = [{ x: 500, y: 500 }, { x: 600, y: 500 }, { x: 600, y: 600 }]
    expect(await a.createFlowFromLasso(miss, layout)).toBe(false)
    expect(api.post).not.toHaveBeenCalled()
    api.post.mockResolvedValue({ data: { id: 3, name: 'Flow 1', color: '#818cf8' } })
    const hit = [{ x: -10, y: -10 }, { x: 300, y: -10 }, { x: 300, y: 100 }, { x: -10, y: 100 }]
    expect(await a.createFlowFromLasso(hit, layout)).toBe(true)
    expect(api.post).toHaveBeenCalledWith('/api/flow', { bitIds: [1], packetIds: [] })
  })

  it('ein loses Bit verlässt seinen Flow, wenn es außerhalb des alten Rahmens landet', async () => {
    const layout = seed([{ ...bit(1, null, 0, 0, 0), flowId: 5 }], [])
    useFlowStore().flows = [{ id: 5, name: 'F', color: '#818cf8' }]
    const frames = new Map([[5, { x: -24, y: -32, w: 248, h: 88 }]])
    await useFlowActions().dropBit(1, null, { x: 900, y: 900 }, layout, frames)
    expect(api.put).toHaveBeenCalledWith('/api/bit/1', { x: 900, y: 900, flowId: null })
  })

  it('ein loses Bit tritt einem Flow bei, wenn es in dessen Rahmen landet', async () => {
    const layout = seed([bit(1, null, 0, 900, 900)], [])
    useFlowStore().flows = [{ id: 5, name: 'F', color: '#818cf8' }]
    const frames = new Map([[5, { x: 0, y: 0, w: 400, h: 300 }]])
    await useFlowActions().dropBit(1, null, { x: 50, y: 50 }, layout, frames)
    expect(api.put).toHaveBeenCalledWith('/api/bit/1', { x: 50, y: 50, flowId: 5 })
  })

  it('innerhalb des eigenen Flows verschieben ändert die Mitgliedschaft nicht', async () => {
    const layout = seed([{ ...bit(1, null, 0, 0, 0), flowId: 5 }], [])
    useFlowStore().flows = [{ id: 5, name: 'F', color: '#818cf8' }]
    const frames = new Map([[5, { x: -24, y: -32, w: 600, h: 400 }]])
    await useFlowActions().dropBit(1, null, { x: 100, y: 100 }, layout, frames)
    expect(api.put).toHaveBeenCalledWith('/api/bit/1', { x: 100, y: 100 })
  })

  it('einen Flow verschieben bewegt lose Bits und Stapel um denselben Versatz', async () => {
    seed(
      [{ ...bit(1, null, 0, 10, 20), flowId: 5 }, bit(2, 7, 0), bit(3, 7, 1), bit(4, null, 0, 0, 0)],
      [{ id: 7, name: 'P', x: 100, y: 100, flowId: 5 }],
    )
    await useFlowActions().moveFlow(5, 30, -10)
    expect(api.put).toHaveBeenCalledWith('/api/bit/1', { x: 40, y: 10 })
    expect(api.put).toHaveBeenCalledWith('/api/packet/7', { x: 130, y: 90 })
    expect(api.put).not.toHaveBeenCalledWith('/api/bit/4', expect.anything())
  })
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd frontend; npx vitest run src/composables/useFlowGestures.test.ts src/composables/useFlowActions.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`useFlowGestures.ts`:

1. Import `type Point` from `./useFlowGroups` (remove the local `Point` interface and use the imported one).
2. Add to `FlowGestureOptions`:

```ts
  onLassoEnd(points: Point[]): void
  onMoveFlowEnd(flowId: number, dx: number, dy: number): Promise<void>
```

3. Make `track` return a cancel function and remember it:

```ts
  let cancelActive: (() => void) | null = null
```

At the end of `track` (after adding listeners):

```ts
    const cancel = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    cancelActive = cancel
    return cancel
```

and inside `onUp`, replace the three `removeEventListener` lines with `cancel()` (declare `cancel` before `onUp` uses it by moving the `const cancel = …` definition above `onMove`) and set `cancelActive = null`.

4. Add refs and functions:

```ts
  const lasso = ref<Point[] | null>(null)
  const flowDrag = ref<{ flowId: number; dx: number; dy: number } | null>(null)

  function startLasso(e: PointerEvent) {
    if (e.button !== 0 || e.shiftKey) return
    e.stopPropagation()
    e.preventDefault()
    lasso.value = [opts.toCanvas(e.clientX, e.clientY)]
    track(e, {
      move(ev) {
        lasso.value = [...(lasso.value ?? []), opts.toCanvas(ev.clientX, ev.clientY)]
      },
      end(ev, moved) {
        const points = lasso.value
        lasso.value = null
        if (ev.type === 'pointercancel' || !moved || !points) return
        opts.onLassoEnd(points)
      },
    })
  }

  function cancelLasso() {
    if (!lasso.value) return
    cancelActive?.()
    cancelActive = null
    lasso.value = null
  }

  function startFlowPointer(e: PointerEvent, flowId: number) {
    if (e.button !== 0 || e.shiftKey) return
    e.stopPropagation()
    const start = opts.toCanvas(e.clientX, e.clientY)
    track(e, {
      move(ev) {
        const c = opts.toCanvas(ev.clientX, ev.clientY)
        flowDrag.value = { flowId, dx: c.x - start.x, dy: c.y - start.y }
      },
      async end(ev, moved, v) {
        const drag = flowDrag.value
        flowDrag.value = null
        if (!moved || !drag || ev.type === 'pointercancel') return
        await opts.onMoveFlowEnd(
          flowId,
          drag.dx + project(v.x, DECELERATION),
          drag.dy + project(v.y, DECELERATION),
        )
      },
    })
  }
```

5. Return `lasso, flowDrag, startLasso, cancelLasso, startFlowPointer` in addition to the existing members.

`useFlowActions.ts`:

1. Imports: `useFlowStore`; `CAPSULE_W` (add to the `useFlowLayout` import list) and `type Rect`; `flowAt, lassoHits, type Point` from `./useFlowGroups`. Add `const flowStore = useFlowStore()` (it may already exist from Task 4).
2. `dropBit` gains `frames: Map<number, Rect>`; in the `target === null` branches compute the membership patch before the update calls:

```ts
      const centre = { x: pos.x + CAPSULE_W / 2, y: pos.y + CAPSULE_H / 2 }
      const targetFlow = flowAt(centre, frames, flowStore.flows)
      // a bit inside a packet has no flow of its own; after leaving the packet it is loose
      const currentFlow = bit.packetId != null ? null : (bit.flowId ?? null)
      const flowPatch = targetFlow !== currentFlow ? { flowId: targetFlow } : {}
```

Use it in both free-drop updates: `{ packetId: null, x, y, ...flowPatch }` for a bit leaving a packet, and for a loose bit:

```ts
        await bitStore.updateBit(bitId, {
          x: Math.round(pos.x),
          y: Math.round(pos.y),
          ...flowPatch,
        })
        // the server may have pruned an emptied flow
        if ('flowId' in flowPatch) await reloadAll()
        return
```

(The order of keys must be `x, y, flowId` so the request bodies match the tests.)

3. `movePacket(id, x, y, layout, frames)`:

```ts
  function movePacket(
    id: number,
    x: number,
    y: number,
    layout: FlowLayout,
    frames: Map<number, Rect>,
  ): Promise<void> {
    return guarded(async () => {
      const packet = packetStore.packets.find((p) => p.id === id)
      const rect = layout.packetRects.get(id)
      if (!packet || !rect) return
      const centre = { x: x + rect.w / 2, y: y + rect.h / 2 }
      const targetFlow = flowAt(centre, frames, flowStore.flows)
      const changed = targetFlow !== (packet.flowId ?? null)
      await packetStore.updatePacket(id, { x, y, ...(changed ? { flowId: targetFlow } : {}) })
      if (changed) await reloadAll()
    })
  }
```

4. New flow actions:

```ts
  /** Resolves true when the lasso caught something and a flow was created. */
  function createFlowFromLasso(points: Point[], layout: FlowLayout): Promise<boolean> {
    const hits = lassoHits(points, layout)
    if (hits.bitIds.length + hits.packetIds.length === 0) return Promise.resolve(false)
    return guarded(async () => {
      await flowStore.createFlow({ bitIds: hits.bitIds, packetIds: hits.packetIds })
      await reloadAll()
    }).then(() => true)
  }

  function renameFlow(id: number, name: string): Promise<void> {
    return guarded(() => flowStore.updateFlow(id, { name }))
  }

  function recolorFlow(id: number, color: string): Promise<void> {
    return guarded(() => flowStore.updateFlow(id, { color }))
  }

  function dissolveFlow(id: number): Promise<void> {
    return guarded(async () => {
      await flowStore.deleteFlow(id)
      await reloadAll()
    })
  }

  /** Move every loose bit and stack of the flow by the same offset (optimistic per item). */
  function moveFlow(flowId: number, dx: number, dy: number): Promise<void> {
    return guarded(async () => {
      const bits = bitStore.bits.filter((b) => b.flowId === flowId && b.packetId == null)
      const packets = packetStore.packets.filter((p) => p.flowId === flowId)
      await Promise.all([
        ...bits.map((b) =>
          bitStore.updateBit(b.id, { x: Math.round(b.x + dx), y: Math.round(b.y + dy) }),
        ),
        ...packets.map((p) => packetStore.updatePacket(p.id, { x: p.x + dx, y: p.y + dy })),
      ])
    })
  }
```

Add all five to the returned object.

5. Existing `dropBit`/`movePacket` tests in `useFlowActions.test.ts` call the old signatures: add `new Map()` as the extra trailing argument(s) (`dropBit(..., layout, new Map())`). Behaviour without frames is unchanged. Widen the test file's `seed(bits, packets)` helper (and the `server.packets` type) from `{ id; name; x; y }[]` to `Packet[]` (import `Packet` from `@/types/flow`) so packets with `flowId` can be seeded.

- [ ] **Step 4: Run tests**

Run: `cd frontend; npx vitest run src/composables`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/composables
git commit -m "feat(frontend): add lasso and flow drag gestures with membership on drop" -m "Co-Authored-By: Claude <model> <noreply@anthropic.com>"
```

---

### Task 9: Workspace integration

**Files:**
- Modify: `frontend/src/views/LWorkspace.vue`
- Test: `frontend/src/views/LWorkspace.test.ts` (append)

**Interfaces:**
- Consumes: everything from Tasks 4–8.

- [ ] **Step 1: Write the failing tests** — append to `frontend/src/views/LWorkspace.test.ts` (inside the describe; the module-level `api` mock stays):

```ts
  it('zeigt Flow-Rahmen mit Namen und schaltet per F/Esc in den Lasso-Modus', async () => {
    const { default: api } = await import('../helpers/api')
    vi.mocked(api.get).mockImplementation((url: string) =>
      Promise.resolve({
        data:
          url === '/api/bit'
            ? [
                {
                  id: 3,
                  title: 'Loose',
                  status: 0,
                  x: 400,
                  y: 0,
                  packetId: null,
                  order: 0,
                  flowId: 9,
                  createdAt: '',
                },
              ]
            : url === '/api/flow'
              ? [{ id: 9, name: 'Release Q4', color: '#818cf8' }]
              : [],
      }),
    )
    const wrapper = mount(LWorkspace, { global: { plugins: [router, createPinia()] }, attachTo: document.body })
    await router.isReady()
    await new Promise((r) => setTimeout(r, 0))
    expect(wrapper.find('[data-flow-id="9"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Release Q4')

    expect(wrapper.find('.lasso-capture').exists()).toBe(false)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }))
    await wrapper.vm.$nextTick()
    // the capture layer sits above bits so a lasso can start on top of them
    expect(wrapper.find('.lasso-capture').exists()).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.lasso-capture').exists()).toBe(false)
    wrapper.unmount()
  })

  it('Filter dimmt nicht passende Kapseln', async () => {
    const { default: api } = await import('../helpers/api')
    vi.mocked(api.get).mockImplementation((url: string) =>
      Promise.resolve({
        data:
          url === '/api/bit'
            ? [
                { id: 1, title: 'High', status: 0, x: 0, y: 0, packetId: null, order: 0, priority: 3, createdAt: '' },
                { id: 2, title: 'Low', status: 0, x: 300, y: 0, packetId: null, order: 0, priority: 1, createdAt: '' },
              ]
            : [],
      }),
    )
    localStorage.setItem('listion-filter', JSON.stringify({ workflow: [], priority: [3], due: [] }))
    const wrapper = mount(LWorkspace, { global: { plugins: [router, createPinia()] } })
    await router.isReady()
    await new Promise((r) => setTimeout(r, 0))
    const caps = wrapper.findAll('[data-node-type="bit"]')
    const high = caps.find((c) => c.text().includes('High'))!
    const low = caps.find((c) => c.text().includes('Low'))!
    expect(high.classes()).not.toContain('capsule--dimmed')
    expect(low.classes()).toContain('capsule--dimmed')
    localStorage.clear()
  })
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd frontend; npx vitest run src/views/LWorkspace.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** — edits in `frontend/src/views/LWorkspace.vue`:

1. **Imports**: add

```ts
import LFlowFrame from '@/components/LFlowFrame.vue'
import LLassoPath from '@/components/LLassoPath.vue'
import { flowFrames, pathLength } from '@/composables/useFlowGroups'
import { matchesFilter } from '@/composables/useFilter'
import { useFlowStore } from '@/stores/flowStore'
import { useToolStore } from '@/stores/toolStore'
```

and `const flowStore = useFlowStore()` / `const toolStore = useToolStore()` next to the other stores.

2. **Frames from the stored state** (after `baseLayout`):

```ts
// Frames before any gesture — drop membership is judged against these
const baseFrames = computed(() =>
  flowFrames(baseLayout.value, bitStore.bits, packetStore.packets, flowStore.flows),
)
```

3. **Gestures**: destructure the new members `lasso, flowDrag, startLasso, cancelLasso, startFlowPointer` and change/add options:

```ts
    onDropBit: (id, target, pos) =>
      actions.dropBit(id, target, pos, baseLayout.value, baseFrames.value),
    onMovePacketEnd: (id, x, y) => actions.movePacket(id, x, y, baseLayout.value, baseFrames.value),
    onLassoEnd: (points) => {
      // a click or a tiny scribble is not a lasso
      if (pathLength(points) * zoom.value < 10) return
      void actions.createFlowFromLasso(points, baseLayout.value).then((created) => {
        if (created) toolStore.setTool('select')
      })
    },
    onMoveFlowEnd: (id, dx, dy) => actions.moveFlow(id, dx, dy),
```

4. **liveLayout** applies the flow drag offset to members; replace its body with:

```ts
const liveLayout = computed(() => {
  const pd = packetDrag.value
  const fd = flowDrag.value
  const inDraggedFlow = (flowId: number | null | undefined) => fd !== null && flowId === fd.flowId
  const packets = packetStore.packets.map((p) => {
    if (pd && p.id === pd.packetId) return { ...p, x: pd.x, y: pd.y }
    if (fd && inDraggedFlow(p.flowId)) return { ...p, x: p.x + fd.dx, y: p.y + fd.dy }
    return p
  })
  const bits = fd
    ? bitStore.bits.map((b) =>
        b.packetId == null && inDraggedFlow(b.flowId) ? { ...b, x: b.x + fd.dx, y: b.y + fd.dy } : b,
      )
    : bitStore.bits
  const layout = computeLayout({ bits, packets, expandedBitId: null })
  const bd = bitDrag.value
  if (bd) layout.bitRects.set(bd.bitId, { x: bd.x, y: bd.y, w: CAPSULE_W, h: CAPSULE_H })
  return layout
})

// Frames follow their members live, including while one is dragged
const liveFrames = computed(() =>
  flowFrames(liveLayout.value, bitStore.bits, packetStore.packets, flowStore.flows),
)
```

5. **Filter dimming** (after `flow`):

```ts
const filterActive = computed(() => toolStore.activeFilterCount > 0)

/** Bits that do not match the filter (empty when no filter is active). */
const filterDimmed = computed(() => {
  const dimmed = new Set<number>()
  if (!filterActive.value) return dimmed
  const today = new Date()
  for (const b of bitStore.bits) {
    if (!matchesFilter(b, flow.value.bitState.get(b.id) ?? null, toolStore.filters, today))
      dimmed.add(b.id)
  }
  return dimmed
})
```

Replace `isBitDimmed` and `isDependencyDimmed` with:

```ts
function isBitDimmed(id: number): boolean {
  const byHighlight = highlightedPacketId.value !== null && packetOfBit(id) !== highlightedPacketId.value
  return byHighlight || filterDimmed.value.has(id)
}

function isDependencyDimmed(dep: Dependency): boolean {
  const hp = highlightedPacketId.value
  if (hp !== null) {
    const touches = (type: 'bit' | 'packet', id: number) =>
      type === 'packet' ? id === hp : packetOfBit(id) === hp
    if (!touches(dep.fromType, dep.fromId) && !touches(dep.toType, dep.toId)) return true
  }
  if (!filterActive.value) return false
  // a packet end matches when at least one of its steps matches
  const matches = (type: 'bit' | 'packet', id: number) =>
    type === 'bit'
      ? !filterDimmed.value.has(id)
      : (liveLayout.value.membersOf.get(id) ?? []).some((b) => !filterDimmed.value.has(b.id))
  return !matches(dep.fromType, dep.fromId) && !matches(dep.toType, dep.toId)
}
```

6. **Shortcuts**: add

```ts
function onKeydown(e: KeyboardEvent) {
  if (!toolStore.handleShortcut(e)) return
  if (e.key === 'Escape') cancelLasso()
  if (toolStore.activeTool !== 'flow') cancelLasso()
}
```

register `window.addEventListener('keydown', onKeydown)` in `onMounted` and remove it in `onUnmounted`.

7. **Template** — inside the transformed canvas layer, insert before `<LDependencyLayer …>`:

```vue
        <LFlowFrame
          v-for="f in flowStore.flows.filter((fl) => liveFrames.has(fl.id))"
          :key="`flow-${f.id}`"
          :flow="f"
          :rect="liveFrames.get(f.id)!"
          :dragging="flowDrag?.flowId === f.id"
          @dragstart="(e) => startFlowPointer(e, f.id)"
          @rename="(name) => actions.renameFlow(f.id, name)"
          @recolor="(color) => actions.recolorFlow(f.id, color)"
          @dissolve="actions.dissolveFlow(f.id)"
        />
```

after the floating capsule (still inside the transformed layer):

```vue
        <LLassoPath v-if="lasso" :points="lasso" />
```

pass the filter to stacks: add `:dimmed-bit-ids="filterDimmed"` to `<LPacketStack …>`;

directly after the closing tag of the transformed canvas layer (`</div>` of `.origin-top-left`), still inside the container:

```vue
      <!-- Flow tool: a capture layer above every node, so a lasso can start anywhere -->
      <div
        v-if="toolStore.activeTool === 'flow'"
        class="lasso-capture"
        @pointerdown="startLasso"
      />
```

8. **Style** — append:

```css
.lasso-capture {
  position: absolute;
  inset: 0;
  z-index: 15;
  cursor: crosshair;
  touch-action: none;
}
```

9. **Double-click guard**: extend the `closest(...)` selector in `handleCanvasDoubleClick` with `, .flow__label, .flow__tools`.

10. **Empty-state hint**: change the paragraph to: "Double-click, right-click or long-press to create a bit. Drag a bit under another to build a packet; drag from the handle to draw a dependency. Press F to circle bits into a flow."

- [ ] **Step 4: Run the full frontend gate**

Run: `cd frontend; npx vitest run; npx vue-tsc --build; npx eslint .`
Expected: all PASS, exit 0.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): wire flow and filter tools into the workspace" -m "Co-Authored-By: Claude <model> <noreply@anthropic.com>"
```

---

### Task 10: End-to-end verification in the running app

- [ ] **Step 1:** `docker compose restart backend`; wait for `Nest application successfully started` and routes `/api/flow` mapped (new table via `synchronize`).
- [ ] **Step 2: API smoke test** through `http://localhost:5173/api` with the local test account (`.claude/test-account.local.json`): `POST /api/flow {bitIds:[<loose>],packetIds:[<packet>]}` → 201 "Flow N"; `GET /api/bit` shows `flowId`; `PUT /api/flow/:id {color:"#34d399"}` → 200; `PUT /api/bit/:id {flowId: <foreign>}` → 404.
- [ ] **Step 3: Browser** (`/workspace`, logged in; synthetic pointer events where the pane is hidden):
  1. Taskbar: logo centred, Select/Flow left, Filter right; light + dark readable; V/F/Esc switch.
  2. F → lasso around a loose bit and a stack → frame "Flow N" appears; tool back to Select.
  3. Click the name → rename persists after reload; hover → colour change; dissolve keeps members.
  4. Drag the frame → members move together and persist.
  5. Drag a member out → leaves; drag a loose bit in → joins; drag a stack in → joins.
  6. Dissolve a stack inside a flow (drag a step out) → remaining bit stays inside the flow.
  7. Filter: Ready / High / Today dim the rest; badge count; reset; reload keeps the selection.
- [ ] **Step 4:** `npm run lint; npm run type-check; npm test` at the repo root (note: root `lint` runs the frontend with `--fix` — check `git status` afterwards).
- [ ] **Step 5:** Commit only if something changed (`chore: verify taskbar tools end to end`).
