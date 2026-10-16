<script setup lang="ts">
import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import { Fullscreen, ScanSearch, ZoomIn, ZoomOut } from 'lucide-vue-next'
import LContextMenu from '@/components/LContextMenu.vue'
import LBitCapsule from '@/components/LBitCapsule.vue'
import LPacketStack from '@/components/LPacketStack.vue'
import LDependencyLayer from '@/components/LDependencyLayer.vue'
import LFlowFrame from '@/components/LFlowFrame.vue'
import LLassoPath from '@/components/LLassoPath.vue'
import LPacketsHud from '@/components/LPacketsHud.vue'
import LSplash from '@/components/LSplash.vue'
import LUndoToast from '@/components/LUndoToast.vue'
import LGhostCapsule from '@/components/LGhostCapsule.vue'
import LBitSheet from '@/components/sheet/LBitSheet.vue'
import LTaskbar from '@/layout/LTaskbar.vue'
import LMenu from '@/layout/LMenu.vue'
import { useTheme } from '@/composables/useTheme.ts'
import { useCanvas } from '@/composables/useCanvas.ts'
import {
  CAPSULE_H,
  CAPSULE_W,
  anchor,
  capsuleHeight,
  computeLayout,
  dependencyGeometry,
  unionRect,
  type Rect,
} from '@/composables/useFlowLayout'
import { SHEET_WIDTH } from '@/composables/useSheetGesture'
import { computeFlowState } from '@/composables/useFlowState'
import { flowAt, flowFrames, pathLength } from '@/composables/useFlowGroups'
import { matchesFilter } from '@/composables/useFilter'
import { useFlowGestures } from '@/composables/useFlowGestures'
import { useFlowActions } from '@/composables/useFlowActions'
import { BIT_COMMANDS, useBitCommands } from '@/composables/useBitCommands'
import { useBitStore } from '@/stores/bitStore'
import { usePacketStore } from '@/stores/packetStore'
import { useDependencyStore } from '@/stores/dependencyStore'
import { useFlowStore } from '@/stores/flowStore'
import { isEditable, useToolStore } from '@/stores/toolStore'
import { useSheetStore } from '@/stores/sheetStore'
import { useHistoryStore } from '@/stores/historyStore'
import { useFocusStore } from '@/stores/focusStore'
import type { Dependency, DependencyItem, PacketCard } from '@/types/flow'

const containerRef = ref<HTMLElement | null>(null)

const {
  zoom,
  panX,
  panY,
  canvasTransform,
  isDragging,
  zoomIn,
  zoomOut,
  animateView,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  handleWheel,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
} = useCanvas(containerRef)

const bitStore = useBitStore()
const packetStore = usePacketStore()
const dependencyStore = useDependencyStore()
const flowStore = useFlowStore()
const toolStore = useToolStore()
const sheetStore = useSheetStore()
const history = useHistoryStore()
const actions = useFlowActions()

function toCanvas(clientX: number, clientY: number) {
  const rect = containerRef.value!.getBoundingClientRect()
  return {
    x: (clientX - rect.left - panX.value) / zoom.value,
    y: (clientY - rect.top - panY.value) / zoom.value,
  }
}

const selectedDependencyId = ref<string | null>(null)
const highlightedPacketId = ref<string | null>(null)

// Layout of the stored state — what snap detection and drops reason about
const baseLayout = computed(() =>
  computeLayout({
    bits: bitStore.visibleBits,
    packets: packetStore.packets,
  }),
)

const focus = useFocusStore()
const commands = useBitCommands({
  layout: () => baseLayout.value,
  // a deleted bit ends its timer without booking
  onRemove: (id) => {
    if (focus.running?.bitId === id) focus.cancel()
  },
})
provide(BIT_COMMANDS, commands)

// Frames before any gesture — drop membership is judged against these
const baseFrames = computed(() =>
  flowFrames(baseLayout.value, bitStore.visibleBits, packetStore.packets, flowStore.flows),
)

