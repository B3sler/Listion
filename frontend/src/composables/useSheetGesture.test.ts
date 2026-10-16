import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { effectScope } from 'vue'
import { SHEET_WIDTH, decideSheetRelease, useSheetGesture } from './useSheetGesture'

// Drive requestAnimationFrame manually so the spring can be stepped deterministically
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

function setup() {
  const onClosed = vi.fn()
  const g = useSheetGesture({ onClosed })
  const el = document.createElement('div')
  el.setPointerCapture = vi.fn()
  el.releasePointerCapture = vi.fn()
  return { g, onClosed, el }
}

function down(
  g: ReturnType<typeof useSheetGesture>,
  el: HTMLElement,
  x: number,
  y = 100,
  target: EventTarget = el,
) {
  g.onPointerDown({
    button: 0,
    pointerId: 1,
    clientX: x,
    clientY: y,
    target,
    currentTarget: el,
  } as unknown as PointerEvent)
}

function fire(type: 'pointermove' | 'pointerup' | 'pointercancel', x = 0, y = 100) {
  window.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1 }))
}

/** Move in 16 ms strokes so the velocity tracker sees a realistic speed (px/s = dx / 0.016). */
function dragTo(fromX: number, toX: number, y = 100, strokes = 5) {
  for (let i = 1; i <= strokes; i++) {
    now += 16
    fire('pointermove', fromX + ((toX - fromX) * i) / strokes, y)
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

describe('decideSheetRelease', () => {
  it('lässt das Sheet offen, solange es weniger als 40 % verschoben ist', () => {
    expect(decideSheetRelease(-100, 0, 320)).toBe('open')
  })

  it('schließt ab 40 % der Breite', () => {
    expect(decideSheetRelease(-140, 0, 320)).toBe('close')
  })

  it('schließt bei einem schnellen Wisch nach links', () => {
    expect(decideSheetRelease(-20, -600, 320)).toBe('close')
  })

  it('bleibt offen, wenn ein Wurf nach rechts die Position überstimmt', () => {
    expect(decideSheetRelease(-200, 800, 320)).toBe('open')
  })

  it('wertet die projizierte Endposition aus, nicht nur die aktuelle', () => {
    // 0 + project(-300) ≈ -150 < -128
    expect(decideSheetRelease(0, -300, 320)).toBe('close')
  })
})

describe('useSheetGesture Animation', () => {
  it('startet zu bei -SHEET_WIDTH', () => {
    const { g } = setup()
    expect(g.x.value).toBe(-SHEET_WIDTH)
  })

  it('open() endet bei x = 0', () => {
    const { g } = setup()
    g.open()
    step(120)
    expect(g.x.value).toBe(0)
  })

  it('close() endet bei -320 und ruft onClosed genau einmal auf', () => {
    const { g, onClosed } = setup()
    g.open()
    step(120)
    g.close()
    step(120)
    expect(g.x.value).toBe(-SHEET_WIDTH)
    expect(onClosed).toHaveBeenCalledTimes(1)
  })

  it('springt bei Reduced Motion direkt ans Ziel', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
    const { g, onClosed } = setup()
    g.open()
    expect(g.x.value).toBe(0)
    g.close()
    expect(g.x.value).toBe(-SHEET_WIDTH)
    expect(onClosed).toHaveBeenCalledTimes(1)
  })
})

describe('useSheetGesture Geste', () => {
  function openSheet() {
    const s = setup()
    s.g.open()
    step(120)
    return s
  }

  it('folgt dem Pointer nach links 1:1 und berücksichtigt die Greifposition', () => {
    const { g, el } = openSheet()
    down(g, el, 200)
    dragTo(200, 150)
    expect(g.x.value).toBe(-50)
    fire('pointerup', 150)
  })

  it('legt die Achse erst nach 6 px fest', () => {
    const { g, el } = openSheet()
    down(g, el, 200)
    now += 16
    fire('pointermove', 196)
    expect(g.x.value).toBe(0)
    now += 16
    fire('pointermove', 192)
    expect(g.x.value).toBe(-8)
    fire('pointerup', 192)
  })

  it('ignoriert eine Bewegung, die mehr vertikal als horizontal ist', () => {
    const { g, el } = openSheet()
    down(g, el, 200, 100)
    now += 16
    fire('pointermove', 190, 130)
    now += 16
    fire('pointermove', 100, 140)
    expect(g.x.value).toBe(0)
    fire('pointerup', 100, 140)
    step(120)
    expect(g.x.value).toBe(0)
  })

  it('startet eine neue Geste an der aktuellen Sheet-Position', () => {
    const { g, el } = openSheet()
    down(g, el, 200)
    dragTo(200, 140) // x = -60
    now += 200
    fire('pointerup', 140) // rests: springs back towards open
    step(3)
    const live = g.x.value
    expect(live).toBeLessThan(0)
    expect(live).toBeGreaterThan(-60)
    down(g, el, 100)
    dragTo(100, 80)
    expect(g.x.value).toBeCloseTo(live - 20, 5)
    fire('pointerup', 80)
  })

  it('gibt nach rechts über 0 hinaus Gummiband-Widerstand', () => {
    const { g, el } = openSheet()
    down(g, el, 100)
    dragTo(100, 200)
    expect(g.x.value).toBeGreaterThan(0)
    expect(g.x.value).toBeLessThan(100)
    fire('pointerup', 200)
  })

  it('begrenzt das Ziehen nach links auf die geschlossene Position', () => {
    const { g, el } = openSheet()
    down(g, el, 400)
    dragTo(400, 0)
    expect(g.x.value).toBe(-SHEET_WIDTH)
    fire('pointerup', 0)
  })

  it('schließt bei einem schnellen Wisch und ruft onClosed genau einmal auf', () => {
    const { g, el, onClosed } = openSheet()
    down(g, el, 200)
    dragTo(200, 150) // 50 px in 80 ms = 625 px/s
    fire('pointerup', 150)
    step(200)
    expect(g.x.value).toBe(-SHEET_WIDTH)
    expect(onClosed).toHaveBeenCalledTimes(1)
  })

  it('federt zurück auf offen, wenn das Sheet nur wenig verschoben wurde', () => {
    const { g, el, onClosed } = openSheet()
    down(g, el, 200)
    dragTo(200, 160) // 40 px, then rests
    now += 200
    fire('pointerup', 160)
    step(200)
    expect(g.x.value).toBe(0)
    expect(onClosed).not.toHaveBeenCalled()
  })

  it('schließt, wenn es über 40 % gezogen und gehalten wird', () => {
    const { g, el, onClosed } = openSheet()
    down(g, el, 300)
    dragTo(300, 150)
    now += 200
    fire('pointerup', 150)
    step(200)
    expect(g.x.value).toBe(-SHEET_WIDTH)
    expect(onClosed).toHaveBeenCalledTimes(1)
  })

  it('greift ein schließendes Sheet an der aktuellen Position ohne Sprung', () => {
    const { g, el, onClosed } = openSheet()
    g.close()
    step(8)
    const mid = g.x.value
    expect(mid).toBeLessThan(0)
    expect(mid).toBeGreaterThan(-SHEET_WIDTH)
    down(g, el, 200)
    expect(queue).toHaveLength(0)
    expect(g.x.value).toBe(mid)
    step(30)
    expect(g.x.value).toBe(mid)
    dragTo(200, 195) // still within the 6 px dead zone
    expect(g.x.value).toBe(mid)
    fire('pointerup', 195)
    expect(onClosed).not.toHaveBeenCalled()
  })

  it('führt ein ohne Bewegung losgelassenes, schließendes Sheet zu Ende, auch kurz nach dem Start', () => {
    const { g, el, onClosed } = openSheet()
    g.close()
    step(2)
    // caught early: by position alone (less than 40 % out) it would spring back open
    expect(g.x.value).toBeGreaterThan(-0.4 * SHEET_WIDTH)
    down(g, el, 200)
    fire('pointerup', 200)
    step(300)
    expect(g.x.value).toBe(-SHEET_WIDTH)
    expect(onClosed).toHaveBeenCalledTimes(1)
  })

  it('führt ein ohne Bewegung losgelassenes, öffnendes Sheet zu Ende, auch kurz nach dem Start', () => {
    const { g, el, onClosed } = setup()
    g.open()
    step(2)
    // caught early: by position alone (more than 40 % out) it would close again
    expect(g.x.value).toBeLessThan(-0.4 * SHEET_WIDTH)
    down(g, el, 200)
    fire('pointerup', 200)
    step(300)
    expect(g.x.value).toBe(0)
    expect(onClosed).not.toHaveBeenCalled()
  })

  it('ruft onClosed nicht auf, wenn ein schließendes Sheet zurückgeholt wird', () => {
    const { g, onClosed } = openSheet()
    g.close()
    step(8)
    g.open()
    step(200)
    expect(g.x.value).toBe(0)
    expect(onClosed).not.toHaveBeenCalled()
  })

  it('ignoriert Pointer-down auf Eingabefeldern, Buttons und data-no-swipe', () => {
    const { g, el } = openSheet()
    const input = document.createElement('input')
    const inner = document.createElement('span')
    const button = document.createElement('button')
    button.appendChild(inner)
    const radio = document.createElement('div')
    radio.setAttribute('role', 'radio')
    const noSwipe = document.createElement('div')
    noSwipe.setAttribute('data-no-swipe', '')
    el.append(input, button, radio, noSwipe)
    for (const target of [input, inner, radio, noSwipe]) {
      down(g, el, 200, 100, target)
      now += 16
      fire('pointermove', 100)
      expect(g.x.value).toBe(0)
      fire('pointerup', 100)
    }
  })

  it('nutzt Pointer Capture erst, wenn die Geste horizontal ist', () => {
    const { g, el } = openSheet()
    down(g, el, 200)
    expect(el.setPointerCapture).not.toHaveBeenCalled()
    dragTo(200, 150)
    expect(el.setPointerCapture).toHaveBeenCalledWith(1)
    fire('pointerup', 150)
    expect(el.releasePointerCapture).toHaveBeenCalledWith(1)
  })

  it('funktioniert, wenn setPointerCapture fehlt', () => {
    const { g } = openSheet()
    const bare = document.createElement('div')
    down(g, bare, 200)
    expect(() => dragTo(200, 150)).not.toThrow()
    expect(g.x.value).toBe(-50)
    fire('pointerup', 150)
  })

  it('behandelt pointercancel wie ein Loslassen', () => {
    const { g, el } = openSheet()
    down(g, el, 200)
    dragTo(200, 150)
    now += 200
    fire('pointercancel', 150)
    step(200)
    expect(g.x.value).toBe(0)
  })

  it('entfernt die Window-Listener, wenn der Scope endet', () => {
    const scope = effectScope()
    const onClosed = vi.fn()
    const g = scope.run(() => useSheetGesture({ onClosed }))!
    g.open()
    step(120)
    const el = document.createElement('div')
    down(g, el, 200)
    scope.stop()
    now += 16
    fire('pointermove', 100)
    expect(g.x.value).toBe(0)
  })
})
