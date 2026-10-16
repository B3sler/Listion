import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import LSegmented from './LSegmented.vue'
import LMiniCalendar from './LMiniCalendar.vue'
import LPropertyChip from './LPropertyChip.vue'
import LDatePicker from './LDatePicker.vue'
import LQuickEntryInput from './LQuickEntryInput.vue'
import LHoldToComplete from './LHoldToComplete.vue'
import type { QuickEntry } from '@/helpers/quickEntry'
import { Calendar } from 'lucide-vue-next'

const sizes = [
  { value: 'S', label: 'S' },
  { value: 'M', label: 'M' },
  { value: 'L', label: 'L' },
  { value: 'XL', label: 'XL' },
]

function mountSegmented(modelValue: string | null = 'M', attachTo?: HTMLElement) {
  return mount(LSegmented, {
    props: { modelValue, options: sizes, ariaLabel: 'Size' },
    attachTo,
  })
}

describe('LSegmented', () => {
  it('ist eine Radiogroup mit beschrifteten Radios und aria-checked', () => {
    const w = mountSegmented('L')
    expect(w.attributes('role')).toBe('radiogroup')
    expect(w.attributes('aria-label')).toBe('Size')
    const radios = w.findAll('[role="radio"]')
    expect(radios).toHaveLength(4)
    expect(radios.map((r) => r.attributes('aria-checked'))).toEqual([
      'false',
      'false',
      'true',
      'false',
    ])
  })

  it('wählt per Klick auf das zweite Segment dessen Wert', async () => {
    const w = mountSegmented('S')
    await w.findAll('[role="radio"]')[1]!.trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([['M']])
  })

  it('hat genau ein Segment mit tabindex 0 (das gewählte)', () => {
    const w = mountSegmented('L')
    const tabindexes = w.findAll('[role="radio"]').map((r) => r.attributes('tabindex'))
    expect(tabindexes).toEqual(['-1', '-1', '0', '-1'])
  })

  it('fällt ohne Auswahl auf das erste Segment als Tab-Stopp zurück', () => {
    const w = mountSegmented(null)
    const tabindexes = w.findAll('[role="radio"]').map((r) => r.attributes('tabindex'))
    expect(tabindexes).toEqual(['0', '-1', '-1', '-1'])
  })

  it('springt mit ArrowRight vom letzten Segment zum ersten', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const w = mountSegmented('XL', host)
    await w.findAll('[role="radio"]')[3]!.trigger('keydown', { key: 'ArrowRight' })
    expect(w.emitted('update:modelValue')).toEqual([['S']])
    w.unmount()
    host.remove()
  })

  it('springt mit ArrowLeft vom ersten Segment zum letzten', async () => {
    const w = mountSegmented('S')
    await w.findAll('[role="radio"]')[0]!.trigger('keydown', { key: 'ArrowLeft' })
    expect(w.emitted('update:modelValue')).toEqual([['XL']])
  })

  it('verschiebt den Fokus mit dem Pfeil auf das neue Segment', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const w = mountSegmented('M', host)
    const radios = w.findAll('[role="radio"]')
    ;(radios[1]!.element as HTMLElement).focus()
    await radios[1]!.trigger('keydown', { key: 'ArrowRight' })
    expect(document.activeElement).toBe(radios[2]!.element)
    expect(w.emitted('update:modelValue')).toEqual([['L']])
    w.unmount()
    host.remove()
  })

  it('unterstützt null als Wert der ersten Option', async () => {
    const w = mount(LSegmented, {
      props: {
        modelValue: 2 as number | null,
        options: [
          { value: null, label: '—' },
          { value: 1, label: '!' },
          { value: 2, label: '!!' },
        ],
        ariaLabel: 'Priority',
      },
    })
    await w.findAll('[role="radio"]')[0]!.trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([[null]])
  })
})

