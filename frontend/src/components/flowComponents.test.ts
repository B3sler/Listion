import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { Bit } from '@/stores/bitStore'
import { addDays, todayKey } from '@/helpers/localDate'
import LBitCapsule from './LBitCapsule.vue'
import LPacketStack from './LPacketStack.vue'
import LDependencyLayer from './LDependencyLayer.vue'
import depLayerSource from './LDependencyLayer.vue?raw'
import capsuleSource from './LBitCapsule.vue?raw'
import { CAPSULE_H } from '@/composables/useFlowLayout'

const bit = (id: string, status = 0, order = 0): Bit => ({
  id,
  title: `Task ${id}`,
  status,
  x: 0,
  y: 0,
  packetId: '7',
  order,
  createdAt: '',
  priority: 3,
})

// the capsule listens to the sheet store (settle requests)
beforeEach(() => setActivePinia(createPinia()))

describe('LBitCapsule', () => {
  it('zeigt Titel, markiert blocked und öffnet per Enter', async () => {
    const w = mount(LBitCapsule, { props: { bit: bit('1'), state: 'blocked' } })
    expect(w.text()).toContain('Task 1')
    expect(w.attributes('data-node-type')).toBe('bit')
    expect(w.attributes('data-node-id')).toBe('1')
    expect(w.classes()).toContain('capsule--blocked')
    await w.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('open')).toHaveLength(1)
  })

  it('klappt keine Details mehr auf', () => {
    const w = mount(LBitCapsule, { props: { bit: bit('1'), state: null } })
    expect(w.find('.capsule__meta-wrap').exists()).toBe(false)
    expect(w.attributes('aria-expanded')).toBeUndefined()
  })

  it('der Status-Kreis hakt ab, ohne einen Drag oder das Panel auszulösen', async () => {
    const w = mount(LBitCapsule, { props: { bit: bit('1'), state: null } })
    const check = w.find('.capsule__check')
    expect(check.attributes('aria-label')).toBe('Mark as done')
    await check.trigger('pointerdown')
    await check.trigger('click')
    expect(w.emitted('pointerdown')).toBeUndefined()
    expect(w.emitted('open')).toBeUndefined()
    expect(w.emitted('toggleDone')).toHaveLength(1)

    const done = mount(LBitCapsule, { props: { bit: bit('2', 2), state: null } })
    expect(done.find('.capsule__check').attributes('aria-label')).toBe('Mark as open')
  })

  it('zeigt die Priorität als farbige Flagge, ohne Priorität keine', () => {
    const high = mount(LBitCapsule, { props: { bit: bit('1'), state: null } })
    expect(high.find('.capsule__prio').classes()).toContain('capsule__prio--3')
    const low = mount(LBitCapsule, { props: { bit: { ...bit('1'), priority: 1 }, state: null } })
    expect(low.find('.capsule__prio').classes()).toContain('capsule__prio--1')
    const none = mount(LBitCapsule, {
      props: { bit: { ...bit('1'), priority: undefined }, state: null },
    })
    expect(none.find('.capsule__prio').exists()).toBe(false)
  })

  it('liefert Titel, Zustand und Priorität als aria-label', () => {
    const blocked = mount(LBitCapsule, { props: { bit: bit('1'), state: 'blocked' } })
    const label = blocked.attributes('aria-label') ?? ''
    expect(label).toContain('Task 1')
    expect(label).toContain('blocked')
    expect(label).toContain('High priority')

    const done = mount(LBitCapsule, { props: { bit: bit('2', 2), state: null } })
    expect(done.attributes('aria-label')).toContain('Done')
  })

  describe('Größe, Meta-Zeile und Zustände', () => {
    const tomorrow = addDays(todayKey(), 1)
    const later = addDays(todayKey(), 10)
    const sized = (extra: Partial<Bit>): Bit => ({ ...bit('1'), ...extra })
    const settleOf = (w: { vm: unknown }) => (w.vm as { settle: () => void }).settle()

    it('rendert die Höhe fest nach Aufwand', () => {
      const heights = [undefined, 1, 2, 3, 4].map((size) => {
        const w = mount(LBitCapsule, {
          props: { bit: sized({ size: size as Bit['size'] }), state: null },
        })
        return (w.element as HTMLElement).style.height
      })
      expect(heights).toEqual(['32px', '32px', '44px', '64px', '84px'])
    })

    it('zeigt bei M eine Meta-Zeile mit Fälligkeit', () => {
      const w = mount(LBitCapsule, {
        props: { bit: sized({ size: 2, dueDate: tomorrow }), state: null },
      })
      expect(w.find('.capsule__meta').text()).toContain('Tomorrow')
    })

    it('trennt die Meta-Einträge mit Punkt und formatiert die Fokuszeit', () => {
      const w = mount(LBitCapsule, {
        props: {
          bit: sized({ size: 2, dueDate: tomorrow, focusSeconds: 4800, recurrence: 'daily' }),
          state: null,
        },
      })
      const meta = w.find('.capsule__meta')
      expect(meta.text()).toContain('Tomorrow')
      expect(meta.text()).toContain('1h20')
      expect(meta.text()).toContain('·')
      expect(meta.find('.capsule__repeat').exists()).toBe(true)
      const short = mount(LBitCapsule, {
        props: { bit: sized({ size: 2, focusSeconds: 2700 }), state: null },
      })
      expect(short.find('.capsule__meta').text()).toContain('45m')
    })

    it('zeigt keine Meta-Zeile, wenn nichts anzuzeigen ist', () => {
      const w = mount(LBitCapsule, { props: { bit: sized({ size: 2 }), state: null } })
      expect(w.find('.capsule__meta').exists()).toBe(false)
    })

    it('zeigt bei L eine Notiz-Zeile, bei XL zwei', () => {
      const l = mount(LBitCapsule, {
        props: { bit: sized({ size: 3, notes: 'Eine längere Notiz' }), state: null },
      })
      expect(l.find('.capsule__notes').text()).toBe('Eine längere Notiz')
      expect(l.find('.capsule__notes').attributes('style')).toContain('--lines: 1')
      const xl = mount(LBitCapsule, {
        props: { bit: sized({ size: 4, notes: 'Eine längere Notiz' }), state: null },
      })
      expect(xl.find('.capsule__notes').attributes('style')).toContain('--lines: 2')
    })

    it('zeigt bei S und M keine Notiz-Vorschau', () => {
      for (const size of [1, 2] as const) {
        const w = mount(LBitCapsule, {
          props: { bit: sized({ size, notes: 'Notiz' }), state: null },
        })
        expect(w.find('.capsule__notes').exists()).toBe(false)
      }
    })

    it('zeigt bei S keine Meta-Zeile', () => {
      const w = mount(LBitCapsule, {
        props: { bit: sized({ size: 1, dueDate: tomorrow, focusSeconds: 600 }), state: null },
      })
      expect(w.find('.capsule__meta').exists()).toBe(false)
    })

    it('blendet gesnoozte Bits aus und nennt das Datum im aria-label', () => {
      const w = mount(LBitCapsule, {
        props: { bit: sized({ size: 2, snoozedUntil: later }), state: null },
      })
      expect(w.classes()).toContain('capsule--snoozed')
      expect(w.attributes('aria-label')).toContain('snoozed until')
      // M: the moon sits in the meta line, not behind the title
      expect(w.find('.capsule__meta .capsule__snooze').exists()).toBe(true)
    })

    it('setzt bei S das Snooze-Datum hinter den Titel', () => {
      const w = mount(LBitCapsule, {
        props: { bit: sized({ size: 1, snoozedUntil: later }), state: null },
      })
      expect(w.classes()).toContain('capsule--snoozed')
      expect(w.find('.capsule__meta').exists()).toBe(false)
      expect(w.find('.capsule__row .capsule__snooze').exists()).toBe(true)
    })

    it('snoozt nicht, wenn der Tag erreicht ist', () => {
      const w = mount(LBitCapsule, {
        props: { bit: sized({ snoozedUntil: todayKey() }), state: null },
      })
      expect(w.classes()).not.toContain('capsule--snoozed')
      expect(w.attributes('aria-label')).not.toContain('snoozed')
    })

    it('zeigt das Wiederholungs-Symbol bei wiederkehrenden Bits', () => {
      const w = mount(LBitCapsule, { props: { bit: sized({ recurrence: 'daily' }), state: null } })
      expect(w.find('.capsule__repeat').exists()).toBe(true)
      const none = mount(LBitCapsule, { props: { bit: sized({}), state: null } })
      expect(none.find('.capsule__repeat').exists()).toBe(false)
    })

    it('markiert einen laufenden Fokus mit eigener Klasse', () => {
      const on = mount(LBitCapsule, { props: { bit: sized({}), state: null, focusing: true } })
      expect(on.classes()).toContain('capsule--focusing')
      const off = mount(LBitCapsule, { props: { bit: sized({}), state: null } })
      expect(off.classes()).not.toContain('capsule--focusing')
    })

    // jsdom applies no scoped styles, so the geometry contract is read from the SFC source.
    // Arrows anchor CAPSULE_H / 2 below the capsule's outer top (useFlowLayout.anchor).
    it('hält die Titelzeile gestufter Kapseln auf Höhe des Pfeil-Ankers', () => {
      const rule = (selector: string) => {
        const at = capsuleSource.indexOf('\n' + selector + ' {')
        return capsuleSource.slice(at, capsuleSource.indexOf('}', at))
      }
      const px = (css: string, prop: string) =>
        parseInt(css.slice(css.indexOf(prop + ': ') + prop.length + 2), 10)
      const border = 1
      expect(rule('.capsule')).toMatch(/border: 1px/)
      // plain (S) row sits in the flex-centred 32px box
      expect(border + px(rule('.capsule__row'), 'height') / 2).toBe(CAPSULE_H / 2)
      // sized rows are pinned to the top, so their centre must land on the same line
      const sized = rule('.capsule--sized')
      expect(sized).toMatch(/justify-content: flex-start/)
      const rowHeight = px(rule('.capsule--sized .capsule__row'), 'height')
      expect(border + px(sized, 'padding-top') + rowHeight / 2).toBe(CAPSULE_H / 2)
    })

    describe('settle', () => {
      const original = window.matchMedia
      afterEach(() => {
        window.matchMedia = original
      })

      it('startet bei 1,04 und federt auf 1', () => {
        const w = mount(LBitCapsule, { props: { bit: sized({}), state: null } })
        settleOf(w)
        expect((w.element as HTMLElement).style.getPropertyValue('--settle')).toBe('1.04')
        w.unmount()
      })

      it('skaliert bei Reduced Motion nicht', () => {
        window.matchMedia = ((q: string) => ({
          matches: true,
          media: q,
        })) as typeof window.matchMedia
        const w = mount(LBitCapsule, { props: { bit: sized({}), state: null } })
        settleOf(w)
        expect((w.element as HTMLElement).style.getPropertyValue('--settle')).toBe('1')
      })
    })

    describe('materialize', () => {
      const original = window.matchMedia
      afterEach(() => {
        window.matchMedia = original
      })
      const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(null)))

      it('trägt die Klasse nur im ersten Frame und startet bei Skalierung 0,96', async () => {
        const w = mount(LBitCapsule, { props: { bit: sized({}), state: null, materialize: true } })
        expect(w.classes()).toContain('capsule--materialize')
        expect((w.element as HTMLElement).style.getPropertyValue('--settle')).toBe('0.96')
        await nextFrame()
        await w.vm.$nextTick()
        expect(w.classes()).not.toContain('capsule--materialize')
        w.unmount()
      })

      it('setzt die Deckkraft im ersten Frame auf 0,45', () => {
        expect(capsuleSource).toMatch(/\.capsule--materialize\s*\{[^}]*opacity: 0\.45/)
      })

      it('skaliert bei Reduced Motion nicht', () => {
        window.matchMedia = ((q: string) => ({
          matches: true,
          media: q,
        })) as typeof window.matchMedia
        const w = mount(LBitCapsule, { props: { bit: sized({}), state: null, materialize: true } })
        expect((w.element as HTMLElement).style.getPropertyValue('--settle')).not.toBe('0.96')
        w.unmount()
      })

      it('bleibt ohne materialize unverändert', () => {
        const w = mount(LBitCapsule, { props: { bit: sized({}), state: null } })
        expect(w.classes()).not.toContain('capsule--materialize')
        w.unmount()
      })
    })
  })
})

