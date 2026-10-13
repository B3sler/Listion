import { ref, computed, watch, type Ref } from 'vue'
import { Spring, VelocityTracker, project, SPRING_DEFAULT } from '@/helpers/motion'

const STORAGE_ZOOM = 'lZoom'
const STORAGE_PAN_X = 'lPanX'
const STORAGE_PAN_Y = 'lPanY'

const MIN_ZOOM = 0.25
const MAX_ZOOM = 3
const ZOOM_STEP = 0.1

function clampZoom(z: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
}

export function useCanvas(containerRef: Ref<HTMLElement | null>) {
  const zoom = ref(parseFloat(localStorage.getItem(STORAGE_ZOOM) ?? '1'))
  const panX = ref(parseFloat(localStorage.getItem(STORAGE_PAN_X) ?? '0'))
  const panY = ref(parseFloat(localStorage.getItem(STORAGE_PAN_Y) ?? '0'))
  const isDragging = ref(false)

  const canvasTransform = computed(
    () => `translate3d(${panX.value}px, ${panY.value}px, 0) scale(${zoom.value})`,
  )

  watch(zoom, (v) => localStorage.setItem(STORAGE_ZOOM, v.toString()))
  watch(panX, (v) => localStorage.setItem(STORAGE_PAN_X, v.toString()))
  watch(panY, (v) => localStorage.setItem(STORAGE_PAN_Y, v.toString()))

  // Independent X / Y / zoom springs — 2D motion decomposed per axis
  const springX = new Spring(panX.value, (v) => (panX.value = v))
  const springY = new Spring(panY.value, (v) => (panY.value = v))
  const springZ = new Spring(zoom.value, (v) => (zoom.value = v), {
    restDelta: 0.0001,
    restSpeed: 0.001,
  })

  /** Direct input takes over: freeze the view where it is and drop any leftover momentum. */
  function stopAll() {
    for (const [spring, live] of [
      [springX, panX.value],
      [springY, panY.value],
      [springZ, zoom.value],
    ] as const) {
      spring.stop()
      spring.value = live
      spring.velocity = 0
    }
  }

  function setView(z: number, x: number, y: number) {
    stopAll()
    zoom.value = z
    panX.value = x
    panY.value = y
    springX.set(x)
    springY.set(y)
    springZ.set(z)
  }

  /** Animate the whole view; starts from the live on-screen values, so it can be interrupted. */
  function animateView(z: number, x: number, y: number) {
    springX.value = panX.value
    springY.value = panY.value
    springZ.value = zoom.value
    springZ.to(clampZoom(z), SPRING_DEFAULT)
    springX.to(x, SPRING_DEFAULT)
    springY.to(y, SPRING_DEFAULT)
  }

  function viewForZoomAt(newZoom: number, cx: number, cy: number) {
    const clamped = clampZoom(newZoom)
    const xs = (cx - panX.value) / zoom.value
    const ys = (cy - panY.value) / zoom.value
    return { z: clamped, x: cx - xs * clamped, y: cy - ys * clamped }
  }

  function applyZoomAt(newZoom: number, cx: number, cy: number) {
    const v = viewForZoomAt(newZoom, cx, cy)
    setView(v.z, v.x, v.y)
  }

  function zoomToCenter(delta: number) {
    const el = containerRef.value
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    // Build on the current target so repeated taps accumulate instead of restarting
    const animating = springZ.isAnimating
    const base = animating
      ? { z: springZ.target, x: springX.target, y: springY.target }
      : { z: zoom.value, x: panX.value, y: panY.value }
    const z = clampZoom(base.z + delta)
    // keep the viewport centre fixed in world space
    const cxWorld = (width / 2 - base.x) / base.z
    const cyWorld = (height / 2 - base.y) / base.z
    animateView(z, width / 2 - cxWorld * z, height / 2 - cyWorld * z)
  }

  const zoomIn = () => zoomToCenter(ZOOM_STEP)
  const zoomOut = () => zoomToCenter(-ZOOM_STEP)
  const resetView = () => animateView(1, 0, 0)

  // --- Mouse drag (middle mouse or Shift+left click), 1:1 with momentum on release ---
  let dragStart = { x: 0, y: 0, panX: 0, panY: 0 }
  const tracker = new VelocityTracker()

  function handleMouseDown(e: MouseEvent) {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      e.preventDefault()
      stopAll() // grabbing a gliding canvas catches it immediately
      isDragging.value = true
      dragStart = { x: e.clientX, y: e.clientY, panX: panX.value, panY: panY.value }
      tracker.reset()
      tracker.add(e.clientX, e.clientY)
    }
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDragging.value) return
    tracker.add(e.clientX, e.clientY)
    panX.value = dragStart.panX + (e.clientX - dragStart.x)
    panY.value = dragStart.panY + (e.clientY - dragStart.y)
  }

  function glide(vx: number, vy: number) {
    // Project where the flick is going and settle there, carrying the release velocity
    springX.value = panX.value
    springY.value = panY.value
    springX.to(panX.value + project(vx), { damping: 1, response: 0.55, velocity: vx })
    springY.to(panY.value + project(vy), { damping: 1, response: 0.55, velocity: vy })
  }

  function handleMouseUp() {
    if (!isDragging.value) return
    isDragging.value = false
    const v = tracker.velocity()
    if (Math.hypot(v.x, v.y) > 80) glide(v.x, v.y)
  }

  // --- Wheel: ctrlKey = zoom (trackpad pinch / Ctrl+scroll), else = pan ---
  function handleWheel(e: WheelEvent) {
    e.preventDefault()
    // Direct input always wins over a running animation
    stopAll()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top

    if (e.ctrlKey) {
      // Trackpad pinch or Ctrl+scroll → zoom towards cursor
      applyZoomAt(zoom.value * (1 - e.deltaY * 0.01), cx, cy)
    } else {
      // Trackpad two-finger scroll or regular scroll → pan
      setView(zoom.value, panX.value - e.deltaX, panY.value - e.deltaY)
    }
  }

  // --- Touch (pinch-to-zoom + two-finger pan) ---
  let initialDistance = 0
  let initialZoom = 1
  let touchStartPan = { x: 0, y: 0 }
  let touchMidStart = { x: 0, y: 0 }
  let isTwoFingerTouch = false

  function handleTouchStart(e: TouchEvent) {
    if (e.touches.length === 2) {
      e.preventDefault()
      stopAll()
      isTwoFingerTouch = true

      const t1 = e.touches[0]!
      const t2 = e.touches[1]!
      const dx = t2.clientX - t1.clientX
      const dy = t2.clientY - t1.clientY
      initialDistance = Math.sqrt(dx * dx + dy * dy)
      initialZoom = zoom.value
      touchStartPan = { x: panX.value, y: panY.value }
      touchMidStart = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2,
      }
      tracker.reset()
      tracker.add(touchMidStart.x, touchMidStart.y)
    }
  }

  function handleTouchMove(e: TouchEvent) {
    if (e.touches.length === 2 && isTwoFingerTouch) {
      e.preventDefault()
      const t1 = e.touches[0]!
      const t2 = e.touches[1]!
      const dx = t2.clientX - t1.clientX
      const dy = t2.clientY - t1.clientY
      const currentDistance = Math.sqrt(dx * dx + dy * dy)
      const newZoom = clampZoom(initialZoom * (currentDistance / initialDistance))
      const midX = (t1.clientX + t2.clientX) / 2
      const midY = (t1.clientY + t2.clientY) / 2
      tracker.add(midX, midY)

      panX.value = touchStartPan.x + (midX - touchMidStart.x)
      panY.value = touchStartPan.y + (midY - touchMidStart.y)
      zoom.value = newZoom
    }
  }

  function handleTouchEnd() {
    if (isTwoFingerTouch) {
      const v = tracker.velocity()
      if (Math.hypot(v.x, v.y) > 80) glide(v.x, v.y)
    }
    isTwoFingerTouch = false
  }

  return {
    zoom,
    panX,
    panY,
    canvasTransform,
    isDragging,
    zoomIn,
    zoomOut,
    resetView,
    animateView,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  }
}