describe('LMiniCalendar', () => {
  function mountCalendar(modelValue: string | null = null, today = '2026-10-16') {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const w = mount(LMiniCalendar, {
      props: { modelValue, today, accent: '#3b82f6' },
      attachTo: host,
    })
    return { w, host }
  }

  type Wrapper = ReturnType<typeof mountCalendar>['w']
  const monthLabel = (w: Wrapper) => w.find('.cal__title').text()
  const activeKey = () => (document.activeElement as HTMLElement).dataset.key

  it('ist ein Grid mit Wochenkopf Mo…Su und Monat samt Jahr im Kopf', () => {
    const { w, host } = mountCalendar()
    expect(w.find('[role="grid"]').exists()).toBe(true)
    expect(w.findAll('[role="columnheader"]').map((c) => c.text())).toEqual([
      'Mo',
      'Tu',
      'We',
      'Th',
      'Fr',
      'Sa',
      'Su',
    ])
    expect(monthLabel(w)).toBe('October 2026')
    expect(w.find('[aria-label="Previous month"]').exists()).toBe(true)
    expect(w.find('[aria-label="Next month"]').exists()).toBe(true)
    w.unmount()
    host.remove()
  })

  it('beginnt den Oktober 2026 an Position 3 (Do) mit drei Leerzellen davor', () => {
    const { w, host } = mountCalendar()
    const firstRow = w.findAll('[role="row"]').find((r) => r.find('button').exists())!
    const cells = firstRow.findAll('[role="gridcell"]')
    expect(cells).toHaveLength(7)
    expect(cells.slice(0, 3).every((c) => !c.find('button').exists())).toBe(true)
    expect(cells[3]!.find('button').attributes('data-key')).toBe('2026-10-01')
    expect(w.findAll('button[data-key]')).toHaveLength(31)
    w.unmount()
    host.remove()
  })

  it('emittiert beim Klick auf einen Tag dessen Schlüssel', async () => {
    const { w, host } = mountCalendar()
    await w.find('[data-key="2026-10-20"]').trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([['2026-10-20']])
    w.unmount()
    host.remove()
  })

  it('markiert heute mit aria-current und die Auswahl mit aria-selected', () => {
    const { w, host } = mountCalendar('2026-10-20')
    expect(w.find('[data-key="2026-10-16"]').attributes('aria-current')).toBe('date')
    expect(w.find('[data-key="2026-10-17"]').attributes('aria-current')).toBeUndefined()
    expect(w.find('[data-key="2026-10-20"]').attributes('aria-selected')).toBe('true')
    expect(w.find('[data-key="2026-10-16"]').attributes('aria-selected')).toBe('false')
    w.unmount()
    host.remove()
  })

  it('startet im Monat der Auswahl, sonst im Monat von heute', () => {
    const a = mountCalendar('2026-12-24')
    expect(monthLabel(a.w)).toBe('December 2026')
    a.w.unmount()
    a.host.remove()
    const b = mountCalendar(null, '2027-02-03')
    expect(monthLabel(b.w)).toBe('February 2027')
    b.w.unmount()
    b.host.remove()
  })

  it('hat genau einen Tag mit tabindex 0 (die Auswahl, sonst heute)', () => {
    const stops = (w: Wrapper) =>
      w.findAll('button[data-key][tabindex="0"]').map((b) => b.attributes('data-key'))
    const a = mountCalendar('2026-10-20')
    expect(stops(a.w)).toEqual(['2026-10-20'])
    a.w.unmount()
    a.host.remove()
    const b = mountCalendar(null)
    expect(stops(b.w)).toEqual(['2026-10-16'])
    b.w.unmount()
    b.host.remove()
  })

  it('blättert mit den Monatspfeilen vor und zurück', async () => {
    const { w, host } = mountCalendar()
    await w.find('[aria-label="Next month"]').trigger('click')
    expect(monthLabel(w)).toBe('November 2026')
    await w.find('[aria-label="Previous month"]').trigger('click')
    await w.find('[aria-label="Previous month"]').trigger('click')
    expect(monthLabel(w)).toBe('September 2026')
    expect(w.findAll('button[data-key][tabindex="0"]')).toHaveLength(1)
    w.unmount()
    host.remove()
  })

  it('zeigt mit PageDown den November und mit PageUp wieder den Oktober', async () => {
    const { w, host } = mountCalendar()
    const day = w.find('[data-key="2026-10-16"]')
    ;(day.element as HTMLElement).focus()
    await day.trigger('keydown', { key: 'PageDown' })
    await nextTick()
    expect(monthLabel(w)).toBe('November 2026')
    expect(activeKey()).toBe('2026-11-16')
    await w.find('[data-key="2026-11-16"]').trigger('keydown', { key: 'PageUp' })
    await nextTick()
    expect(monthLabel(w)).toBe('October 2026')
    expect(activeKey()).toBe('2026-10-16')
    w.unmount()
    host.remove()
  })

  it('kürzt den Tag bei PageDown auf das Monatsende', async () => {
    const { w, host } = mountCalendar('2026-01-31', '2026-01-31')
    const day = w.find('[data-key="2026-01-31"]')
    ;(day.element as HTMLElement).focus()
    await day.trigger('keydown', { key: 'PageDown' })
    await nextTick()
    expect(monthLabel(w)).toBe('February 2026')
    expect(activeKey()).toBe('2026-02-28')
    w.unmount()
    host.remove()
  })

  it('bewegt den Fokus mit den Pfeiltasten um einen Tag bzw. eine Woche', async () => {
    const { w, host } = mountCalendar()
    const day = w.find('[data-key="2026-10-16"]')
    ;(day.element as HTMLElement).focus()
    await day.trigger('keydown', { key: 'ArrowRight' })
    await nextTick()
    expect(activeKey()).toBe('2026-10-17')
    await w.find('[data-key="2026-10-17"]').trigger('keydown', { key: 'ArrowDown' })
    await nextTick()
    expect(activeKey()).toBe('2026-10-24')
    await w.find('[data-key="2026-10-24"]').trigger('keydown', { key: 'ArrowUp' })
    await nextTick()
    expect(activeKey()).toBe('2026-10-17')
    await w.find('[data-key="2026-10-17"]').trigger('keydown', { key: 'ArrowLeft' })
    await nextTick()
    expect(activeKey()).toBe('2026-10-16')
    w.unmount()
    host.remove()
  })

  it('landet vom 31.10. mit ArrowRight auf dem 1.11. und blättert um', async () => {
    const { w, host } = mountCalendar('2026-10-31')
    const day = w.find('[data-key="2026-10-31"]')
    ;(day.element as HTMLElement).focus()
    await day.trigger('keydown', { key: 'ArrowRight' })
    await nextTick()
    expect(monthLabel(w)).toBe('November 2026')
    expect(activeKey()).toBe('2026-11-01')
    w.unmount()
    host.remove()
  })

  it('wählt mit Enter den aktiven Tag genau einmal', async () => {
    const { w, host } = mountCalendar()
    const day = w.find('[data-key="2026-10-16"]')
    ;(day.element as HTMLElement).focus()
    await day.trigger('keydown', { key: 'ArrowRight' })
    await nextTick()
    await w.find('[data-key="2026-10-17"]').trigger('keydown', { key: 'Enter' })
    expect(w.emitted('update:modelValue')).toEqual([['2026-10-17']])
    w.unmount()
    host.remove()
  })

  it('folgt einer von außen geänderten Auswahl in deren Monat', async () => {
    const { w, host } = mountCalendar('2026-10-20')
    await w.setProps({ modelValue: '2027-01-05' })
    expect(monthLabel(w)).toBe('January 2027')
    expect(w.find('[data-key="2027-01-05"]').attributes('aria-selected')).toBe('true')
    w.unmount()
    host.remove()
  })

  it('setzt die Akzentfarbe als CSS-Variable', () => {
    const { w, host } = mountCalendar()
    expect((w.element as HTMLElement).style.getPropertyValue('--cal-accent')).toBe('#3b82f6')
    w.unmount()
    host.remove()
  })
})

