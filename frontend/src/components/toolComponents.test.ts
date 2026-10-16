import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import LFlowFrame from './LFlowFrame.vue'
import LFilterPopover from './LFilterPopover.vue'
import LLassoPath from './LLassoPath.vue'
import LPacketStack from './LPacketStack.vue'
import LUndoToast from './LUndoToast.vue'
import LFocusPill from './LFocusPill.vue'
import LTaskbar from '@/layout/LTaskbar.vue'
import { useToolStore } from '@/stores/toolStore'
import { useHistoryStore } from '@/stores/historyStore'
import { useFocusStore } from '@/stores/focusStore'
import { useSheetStore } from '@/stores/sheetStore'
import { useBitStore, type Bit } from '@/stores/bitStore'

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn().mockResolvedValue({ data: {} }),
  put: vi.fn(),
  delete: vi.fn(),
}))
vi.mock('@/helpers/api', () => ({ default: api }))

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

const flow = { id: 'f5', name: 'Release', color: '#818cf8' }
const rect = { x: 10, y: 20, w: 300, h: 200 }

describe('LFlowFrame', () => {
  it('zeigt den Namen auf der Linie und benennt per Klick um', async () => {
    const w = mount(LFlowFrame, { props: { flow, rect } })
    expect(w.attributes('data-flow-id')).toBe('f5')
    expect(w.attributes('style')).toContain('translate3d(10px, 20px, 0')
    await w.find('.flow__name').trigger('click')
    const input = w.find('input')
    await input.setValue('Launch')
    await input.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('rename')).toEqual([['Launch']])
  })

  it('Hover-Leiste: Farbe wählen und Flow auflösen', async () => {
    const w = mount(LFlowFrame, { props: { flow, rect } })
    await w.find('.flow__label').trigger('mouseenter')
    const swatches = w.findAll('.flow__swatch')
    expect(swatches).toHaveLength(6)
    expect(swatches[0]!.attributes('aria-pressed')).toBe('true')
    await swatches[1]!.trigger('click')
    expect(w.emitted('recolor')).toEqual([['#34d399']])
    await w.find('.flow__dissolve').trigger('click')
    expect(w.emitted('dissolve')).toHaveLength(1)
  })

  it('Druck auf der Beschriftung erreicht den Canvas nicht', async () => {
    const canvas = document.createElement('div')
    document.body.appendChild(canvas)
    const onCanvasPointerdown = vi.fn()
    canvas.addEventListener('pointerdown', onCanvasPointerdown)
    const w = mount(LFlowFrame, { props: { flow, rect }, attachTo: canvas })
    await w.find('.flow__label').trigger('pointerdown')
    expect(onCanvasPointerdown).not.toHaveBeenCalled()
    expect(w.emitted('dragstart')).toBeUndefined()
    w.unmount()
  })

  it('Ziehen auf der freien Fläche meldet dragstart, auf dem Namen nicht', async () => {
    const w = mount(LFlowFrame, { props: { flow, rect } })
    await w.find('.flow__name').trigger('pointerdown')
    expect(w.emitted('dragstart')).toBeUndefined()
    await w.trigger('pointerdown')
    expect(w.emitted('dragstart')).toHaveLength(1)
  })
})

describe('LFilterPopover', () => {
  it('Chips schalten Filter, Zurücksetzen leert', async () => {
    const w = mount(LFilterPopover, {
      props: { filters: { workflow: ['ready'], priority: [], due: [] } },
    })
    const ready = w.find('[data-filter="workflow:ready"]')
    expect(ready.attributes('aria-pressed')).toBe('true')
    await w.find('[data-filter="priority:3"]').trigger('click')
    await w.find('[data-filter="due:today"]').trigger('click')
    expect(w.emitted('toggle')).toEqual([
      ['priority', 3],
      ['due', 'today'],
    ])
    await w.find('.filter__reset').trigger('click')
    expect(w.emitted('reset')).toHaveLength(1)
  })
})

describe('LLassoPath', () => {
  it('zeichnet die Spur als Polylinie', () => {
    const w = mount(LLassoPath, {
      props: {
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 5 },
        ],
      },
    })
    expect(w.find('polyline').attributes('points')).toBe('0,0 10,5')
  })
})

const bit = (n: number): Bit => ({
  id: String(n),
  title: `Task ${n}`,
  status: 0,
  x: 0,
  y: 0,
  packetId: '7',
  order: n,
  createdAt: '',
  priority: 3,
})

