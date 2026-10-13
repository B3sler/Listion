<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Fullscreen, ScanSearch, ZoomIn, ZoomOut } from 'lucide-vue-next'
import LContextMenu from '@/components/LContextMenu.vue'
import LBitPanel from '@/components/LBitPanel.vue'
import LBitCapsule from '@/components/LBitCapsule.vue'
import LPacketStack from '@/components/LPacketStack.vue'
import LDependencyLayer from '@/components/LDependencyLayer.vue'
import LPacketsHud from '@/components/LPacketsHud.vue'
import LTaskbar from '@/layout/LTaskbar.vue'
import LMenu from '@/layout/LMenu.vue'
import { useTheme } from '@/composables/useTheme.ts'
import { useCanvas } from '@/composables/useCanvas.ts'
import {
  CAPSULE_H,
  CAPSULE_W,
  anchor,
  computeLayout,
  dependencyGeometry,
  unionRect,
} from '@/composables/useFlowLayout'
import { computeFlowState } from '@/composables/useFlowState'
import { useFlowGestures } from '@/composables/useFlowGestures'
import { useFlowActions } from '@/composables/useFlowActions'
import { useBitStore } from '@/stores/bitStore'
import { usePacketStore } from '@/stores/packetStore'
import { useDependencyStore } from '@/stores/dependencyStore'
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
const actions = useFlowActions()

function toCanvas(clientX: number, clientY: number) {
  const rect = containerRef.value!.getBoundingClientRect()
  return {
    x: (clientX - rect.left - panX.value) / zoom.value,
    y: (clientY - rect.top - panY.value) / zoom.value,
  }
}

const selectedBitId = ref<number | null>(null)
const selectedDependencyId = ref<number | null>(null)
const highlightedPacketId = ref<number | null>(null)

// Layout of the stored state — what snap detection and drops reason about
const baseLayout = computed(() =>
  computeLayout({
    bits: bitStore.bits,
    packets: packetStore.packets,
    expandedBitId: selectedBitId.value,
  }),
)

const { bitDrag, packetDrag, linkDrag, startBitPointer, startPacketPointer, startLinkPointer } =
  useFlowGestures({
    toCanvas,
    zoom,
    layout: baseLayout,
    onTapBit: (id) => {
      selectedDependencyId.value = null
      selectedBitId.value = selectedBitId.value === id ? null : id
    },
    onDropBit: (id, target, pos) => actions.dropBit(id, target, pos, baseLayout.value),
    onMovePacketEnd: (id, x, y) => actions.movePacket(id, x, y),
    onCreateDependency: (from, to) => {
      void actions.createDependency(from, to)
    },
  })

// Layout including in-flight gestures — what is rendered and where arrows attach
const liveLayout = computed(() => {
  const pd = packetDrag.value
  const packets = pd
    ? packetStore.packets.map((p) => (p.id === pd.packetId ? { ...p, x: pd.x, y: pd.y } : p))
    : packetStore.packets
  const layout = computeLayout({
    bits: bitStore.bits,
    packets,
    expandedBitId: selectedBitId.value,
  })
  const bd = bitDrag.value
  if (bd) layout.bitRects.set(bd.bitId, { x: bd.x, y: bd.y, w: CAPSULE_W, h: CAPSULE_H })
  return layout
})

const flow = computed(() =>
  computeFlowState(bitStore.bits, packetStore.packets, dependencyStore.dependencies),
)