describe('LPropertyChip', () => {
  function mountChip(props: Partial<InstanceType<typeof LPropertyChip>['$props']> = {}) {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const w = mount(LPropertyChip, {
      props: { icon: Calendar, label: 'Due', set: true, expanded: false, ...props },
      slots: { default: '<p class="picker">Auswahl</p>' },
      attachTo: host,
    })
    return { w, host }
  }

  it('rendert den Slot nicht, solange der Chip eingeklappt ist', () => {
    const { w, host } = mountChip({ expanded: false })
    expect(w.find('.picker').exists()).toBe(false)
    expect(w.find('.chip__btn').attributes('aria-expanded')).toBe('false')
    w.unmount()
    host.remove()
  })

  it('rendert den Slot im aufgeklappten Zustand und verknüpft ihn per aria-controls', () => {
    const { w, host } = mountChip({ expanded: true })
    expect(w.find('.picker').exists()).toBe(true)
    const btn = w.find('.chip__btn')
    expect(btn.attributes('aria-expanded')).toBe('true')
    const region = w.find('.chip__region')
    expect(region.attributes('id')).toBeTruthy()
    expect(btn.attributes('aria-controls')).toBe(region.attributes('id'))
    w.unmount()
    host.remove()
  })

  it('emittiert beim Klick auf den Chip toggle', async () => {
    const { w, host } = mountChip()
    await w.find('.chip__btn').trigger('click')
    expect(w.emitted('toggle')).toHaveLength(1)
    w.unmount()
    host.remove()
  })

  it('emittiert beim Klick auf das × clear, ohne toggle', async () => {
    const { w, host } = mountChip({ set: true })
    await w.find('[aria-label="Clear Due"]').trigger('click')
    expect(w.emitted('clear')).toHaveLength(1)
    expect(w.emitted('toggle')).toBeUndefined()
    w.unmount()
    host.remove()
  })

  it('zeigt das × nur, wenn ein Wert gesetzt ist', () => {
    const { w, host } = mountChip({ set: false })
    expect(w.find('[aria-label="Clear Due"]').exists()).toBe(false)
    expect(w.find('.chip').classes()).not.toContain('chip--set')
    w.unmount()
    host.remove()
  })

  it('setzt bei tone="danger" die Klasse chip--danger', () => {
    const { w, host } = mountChip({ tone: 'danger' })
    expect(w.find('.chip').classes()).toContain('chip--danger')
    w.unmount()
    host.remove()
  })

  describe('bei reduzierter Bewegung', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('hängt den Slot beim Einklappen aus und beim Aufklappen ein', async () => {
      vi.stubGlobal(
        'matchMedia',
        vi.fn(() => ({ matches: true })),
      )
      const { w, host } = mountChip({ expanded: true })
      expect(w.find('.picker').exists()).toBe(true)
      await w.setProps({ expanded: false })
      await nextTick()
      expect(w.find('.picker').exists()).toBe(false)
      await w.setProps({ expanded: true })
      await nextTick()
      expect(w.find('.picker').exists()).toBe(true)
      w.unmount()
      host.remove()
    })
  })

  it('emittiert bei Esc in der Auswahl toggle und fokussiert den Chip', async () => {
    const { w, host } = mountChip({ expanded: true })
    await w.find('.picker').trigger('keydown', { key: 'Escape' })
    expect(w.emitted('toggle')).toHaveLength(1)
    expect(document.activeElement).toBe(w.find('.chip__btn').element)
    w.unmount()
    host.remove()
  })
})

