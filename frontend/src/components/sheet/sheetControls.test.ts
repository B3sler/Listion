import { describe, it, expect } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import LSegmented from './LSegmented.vue'
import LMiniCalendar from './LMiniCalendar.vue'

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
