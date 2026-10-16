import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { useBitStore, type Bit } from '@/stores/bitStore'
import { useDependencyStore } from '@/stores/dependencyStore'
import { usePacketStore } from '@/stores/packetStore'
import { BIT_COMMANDS, type BitCommands } from '@/composables/useBitCommands'
import LDependencyList from './LDependencyList.vue'

function bit(id: string, title: string, extra: Partial<Bit> = {}): Bit {
  return {
    id,
    title,
    status: 0,
    x: 0,
    y: 0,
    packetId: null,
    order: 0,
    createdAt: '2026-10-14T09:00:00.000Z',
    notes: '',
    color: '#ef4444',
    ...extra,
  }
}

let pinia: Pinia
let removeDependency: ReturnType<typeof vi.fn<BitCommands['removeDependency']>>
let wrapper: VueWrapper | null = null

function mountList() {
  wrapper = mount(LDependencyList, {
    props: { bitId: 'b1' },
    global: {
      plugins: [pinia],
      provide: { [BIT_COMMANDS as symbol]: { removeDependency } },
    },
  })
  return wrapper
}

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  removeDependency = vi.fn<BitCommands['removeDependency']>().mockResolvedValue(undefined)
  useBitStore().bits = [
    bit('b1', 'Steuer abgeben'),
    bit('b2', 'Belege sammeln', { status: 2 }),
    bit('b3', 'Bescheid prüfen', { status: 1 }),
  ]
  usePacketStore().packets = [{ id: 'p1', name: 'Umzug', x: 0, y: 0 }]
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('LDependencyList', () => {
  it('zeigt „Waiting for“ und „Blocking“, wenn es eingehende und ausgehende Pfeile gibt', () => {
    useDependencyStore().dependencies = [
      { id: 'd1', fromType: 'bit', fromId: 'b2', toType: 'bit', toId: 'b1' },
      { id: 'd2', fromType: 'bit', fromId: 'b1', toType: 'bit', toId: 'b3' },
    ]
    const w = mountList()
    const headings = w.findAll('.deplist__heading').map((h) => h.text())
    expect(headings).toEqual(['Waiting for', 'Blocking'])
    const [waiting, blocking] = w.findAll('.deplist__group')
    expect(waiting.text()).toContain('Belege sammeln')
    expect(blocking.text()).toContain('Bescheid prüfen')
  })

  it('zeigt nur den Abschnitt, für den es Pfeile gibt', () => {
    useDependencyStore().dependencies = [
      { id: 'd2', fromType: 'bit', fromId: 'b1', toType: 'bit', toId: 'b3' },
    ]
    const w = mountList()
    expect(w.findAll('.deplist__heading').map((h) => h.text())).toEqual(['Blocking'])
  })

  it('rendert ohne Pfeile nichts', () => {
    const w = mountList()
    expect(w.html()).toBe('<!--v-if-->')
  })

  it('versteckt Zeilen, deren Gegenstück gelöscht (ausgeblendet) ist oder fehlt', () => {
    useDependencyStore().dependencies = [
      { id: 'd1', fromType: 'bit', fromId: 'b2', toType: 'bit', toId: 'b1' },
      { id: 'd2', fromType: 'bit', fromId: 'b3', toType: 'bit', toId: 'b1' },
      { id: 'd3', fromType: 'packet', fromId: 'weg', toType: 'bit', toId: 'b1' },
    ]
    useBitStore().hiddenIds.add('b2')
    const w = mountList()
    expect(w.findAll('.deplist__row')).toHaveLength(1)
    expect(w.text()).toContain('Bescheid prüfen')
    expect(w.text()).not.toContain('Belege sammeln')
  })

  it('zeigt bei Bits einen Status-Punkt, bei Packets Stack-Icon und Namen', () => {
    useDependencyStore().dependencies = [
      { id: 'd1', fromType: 'bit', fromId: 'b2', toType: 'bit', toId: 'b1' },
      { id: 'd2', fromType: 'packet', fromId: 'p1', toType: 'bit', toId: 'b1' },
    ]
    const w = mountList()
    const rows = w.findAll('.deplist__row')
    expect(rows[0].find('.deplist__dot--s2').exists()).toBe(true)
    expect(rows[0].find('.deplist__stack').exists()).toBe(false)
    expect(rows[1].find('.deplist__stack').exists()).toBe(true)
    expect(rows[1].text()).toContain('Umzug')
  })

  it('markiert die Zeilen mit data-no-swipe', () => {
    useDependencyStore().dependencies = [
      { id: 'd1', fromType: 'bit', fromId: 'b2', toType: 'bit', toId: 'b1' },
    ]
    const w = mountList()
    expect(w.find('.deplist__row').attributes('data-no-swipe')).toBeDefined()
  })

  it('emittiert beim Klick auf eine Zeile navigate mit dem Ziel', async () => {
    useDependencyStore().dependencies = [
      { id: 'd1', fromType: 'bit', fromId: 'b2', toType: 'bit', toId: 'b1' },
      { id: 'd2', fromType: 'packet', fromId: 'p1', toType: 'bit', toId: 'b1' },
    ]
    const w = mountList()
    const mains = w.findAll('.deplist__main')
    await mains[0].trigger('click')
    await mains[1].trigger('click')
    expect(w.emitted('navigate')).toEqual([
      [{ type: 'bit', id: 'b2' }],
      [{ type: 'packet', id: 'p1' }],
    ])
  })

  it('ruft mit × removeDependency auf, ohne zu navigieren', async () => {
    useDependencyStore().dependencies = [
      { id: 'd1', fromType: 'bit', fromId: 'b2', toType: 'bit', toId: 'b1' },
    ]
    const w = mountList()
    const remove = w.find('[aria-label="Remove dependency on Belege sammeln"]')
    expect(remove.element.tagName).toBe('BUTTON')
    await remove.trigger('click')
    expect(removeDependency).toHaveBeenCalledWith('d1')
    expect(w.emitted('navigate')).toBeUndefined()
    // the row goes away with its arrow: nothing keeps hovering it
    expect(w.emitted('hover')?.at(-1)).toEqual([null])
  })

  it('emittiert bei mouseenter hover mit der Pfeil-ID und bei mouseleave null', async () => {
    useDependencyStore().dependencies = [
      { id: 'd1', fromType: 'bit', fromId: 'b2', toType: 'bit', toId: 'b1' },
    ]
    const w = mountList()
    const row = w.find('.deplist__row')
    await row.trigger('mouseenter')
    expect(w.emitted('hover')).toEqual([['d1']])
    await row.trigger('mouseleave')
    expect(w.emitted('hover')).toEqual([['d1'], [null]])
  })

  it('hebt den Pfeil auch bei Tastaturfokus hervor', async () => {
    useDependencyStore().dependencies = [
      { id: 'd1', fromType: 'bit', fromId: 'b2', toType: 'bit', toId: 'b1' },
    ]
    const w = mountList()
    const row = w.find('.deplist__row')
    await row.trigger('focusin')
    expect(w.emitted('hover')).toEqual([['d1']])
    await row.trigger('focusout')
    expect(w.emitted('hover')).toEqual([['d1'], [null]])
  })
})