describe('LDatePicker', () => {
  const quick = [
    { label: 'Today', key: '2026-10-16' },
    { label: 'Tomorrow', key: '2026-10-17' },
    { label: 'None', key: null },
  ]

  function mountPicker(modelValue: string | null = null) {
    return mount(LDatePicker, {
      props: { modelValue, today: '2026-10-16', accent: '#3b82f6', quick },
    })
  }

  it('emittiert für die Schnellwahl None den Wert null', async () => {
    const w = mountPicker('2026-10-20')
    const none = w.findAll('.picker__quick').find((b) => b.text() === 'None')!
    await none.trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([[null]])
  })

  it('emittiert für die Schnellwahl Tomorrow deren Schlüssel', async () => {
    const w = mountPicker()
    const tomorrow = w.findAll('.picker__quick').find((b) => b.text() === 'Tomorrow')!
    await tomorrow.trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([['2026-10-17']])
  })

  it('markiert die zum Wert passende Schnellwahl mit aria-pressed', () => {
    const w = mountPicker('2026-10-17')
    const pressed = w.findAll('.picker__quick').map((b) => b.attributes('aria-pressed'))
    expect(pressed).toEqual(['false', 'true', 'false'])
  })

  it('reicht eine Kalenderauswahl als update:modelValue durch', async () => {
    const w = mountPicker()
    await w.find('[data-key="2026-10-20"]').trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([['2026-10-20']])
  })
})

