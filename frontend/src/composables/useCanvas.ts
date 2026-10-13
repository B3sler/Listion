import { ref, computed, watch, type Ref } from 'vue'

const STORAGE_ZOOM = 'lZoom'
const STORAGE_PAN_X = 'lPanX'
const STORAGE_PAN_Y = 'lPanY'

const MIN_ZOOM = 0.25
const MAX_ZOOM = 3
const ZOOM_STEP = 0.1

export function useCanvas(containerRef: Ref<HTMLElement | null>) {
  const zoom = ref(parseFloat(localStorage.getItem(STORAGE_ZOOM) ?? '1'))
  const panX = ref(parseFloat(localStorage.getItem(STORAGE_PAN_X) ?? '0'))
  const panY = ref(parseFloat(localStorage.getItem(STORAGE_PAN_Y) ?? '0'))
  const isDragging = ref(false)

  const canvasTransform = computed(
    () => `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`,
  )

  watch(zoom, (v) => localStorage.setItem(STORAGE_ZOOM, v.toString()))
  watch(panX, (v) => localStorage.setItem(STORAGE_PAN_X, v.toString()))
  watch(panY, (v) => localStorage.setItem(STORAGE_PAN_Y, v.toString()))

  function applyZoomAt(newZoom: number, cx: number, cy: number) {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom))
    const xs = (cx - panX.value) / zoom.value
    const ys = (cy - panY.value) / zoom.value
    panX.value = cx - xs * clamped
    panY.value = cy - ys * clamped
    zoom.value = clamped
  }

  function zoomToCenter(delta: number) {
    const el = containerRef.value
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    applyZoomAt(zoom.value + delta, width / 2, height / 2)
  }

  const zoomIn = () => zoomToCenter(ZOOM_STEP)
  const zoomOut = () => zoomToCenter(-ZOOM_STEP)
  const resetView = () => {
    zoom.value = 1
    panX.value = 0
    panY.value = 0
  }

  // --- Mouse drag (middle mouse or Shift+left click) ---
  let dragStart = { x: 0, y: 0, panX: 0, panY: 0 }

  function handleMouseDown(e: MouseEvent) {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      e.preventDefault()
      isDragging.value = true
      dragStart = { x: e.clientX, y: e.clientY, panX: panX.value, panY: panY.value }
    }
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDragging.value) return
    panX.value = dragStart.panX + (e.clientX - dragStart.x)
    panY.value = dragStart.panY + (e.clientY - dragStart.y)
  }

  function handleMouseUp() {
    isDragging.value = false
  }

  // --- Wheel: ctrlKey = zoom (trackpad pinch / Ctrl+scroll), else = pan ---
  function handleWheel(e: WheelEvent) {
    e.preventDefault()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top

    if (e.ctrlKey) {
      // Trackpad pinch or Ctrl+scroll → zoom towards cursor
      applyZoomAt(zoom.value * (1 - e.deltaY * 0.01), cx, cy)
    } else {
      // Trackpad two-finger scroll or regular scroll → pan
      panX.value -= e.deltaX
      panY.value -= e.deltaY
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
      const newZoom = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, initialZoom * (currentDistance / initialDistance)),
      )
      const midX = (t1.clientX + t2.clientX) / 2
      const midY = (t1.clientY + t2.clientY) / 2

      panX.value = touchStartPan.x + (midX - touchMidStart.x)
      panY.value = touchStartPan.y + (midY - touchMidStart.y)
      zoom.value = newZoom
    }
  }

  function handleTouchEnd() {
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
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  }
}
