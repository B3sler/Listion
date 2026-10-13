# Bit & Packet Flow — Follow-ups (deferred review findings)

Collected from the per-task and final reviews of feat/bit-packet-flow. None blocks v1; triaged by the final review as "can wait" unless fixed in the final wave.

- **T1:** no @Min/@Max bounds on int DTO fields (x/y/bitIds) → huge ints 500 instead of 400
- **T1:** no tests for UpdatePacketDto / name >60 / FakeRepository unsupported operator
- **T1:** no index on bit.packetId
- **T1:** prettier flags fake-repository.spec.ts and app.module.ts (format before merge)
- **T2:** PacketService.update untested (incl. empty-DTO guard, NotFound)
- **T2:** attachBit from another packet / foreign packet untested; remove test only counts surviving deps
- **T2:** create/setBits rely on DTO for ≥2 unique bitIds (no service-level guard)
- **T2:** no transactions — partial failure can leave <2-bit packet (spec v1 accepts)
- **T2:** order gaps after detach/attach (consumers must sort, not index)
- **T3:** dedupe lookup spreads dto after userId (relies on whitelist pipe) — build where from explicit fields
- **T3:** tests miss foreign `to` end, remove/findAll owner scoping, per-user duplicate
- **T3:** no unique constraint on dependency (concurrent duplicate POSTs)
- **T4:** missing tests (move between packets, update w/o packetId, remove keeps ≥2 packet, other deps survive)
- **T4:** remove/update multi-write without transaction
- **T5:** optimistic rollback restores whole snapshot (can wipe overlapping edits) — restore only changed keys
- **T5:** updatePacket/delete*/setBits/fetch untested; optimistic block duplicated in two stores
- **T6:** member grouping+sort duplicated in useFlowLayout and useFlowState (drift risk) — extract helper
- **T6:** packet anchor uses magic 20 instead of STACK_HEADER_H/2; dependencyGeometry.angle always 0
- **T6:** sourceDone on orphan deps inconsistent; edge-case tests missing; lexicographic sort in test; tests outside tsconfig.vitest include
- **T7:** insertIndex assumes uniform pitch (expanded step shifts rows by 20)
- **T7:** overlapping stack margins resolve to first in map order; boundary tests missing; pair x-tolerance reuses STACK_SNAP_MARGIN
- **T7:** stack hit box still includes dragged bit's row during own-stack reorder (one row lenient)
- **T8:** focus ring overrides ready/cycle ring; meta line empty-priority/invalid-date; dead .capsule--expanded rule; nested backdrop-filter in stack; no title tooltips; progressbar semantics; rename mouse-only; selected arrow ✕ can be covered/dimmed; dblclick on handle opens panel; thin component tests (forwarded emits, gap line, preview)
- **T8:** capsule root Enter only (no Space); nested button in role=button; redundant "Open, Open" label; generic arrow name; focus-ring contrast unverified
- **T9:** no "gesture active" guard against concurrent second pointer; empty data-node-id → 0; lift-on-press visual needs own pressed state in Task 11 (bitDrag only set after threshold)
- **T9:** track() doesn't catch end() rejection (unhandled if onDropBit rejects; guarded() makes it moot)
- **T10:** failure path (guarded log+reload) untested; deleteBit/movePacket/renamePacket/deleteDependency/valid createDependency untested; no guard pair target === dragged; packetBefore snapshot duplicated; failed recovery reload swallowed silently
- **T11:** focusPacket pans only (keeps zoom); long-press on capsule opens Create menu; create-path panel closes before request (input lost on failure); packetRects include dragged slot during drag (arrow anchors slightly off); thin workspace test (setTimeout, mock leakage); hideTimer not cleared on unmount
- **T11:** right/ctrl-press on node now deselects; shift-click in rename input bubbles; no LWorkspace test for highlight watch; test wrappers not unmounted
Task 12: backend container did not hot-reload the new code (nest --watch without polling on Windows bind mount) — restarted backend; minor (deferred): CLAUDE.md claims polling hot reload for backend

## From the final review (not fixed in v1)
- Snap drop pops into the stack instead of springing into its row (spec Animationen).
- Arrows jump to final anchors while capsules/stacks still glide (CSS transition vs instant store).
- O(n²) bits.find in LWorkspace; build an id→Bit map.
- No @ArrayMaxSize on bitIds / no int bounds on DTOs.
- No gesture-active guard: a finished snap drop can clear a second drag started meanwhile.
- A structural reload can overwrite an in-flight optimistic free-drop position.
- A failed freed-position PUT falls back to an unpatched reload (visible jump, rare).
- Throttle key is per endpoint in @nestjs/throttler v6 (300/min each).
