import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import LFlowFrame from './LFlowFrame.vue'
import LFilterPopover from './LFilterPopover.vue'
import LLassoPath from './LLassoPath.vue'
import LPacketStack from './LPacketStack.vue'
import LTaskbar from '@/layout/LTaskbar.vue'
import { useToolStore } from '@/stores/toolStore'
import type { Bit } from '@/stores/bitStore'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

const flow = { id: 5, name: 'Release', color: '#818cf8' }
const rect = { x: 10, y: 20, w: 300, h: 200 }

describe('LFlowFrame', () => {
  it('zeigt den Namen auf der Linie und benennt per Klick um', async () => {
    const w = mount(LFlowFrame, { props: { flow, rect } })
    expect(w.attributes('data-flow-id')).toBe('5')
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

const bit = (id: number): Bit => ({
  id,
  title: `Task ${id}`,
  status: 0,
  x: 0,
  y: 0,
  packetId: 7,
  order: id,
  createdAt: '',
  priority: 3,
})

describe('LPacketStack', () => {
  it('reicht dimmedBitIds als dimmed an die passenden Schritte weiter', () => {
    const members = [bit(1), bit(2)]
    const w = mount(LPacketStack, {
      props: {
        packet: { id: 7, name: 'Stack', x: 0, y: 0 },
        members,
        x: 0,
        y: 0,
        states: new Map(),
        cycleBitIds: new Set<number>(),
        summary: { total: 2, done: 0, inProgress: 0, blocked: 0, ready: 0, cycles: 0, percent: 0 },
        gapIndex: null,
        dimmedBitIds: new Set([2]),
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
})
