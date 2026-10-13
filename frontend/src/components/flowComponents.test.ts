import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import type { Bit } from '@/stores/bitStore'
import LBitCapsule from './LBitCapsule.vue'
import LPacketStack from './LPacketStack.vue'
import LDependencyLayer from './LDependencyLayer.vue'
import depLayerSource from './LDependencyLayer.vue?raw'

const bit = (id: number, status = 0, order = 0): Bit => ({
  id,
  title: `Task ${id}`,
  status,
  x: 0,
  y: 0,
  packetId: 7,
  order,
  createdAt: '',
  priority: 3,
})

describe('LBitCapsule', () => {
  it('zeigt Titel, markiert blocked und öffnet per Enter', async () => {
    const w = mount(LBitCapsule, { props: { bit: bit(1), state: 'blocked' } })
    expect(w.text()).toContain('Task 1')
    expect(w.attributes('data-node-type')).toBe('bit')
    expect(w.attributes('data-node-id')).toBe('1')
    expect(w.classes()).toContain('capsule--blocked')
    await w.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('open')).toHaveLength(1)
  })

  it('klappt keine Details mehr auf', () => {
    const w = mount(LBitCapsule, { props: { bit: bit(1), state: null } })
    expect(w.find('.capsule__meta-wrap').exists()).toBe(false)
    expect(w.attributes('aria-expanded')).toBeUndefined()
  })

  it('der Status-Kreis hakt ab, ohne einen Drag oder das Panel auszulösen', async () => {
    const w = mount(LBitCapsule, { props: { bit: bit(1), state: null } })
    const check = w.find('.capsule__check')
    expect(check.attributes('aria-label')).toBe('Mark as done')
    await check.trigger('pointerdown')
    await check.trigger('click')
    expect(w.emitted('pointerdown')).toBeUndefined()
    expect(w.emitted('open')).toBeUndefined()
    expect(w.emitted('toggleDone')).toHaveLength(1)

    const done = mount(LBitCapsule, { props: { bit: bit(2, 2), state: null } })
    expect(done.find('.capsule__check').attributes('aria-label')).toBe('Mark as open')
  })

  it('zeigt die Priorität als farbige Flagge, ohne Priorität keine', () => {
    const high = mount(LBitCapsule, { props: { bit: bit(1), state: null } })
    expect(high.find('.capsule__prio').classes()).toContain('capsule__prio--3')
    const low = mount(LBitCapsule, { props: { bit: { ...bit(1), priority: 1 }, state: null } })
    expect(low.find('.capsule__prio').classes()).toContain('capsule__prio--1')
    const none = mount(LBitCapsule, {
      props: { bit: { ...bit(1), priority: undefined }, state: null },
    })
    expect(none.find('.capsule__prio').exists()).toBe(false)
  })

  it('liefert Titel, Zustand und Priorität als aria-label', () => {
    const blocked = mount(LBitCapsule, { props: { bit: bit(1), state: 'blocked' } })
    const label = blocked.attributes('aria-label') ?? ''
    expect(label).toContain('Task 1')
    expect(label).toContain('blocked')
    expect(label).toContain('High priority')

    const done = mount(LBitCapsule, { props: { bit: bit(2, 2), state: null } })
    expect(done.attributes('aria-label')).toContain('Done')
  })
})

describe('LPacketStack', () => {
  const props = {
    packet: { id: 7, name: 'Release', x: 0, y: 0 },
    members: [bit(1, 2, 0), bit(2, 0, 1)],
    x: 10,
    y: 20,
    states: new Map(),
    cycleBitIds: new Set<number>(),
    summary: { total: 2, done: 1, inProgress: 0, blocked: 0, ready: 1, cycles: 0, percent: 50 },
    gapIndex: null,
  }

  it('reicht das Abhaken eines Schritts weiter', async () => {
    const w = mount(LPacketStack, { props })
    await w.findAll('.capsule__check')[1]!.trigger('click')
    expect(w.emitted('bitToggleDone')).toEqual([[2]])
  })

  it('zeigt Name, Fortschritt und nummerierte Schritte', () => {
    const w = mount(LPacketStack, { props })
    expect(w.text()).toContain('Release')
    expect(w.text()).toContain('1 / 2')
    expect(w.findAll('.stack__num').map((n) => n.text())).toEqual(['1', '2'])
    expect(w.attributes('data-node-type')).toBe('packet')
  })

  it('benennt per Doppelklick um', async () => {
    const w = mount(LPacketStack, { props })
    await w.find('.stack__name').trigger('dblclick')
    const input = w.find('input')
    await input.setValue('Launch')
    await input.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('rename')).toEqual([['Launch']])
  })
})

