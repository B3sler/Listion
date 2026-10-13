import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { useCanvas } from './useCanvas'

// Drive requestAnimationFrame manually so the view springs can be stepped deterministically
let now = 0
let queue: FrameRequestCallback[] = []

function step(frames: number, dt = 1000 / 60) {
  for (let i = 0; i < frames; i++) {
    now += dt
    const cbs = queue
    queue = []
    cbs.forEach((cb) => cb(now))
  }
}

const WIDTH = 800
const HEIGHT = 600

function setup() {
  const el = { getBoundingClientRect: () => ({ width: WIDTH, height: HEIGHT }) } as HTMLElement
  return useCanvas(ref(el))
}

function mouse(clientX: number, clientY: number, extra: Partial<MouseEvent> = {}) {
  return {
    button: 0,
    shiftKey: true,
    clientX,
    clientY,
    preventDefault() {},
    ...extra,
  } as MouseEvent
}

/** World point under the viewport centre for the current view. */
function centreWorld(c: ReturnType<typeof setup>) {
  return {
    x: (WIDTH / 2 - c.panX.value) / c.zoom.value,
    y: (HEIGHT / 2 - c.panY.value) / c.zoom.value,
  }
}

beforeEach(() => {
  now = 0
  queue = []
  localStorage.clear()
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    queue.push(cb)
    return queue.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => {
    queue = []
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('useCanvas view controls', () => {
  it('zoom in keeps the point under the viewport centre fixed on every frame', () => {
    const c = setup()
    const start = centreWorld(c)
    c.zoomIn()
    for (let i = 0; i < 90; i++) {
      step(1)
      const w = centreWorld(c)
      expect(Math.abs(w.x - start.x)).toBeLessThan(0.05)
      expect(Math.abs(w.y - start.y)).toBeLessThan(0.05)
    }
    expect(c.zoom.value).toBeCloseTo(1.1, 6)
  })

  it('zoom and pan settle together — no zoom snap while the view still slides', () => {
    const c = setup()
    c.animateView(0.5, 100, 50)
    let previousZoom = c.zoom.value
    let snapStep: number | null = null
    for (let i = 0; i < 120; i++) {
      step(1)
      if (snapStep === null && c.zoom.value === 0.5) {
        // the step that lands exactly on the target must not be a visible jump…
        snapStep = Math.abs(c.zoom.value - previousZoom)
        // …and the pan must already be there too, not still sliding
        expect(Math.abs(c.panX.value - 100)).toBeLessThan(1)
        expect(Math.abs(c.panY.value - 50)).toBeLessThan(1)
      }
      previousZoom = c.zoom.value
    }
    expect(snapStep).not.toBeNull()
    expect(snapStep!).toBeLessThan(0.001)
    expect(c.zoom.value).toBe(0.5)
    expect(c.panX.value).toBe(100)
  })

  it('grabbing a gliding canvas drops its momentum, so the next zoom does not shoot off', () => {
    const c = setup()
    // fast shift-drag → release → glide
    c.handleMouseDown(mouse(0, 0))
    for (let i = 1; i <= 5; i++) {
      now += 16
      c.handleMouseMove(mouse(i * 60, 0))
    }
    c.handleMouseUp()
    step(3)
    // grab the gliding canvas and let go without moving
    c.handleMouseDown(mouse(500, 300))
    now += 200
    c.handleMouseUp()

    const start = centreWorld(c)
    c.zoomIn()
    for (let i = 0; i < 90; i++) {
      step(1)
      const w = centreWorld(c)
      expect(Math.abs(w.x - start.x)).toBeLessThan(0.05)
    }
  })
})