const {
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
} = useFlowGestures({
  toCanvas,
  zoom,
  layout: baseLayout,
  // a single click on a bit goes straight to its details
  onTapBit: (id) => {
    selectedDependencyId.value = null
    openBitDetail(id)
  },
  onDropBit: (id, target, pos) =>
    actions.dropBit(id, target, pos, baseLayout.value, baseFrames.value),
  onMovePacketEnd: (id, x, y) => actions.movePacket(id, x, y, baseLayout.value, baseFrames.value),
  onCreateDependency: (from, to) => {
    void actions.createDependency(from, to)
  },
  onLassoEnd: (points) => {
    // a click or a tiny scribble is not a lasso
    if (pathLength(points) * zoom.value < 10) return
    void actions.createFlowFromLasso(points, baseLayout.value).then((created) => {
      if (created) toolStore.setTool('select')
    })
  },
  onMoveFlowEnd: (id, dx, dy) => actions.moveFlow(id, dx, dy),
})

// Height of the capsule being dragged (sizes its drop gap and its live rect)
const draggedHeight = computed(() => {
  const id = bitDrag.value?.bitId
  const bit = id ? bitStore.bits.find((b) => b.id === id) : undefined
  return bit ? capsuleHeight(bit) : CAPSULE_H
})

// Layout including in-flight gestures — what is rendered and where arrows attach
const liveLayout = computed(() => {
  const pd = packetDrag.value
  const fd = flowDrag.value
  const inDraggedFlow = (flowId: string | null | undefined) => fd !== null && flowId === fd.flowId
  const packets = packetStore.packets.map((p) => {
    if (pd && p.id === pd.packetId) return { ...p, x: pd.x, y: pd.y }
    if (fd && inDraggedFlow(p.flowId)) return { ...p, x: p.x + fd.dx, y: p.y + fd.dy }
    return p
  })
  const bits = fd
    ? bitStore.visibleBits.map((b) =>
        b.packetId == null && inDraggedFlow(b.flowId)
          ? { ...b, x: b.x + fd.dx, y: b.y + fd.dy }
          : b,
      )
    : bitStore.visibleBits
  const layout = computeLayout({ bits, packets })
  const bd = bitDrag.value
  if (bd) layout.bitRects.set(bd.bitId, { x: bd.x, y: bd.y, w: CAPSULE_W, h: draggedHeight.value })
  return layout
})

// Frames follow their members live, including while one is dragged
const liveFrames = computed(() =>
  flowFrames(liveLayout.value, bitStore.visibleBits, packetStore.packets, flowStore.flows),
)

const flow = computed(() =>
  computeFlowState(bitStore.visibleBits, packetStore.packets, dependencyStore.dependencies),
)

const filterActive = computed(() => toolStore.activeFilterCount > 0)

/** Bits that do not match the filter (empty when no filter is active). */
const filterDimmed = computed(() => {
  const dimmed = new Set<string>()
  if (!filterActive.value) return dimmed
  const today = new Date()
  for (const b of bitStore.visibleBits) {
    if (!matchesFilter(b, flow.value.bitState.get(b.id) ?? null, toolStore.filters, today))
      dimmed.add(b.id)
  }
  return dimmed
})

const looseBits = computed(() =>
  liveLayout.value.looseBitIds
    .map((id) => bitStore.visibleBits.find((b) => b.id === id)!)
    .filter(Boolean),
)

/** A bit dragged out of a stack floats above everything until it is dropped. */
const floatingBit = computed(() => {
  const bd = bitDrag.value
  if (!bd) return null
  const bit = bitStore.bits.find((b) => b.id === bd.bitId)
  return bit && bit.packetId != null && liveLayout.value.packetRects.has(bit.packetId) ? bit : null
})