const looseBits = computed(() =>
  liveLayout.value.looseBitIds.map((id) => bitStore.bits.find((b) => b.id === id)!).filter(Boolean),
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

function packetOfBit(id: number): number | null {
  return bitStore.bits.find((b) => b.id === id)?.packetId ?? null
}

function isBitDimmed(id: number): boolean {
  return highlightedPacketId.value !== null && packetOfBit(id) !== highlightedPacketId.value
}

function isDependencyDimmed(dep: Dependency): boolean {
  const hp = highlightedPacketId.value
  if (hp === null) return false
  const touches = (type: 'bit' | 'packet', id: number) =>
    type === 'packet' ? id === hp : packetOfBit(id) === hp
  return !touches(dep.fromType, dep.fromId) && !touches(dep.toType, dep.toId)
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

function focusPacket(id: number) {
  highlightedPacketId.value = id
  const rect = liveLayout.value.packetRects.get(id)
  const el = containerRef.value
  if (!rect || !el) return
  const { width, height } = el.getBoundingClientRect()
  const z = zoom.value
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

// --- Detail panel ---
const showPanel = ref(false)
const panelMode = ref<'create' | 'edit'>('create')
const panelBitId = ref<number | null>(null)
const panelBit = computed(() =>
  panelBitId.value !== null ? bitStore.bits.find((b) => b.id === panelBitId.value) : undefined,
)

function createBit() {
  closeContextMenu()
  panelMode.value = 'create'
  panelBitId.value = null
  showPanel.value = true
}

function openBitDetail(id: number) {
  panelMode.value = 'edit'
  panelBitId.value = id
  showPanel.value = true
}

async function onPanelConfirm(data: {
  title: string
  status: number
  priority: number | undefined
  dueDate: string | undefined
  notes: string | undefined
  color: string
}) {
  if (panelMode.value === 'create') {
    showPanel.value = false
    try {
      await bitStore.createBit({
        ...data,
        x: contextCanvasPos.value.x - CAPSULE_W / 2,
        y: contextCanvasPos.value.y - CAPSULE_H / 2,
      })
    } catch (e) {
      console.error('Failed to create bit:', e)
    }
  } else if (panelBitId.value !== null) {
    try {
      await bitStore.updateBit(panelBitId.value, data)
      showPanel.value = false
    } catch (e) {
      console.error('Failed to update bit:', e)
    }
  }
}

async function onPanelDelete() {
  if (panelBitId.value === null) return
  const id = panelBitId.value
  showPanel.value = false
  if (selectedBitId.value === id) selectedBitId.value = null
  await actions.deleteBit(id, baseLayout.value)
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
  selectedBitId.value = null
  selectedDependencyId.value = null
  showControls.value = false
  handleMouseDown(e)
}

const { initTheme, applyTheme, isDark } = useTheme()

onMounted(() => {
  initTheme()
  applyTheme()
  window.addEventListener('mouseup', handleMouseUp)
  window.addEventListener('mousemove', handleMouseMove)
  actions.reloadAll().catch((e) => console.error('Failed to load workspace:', e))
})

onUnmounted(() => {
  window.removeEventListener('mouseup', handleMouseUp)
  window.removeEventListener('mousemove', handleMouseMove)
  clearLongPress()
})
</script>

<template>
  <div style="position: relative; width: 100vw; height: 100vh; overflow: hidden">
    <Transition name="sheet">
      <LBitPanel
        v-if="showPanel"
        :mode="panelMode"
        :bit="panelBit"
        @confirm="onPanelConfirm"
        @cancel="showPanel = false"
        @delete="onPanelDelete"
      />
    </Transition>

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
        transition: 'transform var(--spring-duration) var(--ease-spring)',
      }"
    >
      <div class="absolute inset-0 origin-top-left" :style="{ transform: canvasTransform }">
        <div v-if="bitStore.bits.length === 0" class="p-5">
          <div class="max-w-7xl">
            <h1 class="text-[2rem] text-text0 mb-2">Workspace</h1>
            <p class="text-text2 text-[0.9375rem] leading-relaxed">
              Right-click or long-press to create a bit. Drag a bit under another to build a packet;
              drag from the handle to draw a dependency.
            </p>
          </div>
        </div>

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
          :expanded-bit-id="selectedBitId"
          :gap-index="s.gapIndex"
          :highlighted="highlightedPacketId === s.packet.id"
          :dimmed="highlightedPacketId !== null && highlightedPacketId !== s.packet.id"
          :dragging="packetDrag?.packetId === s.packet.id"
          @header-pointerdown="(e) => startPacketPointer(e, s.packet.id)"
          @bit-pointerdown="(e, id) => startBitPointer(e, id)"
          @bit-open="openBitDetail"
          @linkstart="(e, from) => startLinkPointer(e, from)"
          @rename="(name) => actions.renamePacket(s.packet.id, name)"
        />

        <div
          v-for="bit in looseBits"
          :key="bit.id"
          class="flow-item"
          :class="{ 'flow-item--dragging': bitDrag?.bitId === bit.id }"
          :style="{
            transform: `translate3d(${liveLayout.bitRects.get(bit.id)!.x}px, ${liveLayout.bitRects.get(bit.id)!.y}px, 0)`,
          }"
        >
          <LBitCapsule
            :bit="bit"
            :state="flow.bitState.get(bit.id) ?? null"
            :expanded="selectedBitId === bit.id"
            :in-cycle="flow.cycleBitIds.has(bit.id)"
            :lifted="bitDrag?.bitId === bit.id"
            :dimmed="isBitDimmed(bit.id)"
            :snap-hint="
              bitDrag?.target?.kind === 'pair' && bitDrag.target.bitId === bit.id
                ? bitDrag.target.position
                : null
            "
            @pointerdown="(e) => startBitPointer(e, bit.id)"
            @open="openBitDetail(bit.id)"
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
            :expanded="false"
            lifted
          />
        </div>
      </div>

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

/* ── Bit panel sheet: enters and leaves along the same path ── */
.sheet-enter-active,
.sheet-leave-active {
  transition:
    transform var(--spring-duration) var(--ease-spring),
    opacity 0.25s ease;
}
.sheet-enter-from,
.sheet-leave-to {
  transform: translateX(-100%);
  opacity: 0.6;
}

@media (prefers-reduced-motion: reduce) {
  .sheet-enter-from,
  .sheet-leave-to {
    transform: none;
    opacity: 0;
  }
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
</style>
