<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import LContextMenu from '@/components/LContextMenu.vue'
import LBit from '@/components/LBit.vue'
import LBitPanel from '@/components/LBitPanel.vue'
import LPacketsHud from '@/components/LPacketsHud.vue'
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

const BIT_HALF = 72 // bits are 144×144 centered at bit.x / bit.y

function resetViewToBits() {
  const bitsWithPos = bitStore.bits.filter((b) => b.x != null && b.y != null)

  if (bitsWithPos.length === 0) {
    zoom.value = 1
    panX.value = 0
    panY.value = 0
    return
  }

  const el = containerRef.value
  if (!el) return
  const { width, height } = el.getBoundingClientRect()

  const minX = Math.min(...bitsWithPos.map((b) => b.x! - BIT_HALF))
  const maxX = Math.max(...bitsWithPos.map((b) => b.x! + BIT_HALF))
  const minY = Math.min(...bitsWithPos.map((b) => b.y! - BIT_HALF))
  const maxY = Math.max(...bitsWithPos.map((b) => b.y! + BIT_HALF))

  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2

  const PADDING = 80
  const newZoom = Math.min(
    3,
    Math.max(0.25, Math.min((width - PADDING * 2) / (maxX - minX), (height - PADDING * 2) / (maxY - minY))),
  )

  zoom.value = newZoom
  panX.value = width / 2 - cx * newZoom
  panY.value = height / 2 - cy * newZoom
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

// ── workflow highlighting ────────────────────────────────────────────
const hoveredBitId = ref<number | null>(null)
const selectedConnectionId = ref<number | null>(null)
const highlightedPacketBitIds = ref<Set<number>>(new Set())

function getUpstreamIds(bitId: number): Set<number> {
  const visited = new Set<number>()
  const queue = [bitId]
  while (queue.length) {
    const id = queue.shift()!
    for (const conn of connectionStore.connections) {
      if (conn.toBitId === id && !visited.has(conn.fromBitId)) {
        visited.add(conn.fromBitId)
        queue.push(conn.fromBitId)
      }
    }
  }
  return visited
}

function getDownstreamIds(bitId: number): Set<number> {
  const visited = new Set<number>()
  const queue = [bitId]
  while (queue.length) {
    const id = queue.shift()!
    for (const conn of connectionStore.connections) {
      if (conn.fromBitId === id && !visited.has(conn.toBitId)) {
        visited.add(conn.toBitId)
        queue.push(conn.toBitId)
      }
    }
  }
  return visited
}

const workflowContext = computed(() => {
  if (hoveredBitId.value === null) return null
  return {
    id: hoveredBitId.value,
    upstream: getUpstreamIds(hoveredBitId.value),
    downstream: getDownstreamIds(hoveredBitId.value),
  }
})

function getBitHighlightRole(bitId: number): 'upstream' | 'downstream' | null {
  if (!workflowContext.value) return null
  if (workflowContext.value.upstream.has(bitId)) return 'upstream'
  if (workflowContext.value.downstream.has(bitId)) return 'downstream'
  return null
}

function isBitDimmed(bitId: number): boolean {
  // Bit-hover chain takes priority
  if (workflowContext.value) {
    const ctx = workflowContext.value
    return bitId !== ctx.id && !ctx.upstream.has(bitId) && !ctx.downstream.has(bitId)
  }
  // Packet highlight
  if (highlightedPacketBitIds.value.size > 0) {
    return !highlightedPacketBitIds.value.has(bitId)
  }
  return false
}

function getConnectionOpacity(fromBitId: number, toBitId: number): number {
  if (workflowContext.value) {
    const ctx = workflowContext.value
    const relevant = new Set([ctx.id, ...ctx.upstream, ...ctx.downstream])
    return relevant.has(fromBitId) && relevant.has(toBitId) ? 1 : 0.06
  }
  if (highlightedPacketBitIds.value.size > 0) {
    const inPacket = highlightedPacketBitIds.value.has(fromBitId) && highlightedPacketBitIds.value.has(toBitId)
    return inPacket ? 1 : 0.06
  }
  return 1
}

// ── cycle detection (DFS back-edge) ────────────────────────────────
const cycleConnectionIds = computed(() => {
  const cycleConnIds = new Set<number>()
  const state = new Map<number, number>() // 0=unvisited, 1=in stack, 2=done

  function dfs(nodeId: number): void {
    state.set(nodeId, 1)
    for (const conn of connectionStore.connections) {
      if (conn.fromBitId !== nodeId) continue
      const s = state.get(conn.toBitId) ?? 0
      if (s === 1) cycleConnIds.add(conn.id)
      else if (s === 0) dfs(conn.toBitId)
    }
    state.set(nodeId, 2)
  }

  for (const bit of bitStore.bits) {
    if ((state.get(bit.id) ?? 0) === 0) dfs(bit.id)
  }
  return cycleConnIds
})

// ── blocked / ready state per bit ──────────────────────────────────
const bitWorkflowState = computed(() => {
  const states = new Map<number, 'blocked' | 'ready' | null>()
  for (const bit of bitStore.bits) {
    if (bit.status === 2) { states.set(bit.id, null); continue }
    const incoming = connectionStore.connections.filter((c) => c.toBitId === bit.id)
    if (incoming.length === 0) { states.set(bit.id, null); continue }
    const allDone = incoming.every((c) => bitStore.bits.find((b) => b.id === c.fromBitId)?.status === 2)
    states.set(bit.id, allDone ? 'ready' : 'blocked')
  }
  return states
})

// ── packets: connected components (undirected) ──────────────────────
const packets = computed(() => {
  if (connectionStore.connections.length === 0) return []

  const adj = new Map<number, Set<number>>()
  for (const bit of bitStore.bits) adj.set(bit.id, new Set())
  for (const conn of connectionStore.connections) {
    adj.get(conn.fromBitId)?.add(conn.toBitId)
    adj.get(conn.toBitId)?.add(conn.fromBitId)
  }

  const visited = new Set<number>()
  const components: number[][] = []

  for (const bit of bitStore.bits) {
    if (visited.has(bit.id) || (adj.get(bit.id)?.size ?? 0) === 0) continue
    const component: number[] = []
    const queue = [bit.id]
    visited.add(bit.id)
    while (queue.length) {
      const id = queue.shift()!
      component.push(id)
      for (const neighbor of adj.get(id) ?? []) {
        if (!visited.has(neighbor)) { visited.add(neighbor); queue.push(neighbor) }
      }
    }
    components.push(component)
  }

  return components.map((bitIds, i) => ({ index: i + 1, bitIds }))
})

// ── per-packet stats for HUD ────────────────────────────────────────
const packetCards = computed(() =>
  packets.value.map((packet) => {
    const bits = packet.bitIds.map((id) => bitStore.bits.find((b) => b.id === id)).filter(Boolean)
    const total = bits.length
    const done = bits.filter((b) => b!.status === 2).length
    const inProgress = bits.filter((b) => b!.status === 1).length
    const blocked = packet.bitIds.filter((id) => bitWorkflowState.value.get(id) === 'blocked').length
    const ready   = packet.bitIds.filter((id) => bitWorkflowState.value.get(id) === 'ready').length
    const packetConns = connectionStore.connections.filter(
      (c) => packet.bitIds.includes(c.fromBitId) && packet.bitIds.includes(c.toBitId),
    )
    const cycles = packetConns.filter((c) => cycleConnectionIds.value.has(c.id)).length
    return {
      key: Math.min(...packet.bitIds),
      bitIds: packet.bitIds,
      index: packet.index,
      total,
      done,
      inProgress,
      blocked,
      ready,
      cycles,
      percent: total ? Math.round((done / total) * 100) : 0,
    }
  }),
)

function selectConnection(id: number) {
  selectedConnectionId.value = selectedConnectionId.value === id ? null : id
}

async function deleteSelectedConnection() {
  if (selectedConnectionId.value === null) return
  await connectionStore.deleteConnection(selectedConnectionId.value)
  selectedConnectionId.value = null
}

function onWorkspaceMouseDown(e: MouseEvent) {
  selectedConnectionId.value = null
  handleMouseDown(e)
}

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

      // Bezier midpoint at t=0.5 (De Casteljau)
      const mx = 0.125*fx + 0.375*cp1x + 0.375*cp2x + 0.125*tx
      const my = 0.125*fy + 0.375*cp1y + 0.375*cp2y + 0.125*ty

      // Arrow direction: tangent at t=1 = endpoint - last control point
      const arrowAngle = Math.atan2(ty - cp2y, tx - cp2x) * 180 / Math.PI

      // 5-state color model
      const isCycle    = cycleConnectionIds.value.has(conn.id)
      const fromStatus = from.status
      const toStatus   = to.status

      let flowColor: string
      let glowColor: string
      let dashArray: string | undefined
      let connClass: string

      if (isCycle) {
        flowColor = '#f97316'; glowColor = 'rgba(249,115,22,0.45)'; dashArray = '8 4'; connClass = 'conn-cycle'
      } else if (fromStatus === 2 && toStatus !== 2) {
        // Source done, target still open → path UNLOCKED
        flowColor = '#34d399'; glowColor = 'rgba(52,211,153,0.45)'; dashArray = '12 5'; connClass = 'conn-unlocked'
      } else if (fromStatus === 2) {
        // Both done → completed path
        flowColor = 'rgba(16,185,129,0.45)'; glowColor = 'rgba(16,185,129,0.12)'; dashArray = undefined; connClass = ''
      } else if (fromStatus === 1) {
        // In progress → active flow
        flowColor = '#f59e0b'; glowColor = 'rgba(245,158,11,0.4)'; dashArray = '10 6'; connClass = 'conn-flow'
      } else {
        // Open → pending
        flowColor = 'rgba(100,116,139,0.65)'; glowColor = 'rgba(100,116,139,0.18)'; dashArray = '6 5'; connClass = ''
      }

      return {
        id: conn.id,
        d: `M ${fx} ${fy} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${tx} ${ty}`,
        fx, fy, tx, ty, mx, my,
        arrowAngle,
        isNew: newConnectionIds.value.has(conn.id),
        isSelected: selectedConnectionId.value === conn.id,
        isCycle,
        connClass,
        flowColor,
        glowColor,
        dashArray,
        opacity: getConnectionOpacity(conn.fromBitId, conn.toBitId),
        fromBitId: conn.fromBitId,
        toBitId: conn.toBitId,
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
  color: string
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
        color: data.color,
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
        color: data.color,
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
    @mousedown="onWorkspaceMouseDown"
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
        class="absolute"
        style="inset: 0; width: 0; height: 0; overflow: visible"
      >
        <defs>
          <filter id="conn-blur" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="5" />
          </filter>
        </defs>

        <g
          v-for="path in connectionPaths"
          :key="path!.id"
          :style="{ opacity: path!.opacity, transition: 'opacity 0.3s ease' }"
        >
          <!-- 1. Glow layer -->
          <path
            :d="path!.d"
            fill="none"
            :stroke="path!.glowColor"
            stroke-width="14"
            filter="url(#conn-blur)"
            style="pointer-events:none;"
          />

          <!-- 2. Track (faint background line) -->
          <path
            :d="path!.d"
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            stroke-width="1.5"
            style="pointer-events:none;"
          />

          <!-- 3. Main flow line -->
          <path
            :d="path!.d"
            fill="none"
            :stroke="path!.flowColor"
            :stroke-width="path!.isSelected ? 2.8 : 2"
            :stroke-dasharray="path!.dashArray"
            stroke-linecap="round"
            :class="path!.isNew ? 'conn-draw' : path!.connClass"
            style="pointer-events:none;"
          />

          <!-- 4. Arrowhead at target -->
          <polygon
            :points="'0,0 -10,-4.5 -10,4.5'"
            :transform="`translate(${path!.tx},${path!.ty}) rotate(${path!.arrowAngle})`"
            :fill="path!.flowColor"
            opacity="0.9"
            style="pointer-events:none;"
          />

          <!-- 5. Source dot -->
          <circle
            :cx="path!.fx" :cy="path!.fy" r="2.5"
            :fill="path!.flowColor"
            opacity="0.8"
            style="pointer-events:none;"
            :class="{ 'conn-dot-pop': path!.isNew }"
          />

          <!-- 6. Flash on new connection -->
          <path
            v-if="path!.isNew"
            :d="path!.d"
            fill="none"
            stroke="rgba(200,215,255,0.85)"
            stroke-width="4"
            stroke-linecap="round"
            class="conn-flash"
            style="pointer-events:none;"
          />

          <!-- 7. Hit area (transparent, clickable) -->
          <path
            :d="path!.d"
            fill="none"
            stroke="transparent"
            stroke-width="22"
            style="cursor:pointer;"
            @click.stop="selectConnection(path!.id)"
          />

          <!-- 8. Delete button (when selected) -->
          <g
            v-if="path!.isSelected"
            :transform="`translate(${path!.mx},${path!.my})`"
            style="cursor:pointer;"
            @click.stop="deleteSelectedConnection()"
          >
            <circle r="14" fill="rgba(12,12,22,0.92)" />
            <circle r="14" fill="none" stroke="#ef4444" stroke-width="1.5" opacity="0.85" />
            <line x1="-5" y1="-5" x2="5" y2="5" stroke="#ef4444" stroke-width="2" stroke-linecap="round" />
            <line x1="5" y1="-5" x2="-5" y2="5" stroke="#ef4444" stroke-width="2" stroke-linecap="round" />
          </g>
        </g>
      </svg>

      <!-- ── bits ── -->
      <LBit
        v-for="bit in bitStore.bits"
        :key="bit.id"
        :bit="bit"
        :zoom="zoom"
        :highlight-side="snapHighlights.get(bit.id) ?? null"
        :dimmed="isBitDimmed(bit.id)"
        :highlight-role="getBitHighlightRole(bit.id)"
        :workflow-state="bitWorkflowState.get(bit.id) ?? null"
        @move-end="onBitMoveEnd"
        @drag-move="onBitDragMove"
        @rename="onBitRename"
        @delete="(id) => bitStore.deleteBit(id)"
        @open-detail="openBitDetail"
        @hover="hoveredBitId = $event"
        @hover-end="hoveredBitId = null"
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
              @click="resetViewToBits"
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

  <LPacketsHud
    :cards="packetCards"
    @highlight="(ids) => highlightedPacketBitIds = new Set(ids)"
    @unhighlight="highlightedPacketBitIds = new Set()"
  />
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

/* Draw-in: new connection appears with path reveal */
@keyframes conn-draw {
  from { stroke-dasharray: 800; stroke-dashoffset: 800; opacity: 0.4; }
  to   { stroke-dasharray: 800; stroke-dashoffset: 0;   opacity: 1; }
}
.conn-draw {
  animation: conn-draw 0.55s cubic-bezier(0.34, 1.2, 0.64, 1) forwards;
}

/* Flow: in-progress — dashes travel source→target */
@keyframes conn-flow {
  from { stroke-dashoffset: 16; }
  to   { stroke-dashoffset: 0; }
}
.conn-flow {
  animation: conn-flow 0.65s linear infinite;
}

/* Unlocked: source done, target ready — slow emerald pulse */
@keyframes conn-unlocked {
  0%, 100% { stroke-dashoffset: 17; opacity: 0.75; }
  50%       { stroke-dashoffset: 0;  opacity: 1; }
}
.conn-unlocked {
  animation: conn-unlocked 2.2s ease-in-out infinite;
}

/* Cycle warning: orange-red rapid pulse */
@keyframes conn-cycle {
  0%, 100% { opacity: 0.5; }
  50%       { opacity: 1; }
}
.conn-cycle {
  animation: conn-cycle 0.75s ease-in-out infinite;
}

/* Flash: bright burst when connection is created */
@keyframes conn-flash {
  0%   { opacity: 0.85; stroke-width: 6; }
  60%  { opacity: 0.3;  stroke-width: 2; }
  100% { opacity: 0;    stroke-width: 1; }
}
.conn-flash {
  animation: conn-flash 0.65s ease-out forwards;
}

/* Dot pop: endpoint dot appears with overshoot */
@keyframes conn-dot-pop {
  0%   { r: 0;   opacity: 0; }
  55%  { r: 5.5; opacity: 1; }
  100% { r: 2.5; opacity: 0.8; }
}
.conn-dot-pop {
  animation: conn-dot-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}


</style>