const stacks = computed(() =>
  packetStore.packets
    .filter((p) => liveLayout.value.membersOf.has(p.id))
    .map((p) => {
      const bd = bitDrag.value
      const rect = liveLayout.value.packetRects.get(p.id)!
      const target = bd?.target
      return {
        packet: p,
        x: rect.x,
        y: rect.y,
        members: (liveLayout.value.membersOf.get(p.id) ?? []).filter((b) => b.id !== bd?.bitId),
        gapIndex: target?.kind === 'stack' && target.packetId === p.id ? target.index : null,
      }
    }),
)

function packetOfBit(id: string): string | null {
  return bitStore.bits.find((b) => b.id === id)?.packetId ?? null
}

function isBitDimmed(id: string): boolean {
  const byHighlight =
    highlightedPacketId.value !== null && packetOfBit(id) !== highlightedPacketId.value
  return byHighlight || filterDimmed.value.has(id)
}

function isDependencyDimmed(dep: Dependency): boolean {
  const hp = highlightedPacketId.value
  if (hp !== null) {
    const touches = (type: 'bit' | 'packet', id: string) =>
      type === 'packet' ? id === hp : packetOfBit(id) === hp
    if (!touches(dep.fromType, dep.fromId) && !touches(dep.toType, dep.toId)) return true
  }
  if (!filterActive.value) return false
  // a packet end matches when at least one of its steps matches
  const matches = (type: 'bit' | 'packet', id: string) =>
    type === 'bit'
      ? !filterDimmed.value.has(id)
      : (liveLayout.value.membersOf.get(id) ?? []).some((b) => !filterDimmed.value.has(b.id))
  return !matches(dep.fromType, dep.fromId) && !matches(dep.toType, dep.toId)
}

const dependencyItems = computed<DependencyItem[]>(() =>
  dependencyStore.dependencies.flatMap((dep) => {
    const from = anchor(liveLayout.value, { type: dep.fromType, id: dep.fromId }, 'out')
    const to = anchor(liveLayout.value, { type: dep.toType, id: dep.toId }, 'in')
    if (!from || !to) return []
    const state = flow.value.cycleDependencyIds.has(dep.id)
      ? 'cycle'
      : flow.value.sourceDone(dep)
        ? 'done'
        : 'pending'
    return [{ id: dep.id, ...dependencyGeometry(from, to), state, dimmed: isDependencyDimmed(dep) }]
  }),
)

const linkPreview = computed(() => {
  const l = linkDrag.value
  if (!l) return null
  const from = anchor(liveLayout.value, l.from, 'out')
  return from ? dependencyGeometry(from, { x: l.x, y: l.y }).d : null
})

const packetCards = computed<PacketCard[]>(() =>
  packetStore.packets
    .filter((p) => flow.value.packetSummary.has(p.id))
    .map((p) => ({
      key: p.id,
      name: p.name,
      bitIds: (liveLayout.value.membersOf.get(p.id) ?? []).map((b) => b.id),
      ...flow.value.packetSummary.get(p.id)!,
    })),
)

// The highlight dims everything else, so it must not outlive its packet
watch(packetCards, (cards) => {
  if (
    highlightedPacketId.value !== null &&
    !cards.some((c) => c.key === highlightedPacketId.value)
  ) {
    highlightedPacketId.value = null
  }
})

function focusPacket(id: string) {
  highlightedPacketId.value = id
  const rect = liveLayout.value.packetRects.get(id)
  const el = containerRef.value
  if (!rect || !el) return
  const { width, height } = el.getBoundingClientRect()
  // zoom in to the stack when the canvas is zoomed out, keep a closer zoom as is
  const z = Math.min(3, Math.max(zoom.value, 1))
  animateView(z, width / 2 - (rect.x + rect.w / 2) * z, height / 2 - (rect.y + rect.h / 2) * z)
}

function resetViewToBits() {
  const el = containerRef.value
  const bounds = unionRect([
    ...liveLayout.value.bitRects.values(),
    ...liveLayout.value.packetRects.values(),
  ])
  if (!el || !bounds) {
    animateView(1, 0, 0)
    return
  }
  const { width, height } = el.getBoundingClientRect()
  const PADDING = 80
  const z = Math.min(
    3,
    Math.max(0.25, Math.min((width - PADDING * 2) / bounds.w, (height - PADDING * 2) / bounds.h)),
  )
  animateView(
    z,
    width / 2 - (bounds.x + bounds.w / 2) * z,
    height / 2 - (bounds.y + bounds.h / 2) * z,
  )
}

