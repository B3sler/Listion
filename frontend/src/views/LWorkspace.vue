<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import LContextMenu from '@/components/LContextMenu.vue'
import LBit from '@/components/LBit.vue'
import LBitPanel from '@/components/LBitPanel.vue'
import { useTheme } from '@/composables/useTheme.ts'
import { useCanvas } from '@/composables/useCanvas.ts'
import LTaskbar from '@/layout/LTaskbar.vue'
import LMenu from '@/layout/LMenu.vue'
import { ScanSearch, ZoomIn, ZoomOut, Fullscreen } from 'lucide-vue-next'
import { useBitStore } from '@/stores/bitStore'
import { useConnectionStore, type Side } from '@/stores/connectionStore'

type ContextMenuState = {
  visible: boolean
  x: number
  y: number
}

const containerRef = ref<HTMLElement | null>(null)

const {
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
} = useCanvas(containerRef)

const bitStore = useBitStore()
const connectionStore = useConnectionStore()

// canvas-space coordinates of the last right-click
const contextCanvasPos = ref({ x: 0, y: 0 })
const contextMenu = ref<ContextMenuState>({ visible: false, x: 0, y: 0 })

const showContextMenu = (x: number, y: number) => {
  contextMenu.value = { visible: true, x, y }
}

const closeContextMenu = () => {
  contextMenu.value.visible = false
}

const handleContextMenu = (event: MouseEvent) => {
  event.preventDefault()
  const rect = containerRef.value!.getBoundingClientRect()
  contextCanvasPos.value = {
    x: (event.clientX - rect.left - panX.value) / zoom.value,
    y: (event.clientY - rect.top - panY.value) / zoom.value,
  }
  showContextMenu(event.clientX, event.clientY)
}

// ── long-press (touch) ─────────────────────────────────────────────
let longPressTimer: number | null = null
const LONG_PRESS_DURATION = 500

const handleTouchStartWithLongPress = (event: TouchEvent) => {
  if (event.touches.length === 1) {
    const touch = event.touches[0]!
    longPressTimer = window.setTimeout(() => {
      const rect = containerRef.value!.getBoundingClientRect()
      contextCanvasPos.value = {
        x: (touch.clientX - rect.left - panX.value) / zoom.value,
        y: (touch.clientY - rect.top - panY.value) / zoom.value,
      }
      showContextMenu(touch.clientX, touch.clientY)
    }, LONG_PRESS_DURATION)
  } else {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null }
  }
  handleTouchStart(event)
}

const handleTouchMoveWithLongPress = (event: TouchEvent) => {
  if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null }
  handleTouchMove(event)
}

const handleTouchEndWithLongPress = (event: TouchEvent) => {
  if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null }
  handleTouchEnd(event)
}

// ── snap & connection logic ─────────────────────────────────────────
const SNAP_THRESHOLD = 50 // world-space pixels

// Dot positions relative to bit center (bit is 144×144, centered at bit.x/bit.y)
// Diagonal dots at midpoints of the 45° edges: (126,18), (126,126), (18,126), (18,18)
// Offset from center (72,72): ±54 on each axis
const DOT_OFFSETS: Record<Side, { x: number; y: number }> = {
  'top':          { x: 0,     y: -70.5 },
  'top-right':    { x: 54,    y: -54   },
  'right':        { x: 70.5,  y: 0     },
  'bottom-right': { x: 54,    y: 54    },
  'bottom':       { x: 0,     y: 70.5  },
  'bottom-left':  { x: -54,   y: 54    },
  'left':         { x: -70.5, y: 0     },
  'top-left':     { x: -54,   y: -54   },
}

const SIDES: Side[] = ['top', 'top-right', 'right', 'bottom-right', 'bottom', 'bottom-left', 'left', 'top-left']