describe('LQuickEntryInput', () => {
  const entry = (tokens: QuickEntry['tokens'], title = 'X'): QuickEntry => ({ title, tokens })

  function mountInput(modelValue: string, tokens: QuickEntry['tokens'] = []) {
    return mount(LQuickEntryInput, { props: { modelValue, entry: entry(tokens) } })
  }

  it('markiert im Spiegel das erkannte Token mit seiner Art', () => {
    const w = mountInput('X morgen', [{ start: 2, end: 8, kind: 'due' }])
    const mark = w.find('.qe__mirror mark.qe__token--due')
    expect(mark.exists()).toBe(true)
    expect(mark.text()).toBe('morgen')
  })

  it('spiegelt den gesamten Text, auch Teile ohne Token', () => {
    const w = mountInput('X morgen !!', [
      { start: 2, end: 8, kind: 'due' },
      { start: 9, end: 11, kind: 'priority' },
    ])
    expect(w.find('.qe__mirror').element.textContent).toBe('X morgen !!')
    expect(w.findAll('.qe__mirror mark')).toHaveLength(2)
    expect(w.find('.qe__token--priority').text()).toBe('!!')
  })

  it('sortiert Token nach ihrem Beginn, bevor sie gerendert werden', () => {
    const w = mountInput('a b', [
      { start: 2, end: 3, kind: 'size' },
      { start: 0, end: 1, kind: 'color' },
    ])
    expect(w.find('.qe__mirror').text()).toBe('a b')
    expect(w.findAll('.qe__mirror mark').map((m) => m.text())).toEqual(['a', 'b'])
  })

  it('blendet den Spiegel für Hilfstechnik aus', () => {
    const w = mountInput('X')
    expect(w.find('.qe__mirror').attributes('aria-hidden')).toBe('true')
  })

  it('emittiert update:modelValue bei Eingabe', async () => {
    const w = mountInput('')
    await w.find('input.qe__input').setValue('Neu')
    expect(w.emitted('update:modelValue')).toEqual([['Neu']])
  })

  it('emittiert bei Enter submit ohne Details', async () => {
    const w = mountInput('X')
    await w.find('input').trigger('keydown', { key: 'Enter' })
    expect(w.emitted('submit')).toEqual([[{ details: false }]])
  })

  it('emittiert bei Strg+Enter und Cmd+Enter submit mit Details', async () => {
    const w = mountInput('X')
    await w.find('input').trigger('keydown', { key: 'Enter', ctrlKey: true })
    await w.find('input').trigger('keydown', { key: 'Enter', metaKey: true })
    expect(w.emitted('submit')).toEqual([[{ details: true }], [{ details: true }]])
  })

  it('verhindert die Standardaktion von Enter', async () => {
    const w = mountInput('X')
    const ev = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true })
    w.find('input').element.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
  })

  it('ignoriert Enter während einer IME-Komposition', async () => {
    const w = mountInput('X')
    await w.find('input').trigger('keydown', { key: 'Enter', isComposing: true })
    expect(w.emitted('submit')).toBeUndefined()
  })

  it('synchronisiert die Scroll-Position des Spiegels mit dem Input', async () => {
    const w = mountInput('X')
    const input = w.find('input').element
    const mirror = w.find('.qe__mirror').element
    Object.defineProperty(input, 'scrollLeft', { value: 42, configurable: true })
    let synced = 0
    Object.defineProperty(mirror, 'scrollLeft', {
      get: () => synced,
      set: (v: number) => {
        synced = v
      },
      configurable: true,
    })
    await w.find('input').trigger('scroll')
    expect(synced).toBe(42)
  })

  it('reicht den Platzhalter an den Input durch', () => {
    const w = mount(LQuickEntryInput, {
      props: { modelValue: '', entry: entry([]), placeholder: 'New bit' },
    })
    expect(w.find('input').attributes('placeholder')).toBe('New bit')
  })

  it('beschriftet den Input mit „New bit title“ oder dem übergebenen ariaLabel', () => {
    expect(mountInput('').find('input').attributes('aria-label')).toBe('New bit title')
    const w = mount(LQuickEntryInput, {
      props: { modelValue: '', entry: entry([]), ariaLabel: 'Next bit' },
    })
    expect(w.find('input').attributes('aria-label')).toBe('Next bit')
  })
})

