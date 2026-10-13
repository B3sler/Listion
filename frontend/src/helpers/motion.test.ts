import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Spring, VelocityTracker, project, rubberband } from './motion'

// Drive requestAnimationFrame manually so springs can be stepped deterministically
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

beforeEach(() => {
  now = 0
  queue = []
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

describe('project', () => {
  it('projects further for faster flicks and is symmetric', () => {
    expect(project(1000)).toBeCloseTo(499, 0)
    expect(project(-1000)).toBeCloseTo(-499, 0)
    expect(project(1000, 0.99)).toBeLessThan(project(1000, 0.998))
    expect(project(0)).toBe(0)
  })
})

describe('rubberband', () => {
  it('follows less the further it is pulled and never exceeds the input', () => {
    const a = rubberband(50, 100)
    const b = rubberband(200, 100)
    expect(a).toBeGreaterThan(0)
    expect(a).toBeLessThan(50)
    expect(b - a).toBeLessThan(150)
    expect(rubberband(-50, 100)).toBeCloseTo(-a)
  })
})

describe('VelocityTracker', () => {
  it('measures velocity from recent samples', () => {
    const t = new VelocityTracker()
    t.add(0, 0, 0)
    t.add(10, 0, 16)
    t.add(20, 0, 32)
    expect(t.velocity(40).x).toBeCloseTo(625, 0)
  })

  it('reports zero when the pointer rested before release', () => {
    const t = new VelocityTracker()
    t.add(0, 0, 0)
    t.add(50, 0, 16)
    expect(t.velocity(200)).toEqual({ x: 0, y: 0 })
  })

  it('clamps unrealistic jumps (synthetic or coalesced events)', () => {
    const t = new VelocityTracker()
    t.add(0, 0, 0)
    t.add(5000, 0, 1)
    const v = t.velocity(2)
    expect(Math.hypot(v.x, v.y)).toBeLessThanOrEqual(4000.0001)
  })
})

describe('Spring', () => {
  it('settles on the target without overshoot when critically damped', () => {
    let v = 0
    const s = new Spring(0, (x) => (v = x))
    let max = 0
    s.to(100, { damping: 1, response: 0.35 })
    for (let i = 0; i < 120; i++) {
      step(1)
      max = Math.max(max, v)
    }
    expect(v).toBe(100)
    expect(max).toBeLessThanOrEqual(100.0001)
    expect(s.isAnimating).toBe(false)
  })

  it('overshoots slightly with momentum damping', () => {
    let v = 0
    const s = new Spring(0, (x) => (v = x))
    let max = 0
    s.to(100, { damping: 0.8, response: 0.35 })
    for (let i = 0; i < 120; i++) {
      step(1)
      max = Math.max(max, v)
    }
    expect(max).toBeGreaterThan(100)
    expect(v).toBe(100)
  })

  it('retargets mid-flight from the live value without jumping', () => {
    let v = 0
    const s = new Spring(0, (x) => (v = x))
    s.to(100)
    step(6)
    const mid = v
    s.to(-100)
    step(1)
    // continuous: the next frame is close to where it was, not reset to the old target or 0
    expect(Math.abs(v - mid)).toBeLessThan(20)
    step(200)
    expect(v).toBe(-100)
  })

  it('hands off initial velocity', () => {
    let a = 0
    let b = 0
    const still = new Spring(0, (x) => (a = x))
    const thrown = new Spring(0, (x) => (b = x))
    still.to(100)
    thrown.to(100, { velocity: 2000 })
    step(3)
    expect(b).toBeGreaterThan(a)
  })
})