describe('LPacketStack', () => {
  const props = {
    packet: { id: '7', name: 'Release', x: 0, y: 0 },
    members: [bit('1', 2, 0), bit('2', 0, 1)],
    x: 10,
    y: 20,
    states: new Map(),
    cycleBitIds: new Set<string>(),
    summary: { total: 2, done: 1, inProgress: 0, blocked: 0, ready: 1, cycles: 0, percent: 50 },
    gapIndex: null,
  }

  it('reicht das Abhaken eines Schritts weiter', async () => {
    const w = mount(LPacketStack, { props })
    await w.findAll('.capsule__check')[1]!.trigger('click')
    expect(w.emitted('bitToggleDone')).toEqual([['2']])
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
    id: '4',
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
    expect(w.emitted('select')).toEqual([['4']])
    await w.setProps({ selectedId: '4' })
    await w.find('.dep__delete').trigger('click')
    expect(w.emitted('remove')).toEqual([['4']])
  })

  it('bedient Pfeile per Tastatur: Enter wählt, Delete entfernt', async () => {
    const w = mount(LDependencyLayer, { props: { items: [item], preview: null, selectedId: null } })
    await w.find('.dep__hit').trigger('keydown', { key: 'Enter' })
    expect(w.emitted('select')).toEqual([['4']])
    await w.find('.dep__hit').trigger('keydown', { key: 'Delete' })
    expect(w.emitted('remove')).toEqual([['4']])
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
    const w = mount(LDependencyLayer, { props: { items: [item], preview: null, selectedId: '4' } })
    await w.find('.dep__delete').trigger('keydown', { key: 'Enter' })
    expect(w.emitted('remove')).toEqual([['4']])
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
    id: '4',
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
    packet: { id: '7', name: 'Release', x: 0, y: 0 },
    members: [bit('1', 2, 0)],
    x: 0,
    y: 0,
    states: new Map(),
    cycleBitIds: new Set<string>(),
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
          props: { bit: bit('1'), state: null },
          attachTo: host,
        }),
    ],
    [
      'Kapsel-Griff',
      '.capsule__handle',
      (host) =>
        void mount(LBitCapsule, {
          props: { bit: bit('1'), state: null },
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
          props: { items: [depItem], preview: null, selectedId: '4' },
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