// Only the geometrically opposite side may connect — the one rule that guarantees no overlap
const OPPOSITE: Record<Side, Side> = {
  'top':          'bottom',
  'top-right':    'bottom-left',
  'right':        'left',
  'bottom-right': 'top-left',
  'bottom':       'top',
  'bottom-left':  'top-right',
  'left':         'right',
  'top-left':     'bottom-right',
}

function getOccupiedSides(bitId: number): Set<Side> {
  const occupied = new Set<Side>()
  for (const conn of connectionStore.connections) {
    if (conn.fromBitId === bitId) occupied.add(conn.fromSide)
    if (conn.toBitId === bitId) occupied.add(conn.toSide)
  }
  return occupied
}

interface SnapInfo {
  fromBitId: number
  fromSide: Side
  toBitId: number
  toSide: Side
  snappedX: number
  snappedY: number
}

const activeSnap = ref<SnapInfo | null>(null)
const snapHighlights = ref<Map<number, Side>>(new Map())
const newConnectionIds = ref<Set<number>>(new Set())

function onBitDragMove(id: number, x: number, y: number) {
  const otherBits = bitStore.bits.filter((b) => b.id !== id)
  const draggedOccupied = getOccupiedSides(id)
  let best: { dist: number; snap: SnapInfo } | null = null

  for (const fromSide of SIDES) {
    if (draggedOccupied.has(fromSide)) continue
    const toSide = OPPOSITE[fromSide]
    const fromDot = { x: x + DOT_OFFSETS[fromSide].x, y: y + DOT_OFFSETS[fromSide].y }
    for (const other of otherBits) {
      if (getOccupiedSides(other.id).has(toSide)) continue
      const toDot = { x: other.x! + DOT_OFFSETS[toSide].x, y: other.y! + DOT_OFFSETS[toSide].y }
      const dist = Math.hypot(fromDot.x - toDot.x, fromDot.y - toDot.y)
      if (dist < SNAP_THRESHOLD && (!best || dist < best.dist)) {
        best = {
          dist,
          snap: {
            fromBitId: id,
            fromSide,
            toBitId: other.id,
            toSide,
            snappedX: toDot.x - DOT_OFFSETS[fromSide].x,
            snappedY: toDot.y - DOT_OFFSETS[fromSide].y,
          },
        }
      }
    }
  }

  const newHighlights = new Map<number, Side>()
  if (best) {
    activeSnap.value = best.snap
    newHighlights.set(best.snap.fromBitId, best.snap.fromSide)
    newHighlights.set(best.snap.toBitId, best.snap.toSide)
  } else {
    activeSnap.value = null
  }
  snapHighlights.value = newHighlights
}

// ── connection rendering ────────────────────────────────────────────
const CP_DIST = 90

// Diagonal control point offsets at 45°: CP_DIST / √2 ≈ 63.6
const D = Math.round(CP_DIST / Math.SQRT2)
const CP_OFFSETS: Record<Side, { x: number; y: number }> = {
  'top':          { x: 0,        y: -CP_DIST },
  'top-right':    { x: D,        y: -D       },
  'right':        { x: CP_DIST,  y: 0        },
  'bottom-right': { x: D,        y: D        },
  'bottom':       { x: 0,        y: CP_DIST  },
  'bottom-left':  { x: -D,       y: D        },
  'left':         { x: -CP_DIST, y: 0        },
  'top-left':     { x: -D,       y: -D       },
}

const connectionPaths = computed(() =>
  connectionStore.connections
    .map((conn) => {
      const from = bitStore.bits.find((b) => b.id === conn.fromBitId)
      const to   = bitStore.bits.find((b) => b.id === conn.toBitId)
      if (!from || !to || from.x == null || from.y == null || to.x == null || to.y == null) return null

      const fx = from.x + DOT_OFFSETS[conn.fromSide].x
      const fy = from.y + DOT_OFFSETS[conn.fromSide].y
      const tx = to.x   + DOT_OFFSETS[conn.toSide].x
      const ty = to.y   + DOT_OFFSETS[conn.toSide].y
      const cp1x = fx + CP_OFFSETS[conn.fromSide].x
      const cp1y = fy + CP_OFFSETS[conn.fromSide].y
      const cp2x = tx + CP_OFFSETS[conn.toSide].x
      const cp2y = ty + CP_OFFSETS[conn.toSide].y

      return {
        id: conn.id,
        d: `M ${fx} ${fy} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${tx} ${ty}`,
        fx, fy, tx, ty,
        isNew: newConnectionIds.value.has(conn.id),
      }
    })
    .filter(Boolean),
)

