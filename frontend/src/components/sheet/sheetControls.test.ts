import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import LSegmented from './LSegmented.vue'

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