describe('LPacketStack', () => {
  it('reicht dimmedBitIds als dimmed an die passenden Schritte weiter', () => {
    const members = [bit(1), bit(2)]
    const w = mount(LPacketStack, {
      props: {
        packet: { id: '7', name: 'Stack', x: 0, y: 0 },
        members,
        x: 0,
        y: 0,
        states: new Map(),
        cycleBitIds: new Set<string>(),
        summary: { total: 2, done: 0, inProgress: 0, blocked: 0, ready: 0, cycles: 0, percent: 0 },
        gapIndex: null,
        dimmedBitIds: new Set(['2']),
      },
    })
    const capsules = w.findAll('.capsule')
    expect(capsules[0]!.classes()).not.toContain('capsule--dimmed')
    expect(capsules[1]!.classes()).toContain('capsule--dimmed')
  })
})

describe('LTaskbar', () => {
  it('Werkzeuge links, Logo mittig, Filter rechts mit Zähler', async () => {
    const w = mount(LTaskbar, { attachTo: document.body })
    const store = useToolStore()
    const select = w.find('[aria-label="Select"]')
    const flowBtn = w.find('[aria-label="Flow"]')
    expect(select.attributes('aria-pressed')).toBe('true')
    await flowBtn.trigger('click')
    expect(store.activeTool).toBe('flow')
    expect(flowBtn.attributes('aria-pressed')).toBe('true')
    expect(w.find('img[alt="Listion Logo"]').exists()).toBe(true)

    store.toggleFilter('priority', 3)
    await w.vm.$nextTick()
    expect(w.find('.tool__badge').text()).toBe('1')
    await w.find('[aria-label="Filter"]').trigger('click')
    expect(store.filterOpen).toBe(true)
    expect(w.find('.filter').exists()).toBe(true)
    w.unmount()
  })

  describe('Filter-Popover schliessen', () => {
    const press = (el: Element) =>
      el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true }))

    function outsideElement(): HTMLElement {
      const el = document.createElement('div')
      document.body.appendChild(el)
      return el
    }

    it('schliesst bei einem Druck ausserhalb', async () => {
      const w = mount(LTaskbar, { attachTo: document.body })
      const store = useToolStore()
      store.filterOpen = true
      await w.vm.$nextTick()
      press(outsideElement())
      expect(store.filterOpen).toBe(false)
      w.unmount()
    })

    it('schliesst auch, wenn das Ziel die Ereignisweitergabe stoppt', async () => {
      const w = mount(LTaskbar, { attachTo: document.body })
      const store = useToolStore()
      store.filterOpen = true
      await w.vm.$nextTick()
      const outside = outsideElement()
      outside.addEventListener('pointerdown', (e) => e.stopPropagation())
      press(outside)
      expect(store.filterOpen).toBe(false)
      w.unmount()
    })

    it('bleibt offen bei einem Druck im Popover', async () => {
      const w = mount(LTaskbar, { attachTo: document.body })
      const store = useToolStore()
      store.filterOpen = true
      await w.vm.$nextTick()
      press(w.find('.filter').element)
      expect(store.filterOpen).toBe(true)
      w.unmount()
    })
  })
})

describe('LUndoToast', () => {
  afterEach(() => {
    useHistoryStore().dismissToast()
    vi.unstubAllGlobals()
  })

  it('zeigt nichts, solange kein Toast aktiv ist', () => {
    const w = mount(LUndoToast)
    expect(w.find('.toast').exists()).toBe(false)
  })

  it('zeigt die Meldung als Statusanzeige mit Undo-Knopf', async () => {
    const w = mount(LUndoToast)
    useHistoryStore().showToast({ id: 't1', message: 'Bit deleted', undoable: true })
    await w.vm.$nextTick()
    const toast = w.find('.toast')
    expect(toast.attributes('role')).toBe('status')
    expect(toast.attributes('aria-live')).toBe('polite')
    expect(toast.classes()).toContain('material--regular')
    expect(toast.text()).toContain('Bit deleted')
    expect(w.find('.toast__undo').text()).toBe('Undo')
  })

  it('blendet den Undo-Knopf aus, wenn die Aktion nicht umkehrbar ist', async () => {
    const w = mount(LUndoToast)
    useHistoryStore().showToast({ id: 't1', message: "Couldn't delete", undoable: false })
    await w.vm.$nextTick()
    expect(w.find('.toast').text()).toContain("Couldn't delete")
    expect(w.find('.toast__undo').exists()).toBe(false)
  })

  it('ein Klick auf Undo ruft undoToast auf', async () => {
    const w = mount(LUndoToast)
    const history = useHistoryStore()
    const undoToast = vi.spyOn(history, 'undoToast').mockResolvedValue()
    history.showToast({ id: 't1', message: 'Done', undoable: true, entryId: 'e1' })
    await w.vm.$nextTick()
    await w.find('.toast__undo').trigger('click')
    expect(undoToast).toHaveBeenCalledTimes(1)
  })

  it('Hover pausiert den Ablauf, Verlassen setzt ihn fort', async () => {
    const w = mount(LUndoToast)
    const history = useHistoryStore()
    const pause = vi.spyOn(history, 'pauseToast')
    const resume = vi.spyOn(history, 'resumeToast')
    history.showToast({ id: 't1', message: 'Done', undoable: true })
    await w.vm.$nextTick()
    await w.find('.toast').trigger('mouseenter')
    expect(pause).toHaveBeenCalledTimes(1)
    expect(resume).not.toHaveBeenCalled()
    await w.find('.toast').trigger('mouseleave')
    expect(resume).toHaveBeenCalledTimes(1)
  })

  it('ein neuer Toast ersetzt den alten; bei Reduced Motion blendet nur die Deckkraft', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduced-motion') }))
    const w = mount(LUndoToast, { global: { stubs: { transition: false } } })
    const history = useHistoryStore()
    history.showToast({ id: 't1', message: 'First', undoable: true })
    await vi.waitFor(() => expect(w.text()).toContain('First'))
    history.showToast({ id: 't2', message: 'Second', undoable: true })
    await vi.waitFor(() => {
      expect(w.findAll('.toast')).toHaveLength(1)
      expect(w.text()).toContain('Second')
    })
    expect((w.find('.toast').element as HTMLElement).style.transform).toBe('')
    history.dismissToast()
    await vi.waitFor(() => expect(w.find('.toast').exists()).toBe(false))
  })
})