// ── bit panel ──────────────────────────────────────────────────────
const showPanel    = ref(false)
const panelMode    = ref<'create' | 'edit'>('create')
const panelBitId   = ref<number | null>(null)
const panelBit     = computed(() =>
  panelBitId.value !== null
    ? bitStore.bits.find((b) => b.id === panelBitId.value)
    : undefined,
)

const createBit = () => {
  closeContextMenu()
  panelMode.value  = 'create'
  panelBitId.value = null
  showPanel.value  = true
}

const openBitDetail = (id: number) => {
  panelMode.value  = 'edit'
  panelBitId.value = id
  showPanel.value  = true
}

const onPanelConfirm = async (data: {
  title: string
  status: number
  priority: number | undefined
  dueDate: string | undefined
  notes: string | undefined
}) => {
  if (panelMode.value === 'create') {
    showPanel.value = false
    try {
      await bitStore.createBit({
        title: data.title,
        x: contextCanvasPos.value.x,
        y: contextCanvasPos.value.y,
        status: data.status,
        priority: data.priority,
        dueDate: data.dueDate,
        notes: data.notes,
      })
    } catch (e) {
      console.error('Failed to create bit:', e)
    }
  } else if (panelBitId.value !== null) {
    try {
      await bitStore.updateBit(panelBitId.value, {
        title: data.title,
        status: data.status,
        priority: data.priority,
        dueDate: data.dueDate,
        notes: data.notes,
      })
      showPanel.value = false
    } catch (e) {
      console.error('Failed to update bit:', e)
    }
  }
}

const onPanelDelete = async () => {
  if (panelBitId.value === null) return
  try {
    await bitStore.deleteBit(panelBitId.value)
    showPanel.value = false
  } catch (e) {
    console.error('Failed to delete bit:', e)
  }
}

const onBitMoveEnd = async (id: number, x: number, y: number) => {
  const snap = activeSnap.value
  activeSnap.value = null
  snapHighlights.value = new Map()

  // Final resting position (snapped or free)
  const finalX = snap ? snap.snappedX : x
  const finalY = snap ? snap.snappedY : y

  // Break any existing connections whose dots are now too far apart
  const toBreak = connectionStore.connections.filter((conn) => {
    if (conn.fromBitId !== id && conn.toBitId !== id) return false
    const mySide   = conn.fromBitId === id ? conn.fromSide : conn.toSide
    const otherId  = conn.fromBitId === id ? conn.toBitId  : conn.fromBitId
    const otherSide = conn.fromBitId === id ? conn.toSide  : conn.fromSide
    const other = bitStore.bits.find((b) => b.id === otherId)
    if (!other || other.x == null || other.y == null) return true
    const myDot    = { x: finalX + DOT_OFFSETS[mySide].x,    y: finalY + DOT_OFFSETS[mySide].y }
    const otherDot = { x: other.x + DOT_OFFSETS[otherSide].x, y: other.y + DOT_OFFSETS[otherSide].y }
    return Math.hypot(myDot.x - otherDot.x, myDot.y - otherDot.y) > SNAP_THRESHOLD
  })
  await Promise.all(toBreak.map((c) => connectionStore.deleteConnection(c.id)))

  if (snap && snap.fromBitId === id) {
    await bitStore.updateBit(id, { x: Math.round(snap.snappedX), y: Math.round(snap.snappedY) })
    const newConn = await connectionStore.createConnection({
      fromBitId: snap.fromBitId,
      fromSide:  snap.fromSide,
      toBitId:   snap.toBitId,
      toSide:    snap.toSide,
    })
    newConnectionIds.value = new Set([...newConnectionIds.value, newConn.id])
    setTimeout(() => {
      newConnectionIds.value = new Set([...newConnectionIds.value].filter((i) => i !== newConn.id))
    }, 700)
  } else {
    bitStore.updateBit(id, { x: Math.round(x), y: Math.round(y) })
  }
}

