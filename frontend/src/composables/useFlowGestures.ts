import { ref, type ComputedRef, type Ref } from 'vue'
import { VelocityTracker, project } from '@/helpers/motion'
import type { NodeRef } from '@/types/flow'
import { CAPSULE_H, CAPSULE_W, type FlowLayout } from './useFlowLayout'
import type { Point } from './useFlowGroups'
import { findSnapTarget, type SnapTarget } from './useStackDrag'

export interface FlowGestureOptions {
  toCanvas(clientX: number, clientY: number): Point
  zoom: Ref<number>
  layout: ComputedRef<FlowLayout>
  onTapBit(bitId: string): void
  onDropBit(bitId: string, target: SnapTarget | null, pos: Point): Promise<void>
  onMovePacketEnd(packetId: string, x: number, y: number): Promise<void>
  onCreateDependency(from: NodeRef, to: NodeRef): void
  onLassoEnd(points: Point[]): void
  onMoveFlowEnd(flowId: string, dx: number, dy: number): Promise<void>
}

// Free drops glide a little: objects on a table, not a scroll view
const DECELERATION = 0.985

export function nodeAt(clientX: number, clientY: number): NodeRef | null {
  const el = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>('[data-node-type]')
  const type = el?.dataset.nodeType
  const id = el?.dataset.nodeId
  return (type === 'bit' || type === 'packet') && id ? { type, id } : null
}

export function useFlowGestures(opts: FlowGestureOptions) {
  const bitDrag = ref<{ bitId: string; x: number; y: number; target: SnapTarget | null } | null>(
    null,
  )
  const packetDrag = ref<{ packetId: string; x: number; y: number } | null>(null)
  const linkDrag = ref<{ from: NodeRef; x: number; y: number } | null>(null)
  const lasso = ref<Point[] | null>(null)
  const flowDrag = ref<{ flowId: string; dx: number; dy: number } | null>(null)
  let cancelActive: (() => void) | null = null

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

    const cancel = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < threshold) return
      moved = true
      tracker.add(ev.clientX, ev.clientY)
      handlers.move(ev)
    }
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return
      cancel()
      cancelActive = null
      const v = ev.type === 'pointercancel' ? { x: 0, y: 0 } : tracker.velocity()
      const z = opts.zoom.value
      handlers.end(ev, moved, { x: v.x / z, y: v.y / z })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    cancelActive = cancel
    return cancel
  }

  function startBitPointer(e: PointerEvent, bitId: string) {
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
        if (ev.type === 'pointercancel') {
          bitDrag.value = null
          return
        }
        if (!moved) {
          bitDrag.value = null
          opts.onTapBit(bitId)
          return
        }
        if (!drag) return
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
        try {
          await opts.onDropBit(bitId, drag.target, { x: drag.x, y: drag.y })
        } finally {
          bitDrag.value = null
        }
      },
    })
  }

  function startPacketPointer(e: PointerEvent, packetId: string) {
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
      end(ev, moved) {
        linkDrag.value = null
        if (ev.type === 'pointercancel' || !moved) return
        const to = nodeAt(ev.clientX, ev.clientY)
        if (!to || (to.type === from.type && to.id === from.id)) return
        opts.onCreateDependency(from, to)
      },
    })
  }

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

  function startFlowPointer(e: PointerEvent, flowId: string) {
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

  return {
    bitDrag,
    packetDrag,
    linkDrag,
    lasso,
    flowDrag,
    startBitPointer,
    startPacketPointer,
    startLinkPointer,
    startLasso,
    cancelLasso,
    startFlowPointer,
  }
}
