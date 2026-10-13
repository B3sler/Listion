// Motion primitives after Apple's "Designing Fluid Interfaces" (WWDC 2018).
// Springs are parameterised like UIKit: damping ratio (1 = no overshoot) and
// response (seconds, roughly the period of the undamped oscillation).

export interface SpringConfig {
  damping?: number
  response?: number
}

/** Default UI spring: critically damped, no overshoot. */
export const SPRING_DEFAULT: Required<SpringConfig> = { damping: 1, response: 0.35 }
/** Only after a gesture that carried momentum (flick, throw, release). */
export const SPRING_MOMENTUM: Required<SpringConfig> = { damping: 0.8, response: 0.35 }

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Distance a flick travels before coming to rest (Apple's exponential-decay projection).
 * @param velocity px/s
 * @param decelerationRate 0.998 = scroll feel, 0.99 = snappier
 */
export function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate)
}

/** Progressive resistance past a boundary — real things slow down before they stop. */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot))
}

/** Tracks the last few pointer samples so the release velocity is available. */
export class VelocityTracker {
  private samples: { t: number; x: number; y: number }[] = []

  reset() {
    this.samples = []
  }

  add(x: number, y: number, t = performance.now()) {
    this.samples.push({ t, x, y })
    // keep ~100ms of history
    while (this.samples.length > 2 && t - this.samples[0]!.t > 100) this.samples.shift()
  }

  /**
   * px/s; zero when the pointer rested before release. Clamped to a speed a real
   * hand can produce, so coalesced or synthetic events can't fling things off-screen.
   */
  velocity(now = performance.now(), maxSpeed = 4000): { x: number; y: number } {
    const first = this.samples[0]
    const last = this.samples[this.samples.length - 1]
    if (!first || !last || first === last || now - last.t > 60) return { x: 0, y: 0 }
    // at least one frame of history, otherwise a single jump reads as infinite speed
    const dt = Math.max(last.t - first.t, 16) / 1000
    let x = (last.x - first.x) / dt
    let y = (last.y - first.y) / dt
    const speed = Math.hypot(x, y)
    if (speed > maxSpeed) {
      x *= maxSpeed / speed
      y *= maxSpeed / speed
    }
    return { x, y }
  }
}

/**
 * A single interruptible spring value. Retargeting keeps the current value *and*
 * velocity, so reversing mid-flight never hits a "brick wall".
 */
export class Spring {
  value: number
  velocity = 0
  target: number
  private stiffness = 0
  private dampingCoeff = 0
  private frame: number | null = null
  private last = 0
  private onUpdate: (v: number) => void
  private onRest?: () => void
  // Rest thresholds are in the value's own unit: the defaults suit pixels, a scale
  // factor (zoom) needs far finer ones or it visibly snaps onto its target.
  private readonly restDelta: number
  private readonly restSpeed: number

  constructor(
    initial: number,
    onUpdate: (v: number) => void,
    precision: { restDelta?: number; restSpeed?: number } = {},
  ) {
    this.value = initial
    this.target = initial
    this.onUpdate = onUpdate
    this.restDelta = precision.restDelta ?? 0.05
    this.restSpeed = precision.restSpeed ?? 0.5
  }

  get isAnimating() {
    return this.frame !== null
  }

  /** Jump without animation (e.g. while the finger drives the value 1:1). */
  set(value: number) {
    this.stop()
    this.value = value
    this.target = value
    this.velocity = 0
    this.onUpdate(value)
  }

  stop() {
    if (this.frame !== null) cancelAnimationFrame(this.frame)
    this.frame = null
  }

  to(target: number, opts: SpringConfig & { velocity?: number; onRest?: () => void } = {}) {
    const { damping, response } = { ...SPRING_DEFAULT, ...opts }
    this.target = target
    if (opts.velocity !== undefined) this.velocity = opts.velocity
    this.onRest = opts.onRest

    if (prefersReducedMotion()) {
      this.set(target)
      this.onRest?.()
      return
    }

    // UIKit mapping: stiffness = (2π / response)², damping = 4π·ζ / response (mass = 1)
    this.stiffness = Math.pow((2 * Math.PI) / response, 2)
    this.dampingCoeff = (4 * Math.PI * damping) / response

    if (this.frame === null) {
      this.last = performance.now()
      this.frame = requestAnimationFrame(this.tick)
    }
  }

  private tick = (now: number) => {
    // clamp dt so a backgrounded tab doesn't explode the integration
    let dt = Math.min(0.064, (now - this.last) / 1000)
    this.last = now
    // semi-implicit Euler in small sub-steps for stability
    while (dt > 0) {
      const h = Math.min(dt, 1 / 240)
      const force = -this.stiffness * (this.value - this.target) - this.dampingCoeff * this.velocity
      this.velocity += force * h
      this.value += this.velocity * h
      dt -= h
    }

    const settled =
      Math.abs(this.velocity) < this.restSpeed &&
      Math.abs(this.value - this.target) < this.restDelta
    if (settled) {
      this.value = this.target
      this.velocity = 0
      this.frame = null
      this.onUpdate(this.value)
      this.onRest?.()
      return
    }
    this.onUpdate(this.value)
    this.frame = requestAnimationFrame(this.tick)
  }
}