/** The taskbar along the top edge of the workspace. */
const TASKBAR_H = 56

/**
 * Pans (same zoom) so a canvas rect is in view: when it reaches into the margins or behind the
 * sheet, it lands 48 px from the container's left edge, vertically centred.
 */
function ensureVisible(rect: Rect) {
  const el = containerRef.value
  if (!el) return
  const { width, height } = el.getBoundingClientRect()
  if (width === 0 || height === 0) return
  // an open sheet takes its full width, also while it is still sliding in
  const sheetWidth = sheetStore.open ? SHEET_WIDTH : sheetStore.revealed
  const z = zoom.value
  const left = rect.x * z + panX.value
  const top = rect.y * z + panY.value
  const inView =
    left >= 24 &&
    left + rect.w * z <= width - sheetWidth - 24 &&
    top >= TASKBAR_H + 16 &&
    top + rect.h * z <= height - 16
  if (inView) return
  animateView(z, 48 - rect.x * z, height / 2 - (rect.y + rect.h / 2) * z)
}

/**
 * Where the series stands: a new click point or the bit just placed. Only when this moves does
 * the canvas follow the ghost; typing, size or colour changes and edits elsewhere leave the
 * canvas where the user put it (the sheet is a parallel layer, the canvas stays usable).
 */
let revealedStep: string | null = null

watch(
  () => sheetStore.ghost,
  (ghost) => {
    if (!ghost) {
      // capture left (closed or detail): showing it again reveals the slot once more
      revealedStep = null
      return
    }
    const { origin, lastRect } = sheetStore
    const step = `${origin.x},${origin.y}|${lastRect ? `${lastRect.x},${lastRect.y}` : ''}`
    if (step === revealedStep) return
    revealedStep = step
    ensureVisible({ x: ghost.x, y: ghost.y, w: CAPSULE_W, h: ghost.h })
  },
)

// --- Context menu (create bit) ---
type ContextMenuState = { visible: boolean; x: number; y: number }
const contextMenu = ref<ContextMenuState>({ visible: false, x: 0, y: 0 })
const contextCanvasPos = ref({ x: 0, y: 0 })

function showContextMenu(clientX: number, clientY: number) {
  contextCanvasPos.value = toCanvas(clientX, clientY)
  contextMenu.value = { visible: true, x: clientX, y: clientY }
}

function closeContextMenu() {
  contextMenu.value.visible = false
}

function handleContextMenu(event: MouseEvent) {
  event.preventDefault()
  showContextMenu(event.clientX, event.clientY)
}

// Double-click on empty canvas creates a bit there — not on nodes, arrows or the controls
function handleCanvasDoubleClick(event: MouseEvent) {
  // flow mode: the lasso layer owns the canvas, nodes and background do not react
  if (toolStore.activeTool === 'flow') return
  const target = event.target as Element | null
  if (
    target?.closest(
      '[data-node-type], .dep__hit, .dep__delete, .view-controls, .flow__label, .flow__tools',
    )
  )
    return
  contextCanvasPos.value = toCanvas(event.clientX, event.clientY)
  createBit()
}

let longPressTimer: number | null = null
const LONG_PRESS_DURATION = 500

function clearLongPress() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function handleTouchStartWithLongPress(event: TouchEvent) {
  clearLongPress()
  if (event.touches.length === 1) {
    const touch = event.touches[0]!
    longPressTimer = window.setTimeout(
      () => showContextMenu(touch.clientX, touch.clientY),
      LONG_PRESS_DURATION,
    )
  }
  handleTouchStart(event)
}

function handleTouchMoveWithLongPress(event: TouchEvent) {
  clearLongPress()
  handleTouchMove(event)
}