describe('LFocusPill', () => {
  const T0 = new Date(2026, 9, 16, 10, 0, 0).getTime()

  function pillBit(extra: Partial<Bit> = {}): Bit {
    return {
      id: 'b1',
      title: 'Steuer abgeben',
      status: 0,
      x: 0,
      y: 0,
      packetId: null,
      order: 0,
      createdAt: '',
      color: '#ef4444',
      ...extra,
    }
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(T0)
    api.post.mockClear()
    useBitStore().bits = [pillBit()]
  })

  afterEach(() => {
    useFocusStore().cancel()
    vi.useRealTimers()
  })

  it('wird nur gerendert, wenn ein Timer läuft', async () => {
    const w = mount(LFocusPill)
    expect(w.find('.focus-pill').exists()).toBe(false)
    useFocusStore().start('b1')
    await w.vm.$nextTick()
    expect(w.find('.focus-pill').exists()).toBe(true)
    useFocusStore().cancel()
    await w.vm.$nextTick()
    expect(w.find('.focus-pill').exists()).toBe(false)
  })

  it('zeigt Titel und laufende Zeit', async () => {
    const w = mount(LFocusPill)
    useFocusStore().start('b1')
    vi.advanceTimersByTime(724_000)
    await w.vm.$nextTick()
    expect(w.find('.focus-pill__title').text()).toBe('Steuer abgeben')
    expect(w.find('.focus-pill__time').text()).toBe('12:04')
  })

  it('kürzt lange Titel auf höchstens 18 Zeichen mit …', async () => {
    useBitStore().bits = [pillBit({ title: 'Steuererklärung für das Jahr 2025 abgeben' })]
    const w = mount(LFocusPill)
    useFocusStore().start('b1')
    await w.vm.$nextTick()
    const title = w.find('.focus-pill__title').text()
    expect(title).toBe('Steuererklärung f…')
    expect(title).toHaveLength(18)
  })

  it('öffnet per Klick auf den Titel das Bit im Sheet', async () => {
    const w = mount(LFocusPill)
    const sheet = useSheetStore()
    const open = vi.spyOn(sheet, 'openDetail')
    useFocusStore().start('b1')
    await w.vm.$nextTick()
    await w.find('.focus-pill__title').trigger('click')
    expect(open).toHaveBeenCalledWith('b1')
  })

  it('■ stoppt den Timer und bucht die Zeit', async () => {
    const w = mount(LFocusPill)
    const focus = useFocusStore()
    focus.start('b1')
    vi.advanceTimersByTime(65_000)
    await w.vm.$nextTick()
    await w.find('[aria-label="Stop focus"]').trigger('click')
    expect(focus.running).toBeNull()
    expect(api.post).toHaveBeenCalledWith('/api/bit/b1/focus', { seconds: 65 })
    await w.vm.$nextTick()
    expect(w.find('.focus-pill').exists()).toBe(false)
  })

  it('steht in der Taskbar rechts vor dem Filter', async () => {
    const w = mount(LTaskbar, { attachTo: document.body })
    expect(w.find('.focus-pill').exists()).toBe(false)
    useFocusStore().start('b1')
    await w.vm.$nextTick()
    const pill = w.find('.focus-pill')
    const filter = w.find('[aria-label="Filter"]')
    expect(pill.exists()).toBe(true)
    expect(
      pill.element.compareDocumentPosition(filter.element) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    w.unmount()
  })
})