const onBitRename = (id: number, title: string) => {
  bitStore.updateBit(id, { title })
}

const menuItems = [
  { label: 'Create Bit', icon: '+', action: createBit },
  { label: 'Create Packet', icon: '◼', action: () => closeContextMenu() },
]

// ── theme & controls ───────────────────────────────────────────────
const { initTheme, applyTheme, isDark } = useTheme()

const showControls = ref(false)
let hideTimer: number | null = null

function handleEnter() {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null }
  showControls.value = true
}

function handleLeaveDelay() {
  hideTimer = window.setTimeout(() => { showControls.value = false }, 300)
}

onMounted(() => {
  initTheme()
  applyTheme()
  window.addEventListener('mouseup', handleMouseUp)
  window.addEventListener('mousemove', handleMouseMove)
  bitStore.fetchBits()
  connectionStore.fetchConnections()
})

onUnmounted(() => {
  window.removeEventListener('mouseup', handleMouseUp)
  window.removeEventListener('mousemove', handleMouseMove)
})
</script>

<template>
  <!-- root: clips the workspace overflow when it shifts right -->
  <div style="position:relative; width:100vw; height:100vh; overflow:hidden;">

    <!-- ── panel: fixed overlay, slides in from left ── -->
    <LBitPanel
      v-if="showPanel"
      :mode="panelMode"
      :bit="panelBit"
      @confirm="onPanelConfirm"
      @cancel="showPanel = false"
      @delete="onPanelDelete"
    />

    <!-- ── workspace: full size, shifts right when panel opens ── -->
  <div
    ref="containerRef"
    class="w-full h-screen overflow-hidden bg-surface1 relative"
    :class="isDark ? 'bg-dotted-grid-dark' : 'bg-dotted-grid-light'"
    @wheel.prevent="handleWheel"
    @mousedown="handleMouseDown"
    @contextmenu="handleContextMenu"
    @touchstart="handleTouchStartWithLongPress"
    @touchmove="handleTouchMoveWithLongPress"
    @touchend="handleTouchEndWithLongPress"
    :style="{
      cursor: isDragging ? 'grabbing' : 'default',
      transform: showPanel ? 'translateX(300px)' : 'translateX(0)',
      transition: 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
    }"
  >
    <!-- ── canvas transform layer ── -->
    <div class="absolute inset-0 origin-top-left" :style="{ transform: canvasTransform }">
      <!-- workspace hint text — only when no bits exist -->
      <div v-if="bitStore.bits.length === 0" class="p-5">
        <div class="max-w-7xl">
          <h1 class="text-3xl font-bold text-text0 mb-4">Workspace</h1>
          <p class="text-text1 text-base">
            Right-click or long-press for options. Shift+Drag or Ctrl+Scroll to navigate.
          </p>
        </div>
      </div>

      <!-- ── connections ── -->
      <svg
        class="absolute pointer-events-none"
        style="inset: 0; width: 0; height: 0; overflow: visible"
      >
        <defs>
          <filter id="conn-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <g v-for="path in connectionPaths" :key="path!.id">
          <!-- glow layer -->
          <path
            :d="path!.d"
            fill="none"
            stroke="rgba(148,163,184,0.25)"
            stroke-width="4"
            filter="url(#conn-glow)"
          />
          <!-- main line -->
          <path
            :d="path!.d"
            fill="none"
            stroke="rgba(148,163,184,0.55)"
            stroke-width="1.5"
            stroke-dasharray="5 4"
            stroke-linecap="round"
            :class="{ 'conn-draw': path!.isNew }"
          />
          <!-- flash on new connection -->
          <path
            v-if="path!.isNew"
            :d="path!.d"
            fill="none"
            stroke="rgba(200,210,255,0.9)"
            stroke-width="3"
            stroke-linecap="round"
            class="conn-flash"
          />
          <!-- endpoint dots -->
          <circle
            :cx="path!.fx" :cy="path!.fy" r="3" fill="rgba(148,163,184,0.7)"
            :class="{ 'conn-dot-pop': path!.isNew }"
          />
          <circle
            :cx="path!.tx" :cy="path!.ty" r="3" fill="rgba(148,163,184,0.7)"
            :class="{ 'conn-dot-pop': path!.isNew }"
          />
        </g>
      </svg>

      <!-- ── bits ── -->
      <LBit
        v-for="bit in bitStore.bits"
        :key="bit.id"
        :bit="bit"
        :zoom="zoom"
        :highlight-side="snapHighlights.get(bit.id) ?? null"
        @move-end="onBitMoveEnd"
        @drag-move="onBitDragMove"
        @rename="onBitRename"
        @delete="(id) => bitStore.deleteBit(id)"
        @open-detail="openBitDetail"
      />
    </div>

    <!-- ── zoom controls ── -->
    <div class="absolute bottom-4 left-4 z-50">
      <div
        class="flex flex-col items-start"
        @mouseenter="handleEnter"
        @mouseleave="handleLeaveDelay"
      >
        <transition name="fade" mode="out-in">
          <div v-if="showControls" class="flex flex-col items-start gap-2">
            <button
              @click="zoomIn"
              class="w-12 h-12 text-text0 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-surface2 active:scale-95"
              title="Zoom In"
            >
              <ZoomIn :size="24" />
            </button>
            <button
              @click="zoomOut"
              class="w-12 h-12 text-text0 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-surface2 active:scale-95"
              title="Zoom Out"
            >
              <ZoomOut :size="24" />
            </button>
            <button
              @click="resetView"
              class="w-12 h-12 text-text0 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-surface2 active:scale-95"
              title="Reset View"
            >
              <Fullscreen :size="24" />
            </button>
          </div>
          <button
            v-else
            class="w-12 h-12 text-text0 rounded-lg flex items-center justify-center transition-all duration-200 hover:bg-surface2 active:scale-95"
            title="View Controls"
          >
            <ScanSearch :size="24" />
          </button>
        </transition>
      </div>
    </div>

  </div>

  <!-- fixed UI — outside transformed workspace so position:fixed works correctly -->
  <LTaskbar />
  <LMenu />
  <LContextMenu
    v-if="contextMenu.visible"
    :x="contextMenu.x"
    :y="contextMenu.y"
    :items="menuItems"
    @close="closeContextMenu"
  />

  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* ── connection animations ── */
@keyframes conn-draw {
  from { stroke-dashoffset: 200; opacity: 0; }
  to   { stroke-dashoffset: 0;   opacity: 1; }
}
@keyframes conn-flash {
  0%   { opacity: 0.9; stroke-width: 6; }
  60%  { opacity: 0.4; stroke-width: 2; }
  100% { opacity: 0;   stroke-width: 1; }
}
@keyframes conn-dot-pop {
  0%   { r: 0;  opacity: 0; }
  50%  { r: 6;  opacity: 1; }
  100% { r: 3;  opacity: 0.7; }
}

.conn-draw {
  stroke-dasharray: 5 4;
  stroke-dashoffset: 200;
  animation: conn-draw 0.45s cubic-bezier(0.34, 1.2, 0.64, 1) forwards;
}
.conn-flash {
  animation: conn-flash 0.65s ease-out forwards;
}
.conn-dot-pop {
  animation: conn-dot-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

</style>