function handleTouchEndWithLongPress() {
  clearLongPress()
  handleTouchEnd()
}

// --- Bit sheet ---
function createBit() {
  closeContextMenu()
  // a bit created inside a flow frame joins that flow
  const flowId = flowAt(contextCanvasPos.value, baseFrames.value, flowStore.flows)
  sheetStore.openCapture(contextCanvasPos.value, flowId)
}

function openBitDetail(id: string) {
  sheetStore.openDetail(id)
}

/** The status circle ticks a bit off; ticking a done bit re-opens it. */
async function toggleDone(id: string) {
  const bit = bitStore.bits.find((b) => b.id === id)
  if (!bit) return
  try {
    if (bit.status === 2) await commands.reopen(id)
    else await commands.complete(id)
  } catch (e) {
    console.error('Failed to update bit status:', e)
  }
}

const menuItems = [{ label: 'Create Bit', icon: '+', action: createBit }]

// --- View controls ---
const showControls = ref(false)
let hideTimer: number | null = null

function handleEnter() {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  showControls.value = true
}

function handleLeaveDelay() {
  hideTimer = window.setTimeout(() => {
    showControls.value = false
  }, 300)
}

function openControls() {
  handleEnter()
}

function onWorkspaceMouseDown(e: MouseEvent) {
  selectedDependencyId.value = null
  showControls.value = false
  handleMouseDown(e)
}

/** Ctrl/⌘+Z undoes, with Shift redoes. Inside a text field the browser's own undo applies. */
function handleUndoShortcut(e: KeyboardEvent): boolean {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== 'z') return false
  if (e.isComposing || isEditable(e.target)) return false
  e.preventDefault()
  const run = e.shiftKey ? history.redo() : history.undo()
  run.catch((err) => console.error('Undo failed:', err))
  return true
}

function onKeydown(e: KeyboardEvent) {
  if (handleUndoShortcut(e)) return
  if (!toolStore.handleShortcut(e)) return
  if (e.key === 'Escape') cancelLasso()
  if (toolStore.activeTool !== 'flow') cancelLasso()
}

const { initTheme, applyTheme, isDark } = useTheme()

// Brand splash plays on every entry into the workspace (login, navigation, reload)
const showSplash = ref(true)

onMounted(() => {
  initTheme()
  applyTheme()
  window.addEventListener('mouseup', handleMouseUp)
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('keydown', onKeydown)
  focus.restore()
  actions
    .reloadAll()
    .then(() => {
      // a timer on a bit that is gone (deleted elsewhere, other account) ends without booking
      if (focus.running && !bitStore.bits.some((b) => b.id === focus.running?.bitId)) focus.cancel()
      return focus.flushPending()
    })
    .catch((e) => console.error('Failed to load workspace:', e))
})

onUnmounted(() => {
  window.removeEventListener('mouseup', handleMouseUp)
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('keydown', onKeydown)
  clearLongPress()
})
</script>