describe('LHoldToComplete', () => {
  const vibrate = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    vibrate.mockClear()
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    Reflect.deleteProperty(navigator, 'vibrate')
  })

  function mountHold(props: { done?: boolean; color?: string } = {}) {
    return mount(LHoldToComplete, { props: { done: false, color: '#ef4444', ...props } })
  }

  /** Scale of the check mark, read back from its inline transform. */
  function checkScale(w: ReturnType<typeof mountHold>): number {
    const match = /scale\(([\d.]+)\)/.exec(w.find('.hold__check').attributes('style') ?? '')
    return match ? Number(match[1]) : NaN
  }

  /** Fill of the ring, 0 … 1, read back from the SVG stroke. */
  function fill(w: ReturnType<typeof mountHold>): number {
    const ring = w.find('.hold__ring')
    const total = Number(ring.attributes('stroke-dasharray'))
    return 1 - Number(ring.attributes('stroke-dashoffset')) / total
  }

  it('hakt nicht ab, wenn vor 600 ms losgelassen wird', async () => {
    const w = mountHold()
    await w.find('button').trigger('pointerdown')
    await vi.advanceTimersByTimeAsync(599)
    await w.find('button').trigger('pointerup')
    await vi.advanceTimersByTimeAsync(2000)
    expect(w.emitted('complete')).toBeUndefined()
    expect(vibrate).not.toHaveBeenCalled()
  })

  it('hakt nach 600 ms Halten genau einmal ab und vibriert mit 10', async () => {
    const w = mountHold()
    await w.find('button').trigger('pointerdown')
    await vi.advanceTimersByTimeAsync(600)
    expect(w.emitted('complete')).toHaveLength(1)
    expect(vibrate).toHaveBeenCalledWith(10)
    await w.find('button').trigger('pointerup')
    await w.find('button').trigger('click')
    await vi.advanceTimersByTimeAsync(2000)
    expect(w.emitted('complete')).toHaveLength(1)
    expect(w.emitted('reopen')).toBeUndefined()
  })

  it('füllt den Ring linear mit der Haltezeit', async () => {
    const w = mountHold()
    expect(fill(w)).toBe(0)
    await w.find('button').trigger('pointerdown')
    await vi.advanceTimersByTimeAsync(300)
    expect(fill(w)).toBeGreaterThan(0.4)
    expect(fill(w)).toBeLessThan(0.55)
  })

  it('federt den Ring beim frühen Loslassen auf 0 zurück', async () => {
    const w = mountHold()
    await w.find('button').trigger('pointerdown')
    await vi.advanceTimersByTimeAsync(400)
    const held = fill(w)
    expect(held).toBeGreaterThan(0.5)
    await w.find('button').trigger('pointerup')
    await vi.advanceTimersByTimeAsync(100)
    expect(fill(w)).toBeLessThan(held)
    await vi.advanceTimersByTimeAsync(1500)
    expect(fill(w)).toBe(0)
  })

  it('macht beim erneuten Drücken vom aktuellen Ringstand weiter', async () => {
    const w = mountHold()
    await w.find('button').trigger('pointerdown')
    await vi.advanceTimersByTimeAsync(400)
    await w.find('button').trigger('pointerup')
    await vi.advanceTimersByTimeAsync(50)
    const mid = fill(w)
    expect(mid).toBeGreaterThan(0)
    await w.find('button').trigger('pointerdown')
    await vi.advanceTimersByTimeAsync(100)
    expect(fill(w)).toBeGreaterThan(mid)
  })

  it('zeigt nach einem Druck unter 200 ms 1,5 s lang den Tooltip', async () => {
    const w = mountHold()
    expect(w.find('[role="tooltip"]').exists()).toBe(false)
    await w.find('button').trigger('pointerdown')
    await vi.advanceTimersByTimeAsync(100)
    await w.find('button').trigger('pointerup')
    const tip = w.find('[role="tooltip"]')
    expect(tip.exists()).toBe(true)
    expect(tip.text()).toBe('Hold to complete')
    expect(w.find('button').attributes('aria-describedby')).toBe(tip.attributes('id'))
    await vi.advanceTimersByTimeAsync(1499)
    expect(w.find('[role="tooltip"]').exists()).toBe(true)
    await vi.advanceTimersByTimeAsync(1)
    expect(w.find('[role="tooltip"]').exists()).toBe(false)
    expect(w.find('button').attributes('aria-describedby')).toBeUndefined()
  })

  it('zeigt nach einem längeren, abgebrochenen Druck keinen Tooltip', async () => {
    const w = mountHold()
    await w.find('button').trigger('pointerdown')
    await vi.advanceTimersByTimeAsync(300)
    await w.find('button').trigger('pointerup')
    expect(w.find('[role="tooltip"]').exists()).toBe(false)
  })

  it('hakt per Leertaste und Enter sofort ab', async () => {
    const w = mountHold()
    await w.find('button').trigger('keydown', { key: ' ' })
    expect(w.emitted('complete')).toHaveLength(1)
    expect(vibrate).toHaveBeenCalledWith(10)
    const w2 = mountHold()
    await w2.find('button').trigger('keydown', { key: 'Enter' })
    expect(w2.emitted('complete')).toHaveLength(1)
  })

  it('öffnet ein erledigtes Bit mit einem normalen Klick wieder', async () => {
    const w = mountHold({ done: true })
    await w.find('button').trigger('click')
    expect(w.emitted('reopen')).toHaveLength(1)
    expect(w.emitted('complete')).toBeUndefined()
  })

  it('startet bei einem erledigten Bit keinen Haltevorgang', async () => {
    const w = mountHold({ done: true })
    await w.find('button').trigger('pointerdown')
    await vi.advanceTimersByTimeAsync(1000)
    expect(w.emitted('complete')).toBeUndefined()
  })

  it('ignoriert einen Klick ohne Halten bei einem offenen Bit', async () => {
    const w = mountHold()
    await w.find('button').trigger('click')
    expect(w.emitted('complete')).toBeUndefined()
    expect(w.emitted('reopen')).toBeUndefined()
  })

  it('lässt den Haken beim Erledigen mit Überschwingen einspringen', async () => {
    const w = mountHold()
    const scale = () => checkScale(w)
    expect(scale()).toBe(0)
    await w.setProps({ done: true })
    let peak = 0
    for (let i = 0; i < 60; i++) {
      await vi.advanceTimersByTimeAsync(16)
      peak = Math.max(peak, scale())
    }
    expect(peak).toBeGreaterThan(1)
    expect(scale()).toBe(1)
  })

  it('zeigt bei Reduced Motion den Haken ohne Überschwingen', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduced-motion') }))
    const w = mountHold()
    await w.setProps({ done: true })
    await vi.advanceTimersByTimeAsync(16)
    expect(checkScale(w)).toBe(1)
  })

  it('zeigt ein bereits erledigtes Bit sofort mit Haken und vollem Ring', () => {
    const w = mountHold({ done: true })
    expect(checkScale(w)).toBe(1)
    expect(fill(w)).toBe(1)
    expect(w.find('button').attributes('aria-pressed')).toBe('true')
  })

  it('färbt den Ring mit der übergebenen Farbe', () => {
    const w = mountHold({ color: '#22c55e' })
    expect(w.find('button').attributes('style')).toContain('#22c55e')
  })
})
