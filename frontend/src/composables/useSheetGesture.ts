import { getCurrentScope, onScopeDispose, ref } from 'vue'
import {
  Spring,
  VelocityTracker,
  project,
  rubberband,
  SPRING_DEFAULT,
  SPRING_MOMENTUM,
} from '@/helpers/motion'

export const SHEET_WIDTH = 320

/** Fraction of the width the projected end position must pass to close the sheet. */
const CLOSE_THRESHOLD = 0.4
/** px/s: a flick faster than this closes (or carries momentum) regardless of position. */
const FLICK_SPEED = 500
/** px of movement before the gesture axis is decided. */
const AXIS_LOCK_DISTANCE = 6
const IGNORED_TARGETS = 'input, textarea, button, [role="radio"], [data-no-swipe]'

/**
 * Pure release decision: where would the sheet end up if it kept its momentum?
 * @param x current position, -width (closed) … 0 (open)
 * @param vx release velocity in px/s
 */
export function decideSheetRelease(x: number, vx: number, width: number): 'close' | 'open' {
  return x + project(vx) < -CLOSE_THRESHOLD * width || vx < -FLICK_SPEED ? 'close' : 'open'
}

interface GestureState {
  pointerId: number
  startX: number
  startY: number
  startSheetX: number
  axis: 'x' | 'y' | null
  /**
   * Where the sheet was heading when grabbed in motion (null: it was at rest). A release
   * without a swipe resumes towards it: opening keeps opening, closing keeps closing.
   */
  caughtTarget: number | null
  captureEl: Element | null
}

export function useSheetGesture(opts: { onClosed: () => void }) {
  const x = ref(-SHEET_WIDTH)
  const spring = new Spring(-SHEET_WIDTH, (v) => (x.value = v))
  const tracker = new VelocityTracker()
  let gesture: GestureState | null = null

  function open(velocity?: number) {
    spring.to(0, { ...SPRING_DEFAULT, velocity })
  }

  function close(velocity?: number) {
    const config = velocity !== undefined && Math.abs(velocity) > FLICK_SPEED
    spring.to(-SHEET_WIDTH, {
      ...(config ? SPRING_MOMENTUM : SPRING_DEFAULT),
      velocity,
      onRest: opts.onClosed,
    })
  }

  function settle(vx: number) {
    if (decideSheetRelease(x.value, vx, SHEET_WIDTH) === 'close') close(vx)
    else open(vx)
  }

  function onPointerMove(e: PointerEvent) {
    if (!gesture || e.pointerId !== gesture.pointerId) return
    const dx = e.clientX - gesture.startX
    const dy = e.clientY - gesture.startY

    if (gesture.axis === null) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_LOCK_DISTANCE) return
      gesture.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (gesture.axis === 'x') {
        // Only now is it a swipe and not a click: keep the stream even if the pointer leaves
        try {
          gesture.captureEl?.setPointerCapture?.(gesture.pointerId)
        } catch {
          // pointer already gone
        }
      }
    }
    if (gesture.axis !== 'x') return

    tracker.add(e.clientX, e.clientY)
    const raw = gesture.startSheetX + dx
    // 1:1 to the left (never past closed), rubber band when pulled past open
    spring.set(raw > 0 ? rubberband(raw, SHEET_WIDTH) : Math.max(raw, -SHEET_WIDTH))
  }

  function endGesture(cancelled: boolean) {
    const g = gesture
    if (!g) return
    gesture = null
    removeListeners()
    try {
      g.captureEl?.releasePointerCapture?.(g.pointerId)
    } catch {
      // capture was never taken or already released
    }

    if (g.axis === 'x') {
      settle(cancelled ? 0 : tracker.velocity().x)
    } else if (g.caughtTarget !== null) {
      // Grabbed mid-flight but never swiped: carry on to where it was going
      if (g.caughtTarget <= -SHEET_WIDTH) close()
      else open()
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (gesture && e.pointerId === gesture.pointerId) endGesture(false)
  }

  function onPointerCancel(e: PointerEvent) {
    if (gesture && e.pointerId === gesture.pointerId) endGesture(true)
  }

  function removeListeners() {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerCancel)
  }

  function onPointerDown(e: PointerEvent) {
    if (gesture || e.button !== 0) return
    const target = e.target as Element | null
    if (target?.closest?.(IGNORED_TARGETS)) return

    // Direct input wins: freeze the sheet exactly where it is on screen, drop its momentum
    const caughtTarget = spring.isAnimating ? spring.target : null
    spring.stop()
    spring.value = x.value
    spring.target = x.value
    spring.velocity = 0

    gesture = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startSheetX: x.value,
      axis: null,
      caughtTarget,
      captureEl: e.currentTarget instanceof Element ? e.currentTarget : null,
    }
    tracker.reset()
    tracker.add(e.clientX, e.clientY)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerCancel)
  }

  if (getCurrentScope()) {
    onScopeDispose(() => {
      removeListeners()
      gesture = null
      spring.stop()
    })
  }

  return { x, open, close, onPointerDown }
}