<template>
  <div style="position: relative; width: 100vw; height: 100vh; overflow: hidden">
    <LBitSheet />

    <div
      ref="containerRef"
      class="w-full h-screen overflow-hidden bg-surface1 relative"
      :class="isDark ? 'bg-dotted-grid-dark' : 'bg-dotted-grid-light'"
      @wheel.prevent="handleWheel"
      @mousedown="onWorkspaceMouseDown"
      @contextmenu="handleContextMenu"
      @dblclick="handleCanvasDoubleClick"
      @touchstart="handleTouchStartWithLongPress"
      @touchmove="handleTouchMoveWithLongPress"
      @touchend="handleTouchEndWithLongPress"
      :style="{
        cursor: isDragging ? 'grabbing' : 'default',
        // follows the sheet live (finger and spring), so no transition of its own
        transform: `translateX(${sheetStore.revealed}px)`,
      }"
    >
      <div class="absolute inset-0 origin-top-left" :style="{ transform: canvasTransform }">
        <div v-if="bitStore.visibleBits.length === 0" class="p-5">
          <div class="max-w-7xl">
            <h1 class="text-[2rem] text-text0 mb-2">Workspace</h1>
            <p class="text-text2 text-[0.9375rem] leading-relaxed">
              Double-click, right-click or long-press to create a bit. Drag a bit under another to
              build a packet; drag from the handle to draw a dependency. Press F to circle bits into
              a flow.
            </p>
          </div>
        </div>

        <LFlowFrame
          v-for="f in flowStore.flows.filter((fl) => liveFrames.has(fl.id))"
          :key="`flow-${f.id}`"
          :flow="f"
          :rect="liveFrames.get(f.id)!"
          :dragging="flowDrag?.flowId === f.id"
          @dragstart="(e) => startFlowPointer(e, f.id)"
          @rename="(name) => actions.renameFlow(f.id, name)"
          @recolor="(color) => actions.recolorFlow(f.id, color)"
          @dissolve="actions.dissolveFlow(f.id)"
        />

        <LDependencyLayer
          :items="dependencyItems"
          :preview="linkPreview"
          :selected-id="selectedDependencyId"
          @select="(id) => (selectedDependencyId = selectedDependencyId === id ? null : id)"
          @remove="
            (id) => {
              selectedDependencyId = null
              actions.deleteDependency(id)
            }
          "
        />

        <LPacketStack
          v-for="s in stacks"
          :key="s.packet.id"
          :packet="s.packet"
          :members="s.members"
          :x="s.x"
          :y="s.y"
          :states="flow.bitState"
          :cycle-bit-ids="flow.cycleBitIds"
          :summary="flow.packetSummary.get(s.packet.id)!"
          :gap-index="s.gapIndex"
          :gap-height="draggedHeight"
          :dimmed-bit-ids="filterDimmed"
          :highlighted="highlightedPacketId === s.packet.id"
          :dimmed="highlightedPacketId !== null && highlightedPacketId !== s.packet.id"
          :dragging="
            packetDrag?.packetId === s.packet.id ||
            (flowDrag !== null && s.packet.flowId === flowDrag.flowId)
          "
          @header-pointerdown="(e) => startPacketPointer(e, s.packet.id)"
          @bit-pointerdown="(e, id) => startBitPointer(e, id)"
          @bit-open="openBitDetail"
          @bit-toggle-done="toggleDone"
          @linkstart="(e, from) => startLinkPointer(e, from)"
          @rename="(name) => actions.renamePacket(s.packet.id, name)"
        />

        <LGhostCapsule v-if="sheetStore.ghost" :ghost="sheetStore.ghost" />

        <div
          v-for="bit in looseBits"
          :key="bit.id"
          class="flow-item"
          :class="{
            'flow-item--dragging': bitDrag?.bitId === bit.id,
            'flow-item--following': flowDrag !== null && bit.flowId === flowDrag.flowId,
          }"
          :style="{
            transform: `translate3d(${liveLayout.bitRects.get(bit.id)!.x}px, ${liveLayout.bitRects.get(bit.id)!.y}px, 0)`,
          }"
        >
          <LBitCapsule
            :bit="bit"
            :state="flow.bitState.get(bit.id) ?? null"
            :in-cycle="flow.cycleBitIds.has(bit.id)"
            :lifted="bitDrag?.bitId === bit.id"
            :dimmed="isBitDimmed(bit.id)"
            :materialize="bit.id === sheetStore.materializeId"
            :snap-hint="
              bitDrag?.target?.kind === 'pair' && bitDrag.target.bitId === bit.id
                ? bitDrag.target.position
                : null
            "
            @pointerdown="(e) => startBitPointer(e, bit.id)"
            @open="openBitDetail(bit.id)"
            @toggle-done="toggleDone(bit.id)"
            @linkstart="(e) => startLinkPointer(e, { type: 'bit', id: bit.id })"
          />
        </div>

        <div
          v-if="floatingBit && bitDrag"
          class="flow-item flow-item--dragging"
          :style="{ transform: `translate3d(${bitDrag.x}px, ${bitDrag.y}px, 0)` }"
        >
          <LBitCapsule
            :bit="floatingBit"
            :state="flow.bitState.get(floatingBit.id) ?? null"
            lifted
          />
        </div>

        <LLassoPath v-if="lasso" :points="lasso" />
      </div>

      <!-- Flow tool: a capture layer above every node, so a lasso can start anywhere -->
      <div v-if="toolStore.activeTool === 'flow'" class="lasso-capture" @pointerdown="startLasso" />

      <div
        class="view-controls material"
        :class="{ 'view-controls--open': showControls }"
        @mouseenter="handleEnter"
        @mouseleave="handleLeaveDelay"
        @mousedown.stop
      >
        <div class="view-controls__extra" :aria-hidden="!showControls">
          <button
            class="view-controls__btn pressable"
            title="Zoom In"
            aria-label="Zoom in"
            :tabindex="showControls ? 0 : -1"
            @click="zoomIn"
          >
            <ZoomIn :size="20" />
          </button>
          <button
            class="view-controls__btn pressable"
            title="Zoom Out"
            aria-label="Zoom out"
            :tabindex="showControls ? 0 : -1"
            @click="zoomOut"
          >
            <ZoomOut :size="20" />
          </button>
          <button
            class="view-controls__btn pressable"
            title="Fit all Bits"
            aria-label="Fit all bits into view"
            :tabindex="showControls ? 0 : -1"
            @click="resetViewToBits"
          >
            <Fullscreen :size="20" />
          </button>
          <div class="view-controls__sep" />
        </div>
        <button
          class="view-controls__btn pressable"
          title="View Controls"
          aria-label="View controls"
          :aria-expanded="showControls"
          @click="openControls"
        >
          <ScanSearch :size="20" />
        </button>
      </div>
    </div>

    <LTaskbar />
    <LMenu />

    <LPacketsHud
      :cards="packetCards"
      @highlight="focusPacket"
      @unhighlight="highlightedPacketId = null"
    />
    <LContextMenu
      v-if="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :items="menuItems"
      @close="closeContextMenu"
    />

    <LUndoToast />

    <LSplash v-if="showSplash" @done="showSplash = false" />
  </div>