describe('LDependencyLayer', () => {
  const item = {
    id: 4,
    d: 'M 0 0 C 50 0 50 0 100 0',
    mx: 50,
    my: 0,
    tx: 100,
    ty: 0,
    angle: 0,
    state: 'pending' as const,
    dimmed: false,
  }

  it('wählt aus und löscht über den ✕-Knopf', async () => {
    const w = mount(LDependencyLayer, { props: { items: [item], preview: null, selectedId: null } })
    await w.find('.dep__hit').trigger('click')
    expect(w.emitted('select')).toEqual([[4]])
    await w.setProps({ selectedId: 4 })
    await w.find('.dep__delete').trigger('click')
    expect(w.emitted('remove')).toEqual([[4]])
  })

  it('bedient Pfeile per Tastatur: Enter wählt, Delete entfernt', async () => {
    const w = mount(LDependencyLayer, { props: { items: [item], preview: null, selectedId: null } })
    await w.find('.dep__hit').trigger('keydown', { key: 'Enter' })
    expect(w.emitted('select')).toEqual([[4]])
    await w.find('.dep__hit').trigger('keydown', { key: 'Delete' })
    expect(w.emitted('remove')).toEqual([[4]])
  })

  it('zeichnet die Pfeilspitze deckend, damit die Linie nicht durchscheint', () => {
    for (const state of ['pending', 'done', 'cycle'] as const) {
      const w = mount(LDependencyLayer, {
        props: { items: [{ ...item, state }], preview: null, selectedId: null },
      })
      expect(w.find('polygon').attributes('fill')).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('löscht den ✕-Knopf per Enter', async () => {
    const w = mount(LDependencyLayer, { props: { items: [item], preview: null, selectedId: 4 } })
    await w.find('.dep__delete').trigger('keydown', { key: 'Enter' })
    expect(w.emitted('remove')).toEqual([[4]])
  })
})

describe('LDependencyLayer Größe', () => {
  // jsdom does not apply scoped styles or paint, so the rule is checked in the SFC source.
  // Chrome does not paint a 0x0 svg's contents, so the arrows would vanish.
  it('root svg ist nicht 0x0, sonst zeichnet Chrome keine Pfeile', () => {
    const rule = depLayerSource.match(/\.deps\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(rule).toMatch(/width:\s*1px/)
    expect(rule).toMatch(/height:\s*1px/)
    expect(rule).not.toMatch(/width:\s*0\s*;/)
    expect(rule).not.toMatch(/height:\s*0\s*;/)
  })
})

describe('Pan-Gesten über Knoten', () => {
  const depItem = {
    id: 4,
    d: 'M 0 0 C 50 0 50 0 100 0',
    mx: 50,
    my: 0,
    tx: 100,
    ty: 0,
    angle: 0,
    state: 'pending' as const,
    dimmed: false,
  }
  const stackProps = {
    packet: { id: 7, name: 'Release', x: 0, y: 0 },
    members: [bit(1, 2, 0)],
    x: 0,
    y: 0,
    states: new Map(),
    cycleBitIds: new Set<number>(),
    summary: { total: 1, done: 1, inProgress: 0, blocked: 0, ready: 0, cycles: 0, percent: 100 },
    gapIndex: null,
  }

  // The host element stands in for the canvas, which pans on shift+left and middle button.
  function mountInHost(mountFn: (host: HTMLElement) => void) {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const onCanvasMouseDown = vi.fn()
    host.addEventListener('mousedown', onCanvasMouseDown)
    mountFn(host)
    return { host, onCanvasMouseDown }
  }

  const targets: [string, string, (host: HTMLElement) => void][] = [
    [
      'Kapsel',
      '.capsule',
      (host) =>
        void mount(LBitCapsule, {
          props: { bit: bit(1), state: null },
          attachTo: host,
        }),
    ],
    [
      'Kapsel-Griff',
      '.capsule__handle',
      (host) =>
        void mount(LBitCapsule, {
          props: { bit: bit(1), state: null },
          attachTo: host,
        }),
    ],
    ['Stapel', '.stack', (host) => void mount(LPacketStack, { props: stackProps, attachTo: host })],
    [
      'Stapel-Griff',
      '.stack__handle',
      (host) => void mount(LPacketStack, { props: stackProps, attachTo: host }),
    ],
    [
      'Pfeil',
      '.dep__hit',
      (host) =>
        void mount(LDependencyLayer, {
          props: { items: [depItem], preview: null, selectedId: null },
          attachTo: host,
        }),
    ],
    [
      'Pfeil-✕',
      '.dep__delete',
      (host) =>
        void mount(LDependencyLayer, {
          props: { items: [depItem], preview: null, selectedId: 4 },
          attachTo: host,
        }),
    ],
  ]

  it.each(targets)('%s: Shift+Links und Mittelklick erreichen die Canvas', (_name, sel, setup) => {
    const { host, onCanvasMouseDown } = mountInHost(setup)
    const el = host.querySelector(sel)!
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, shiftKey: true }))
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 1 }))
    expect(onCanvasMouseDown).toHaveBeenCalledTimes(2)
  })

  it.each(targets)('%s: normaler Linksklick bleibt am Knoten', (_name, sel, setup) => {
    const { host, onCanvasMouseDown } = mountInHost(setup)
    host
      .querySelector(sel)!
      .dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
    expect(onCanvasMouseDown).not.toHaveBeenCalled()
  })
})