</template>

<style scoped>
/* ── View controls: one material pill that grows up out of its trigger ── */
.view-controls {
  position: absolute;
  bottom: 16px;
  left: 16px;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px;
  border-radius: 22px;
  color: var(--text1);
}

.view-controls__extra {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  max-height: 0;
  opacity: 0;
  transform: translateY(8px) scale(0.92);
  transform-origin: bottom center;
  overflow: hidden;
  pointer-events: none;
  transition:
    max-height var(--spring-duration) var(--ease-spring),
    opacity 0.2s ease,
    transform var(--spring-duration) var(--ease-spring);
}
.view-controls--open .view-controls__extra {
  max-height: 160px;
  opacity: 1;
  transform: none;
  pointer-events: auto;
}

.view-controls__btn {
  width: 36px;
  height: 36px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: inherit;
}
.view-controls__btn:hover {
  background-color: var(--fill-hover);
  color: var(--text0);
}
.view-controls__btn:active {
  background-color: var(--fill-press);
}

.view-controls__sep {
  width: 20px;
  height: 1px;
  margin: 3px 0;
  background: var(--separator);
}

/* Loose capsules glide to new positions; while dragged they follow the pointer 1:1 */
.flow-item {
  position: absolute;
  left: 0;
  top: 0;
  will-change: transform;
  transition: transform var(--spring-duration) var(--ease-spring);
}
.flow-item--dragging {
  transition: none;
  z-index: 20;
}
/* members of a dragged flow frame follow it 1:1, like the frame itself */
.flow-item--following {
  transition: none;
}
.lasso-capture {
  position: absolute;
  inset: 0;
  z-index: 15;
  cursor: crosshair;
  touch-action: none;
}
</style>
