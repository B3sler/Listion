import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import type { Bit } from '@/stores/bitStore'
import { dueToApi } from '@/helpers/localDate'
import LDetailChips from './LDetailChips.vue'
import LDetailFooter from './LDetailFooter.vue'

function bitWith(extra: Partial<Bit> = {}): Bit {
  return {
    id: 'b1',
    title: 'Steuer abgeben',
    status: 0,
    x: 0,
    y: 0,
    packetId: null,
    order: 0,
    createdAt: '2026-10-14T09:00:00.000Z',
    color: '#ef4444',
    ...extra,
  }
}

let host: HTMLElement
let wrapper: VueWrapper | null = null

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 16, 10, 0, 0))
  host = document.createElement('div')
  document.body.appendChild(host)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  host.remove()
  vi.useRealTimers()
})

describe('LDetailChips', () => {
  function mountChips(bit: Partial<Bit> = {}) {
    wrapper = mount(LDetailChips, {
      props: { bit: bitWith(bit), today: '2026-10-16', accent: '#ef4444' },
      attachTo: host,
    })
    return wrapper
  }

  const chip = (w: VueWrapper, name: string) => w.find(`[data-chip="${name}"]`)

  it('meldet eine Auswahl als set mit Patch und Verlaufs-Label', async () => {
    const w = mountChips()
    await chip(w, 'priority').find('.chip__btn').trigger('click')
    const high = chip(w, 'priority')
      .findAll('[role="radio"]')
      .find((r) => r.text() === '!!!')!
    await high.trigger('click')
    expect(w.emitted('set')).toEqual([[{ priority: 3 }, 'Priority']])
  })

  it('leert einen Chip über sein ×', async () => {
    const w = mountChips({ dueDate: dueToApi('2026-10-20') })
    await chip(w, 'due').find('.chip__clear').trigger('click')
    expect(w.emitted('set')).toEqual([[{ dueDate: null }, 'Due date']])
  })

  it('schließt über closeOpenChip eine offene Auswahl und meldet, ob eine offen war', async () => {
    const w = mountChips()
    const vm = w.vm as unknown as { closeOpenChip(): boolean }
    await chip(w, 'size').find('.chip__btn').trigger('click')
    expect(chip(w, 'size').find('.chip__btn').attributes('aria-expanded')).toBe('true')
    expect(vm.closeOpenChip()).toBe(true)
    await w.vm.$nextTick()
    expect(chip(w, 'size').find('.chip__btn').attributes('aria-expanded')).toBe('false')
    expect(vm.closeOpenChip()).toBe(false)
  })

  it('schließt die offene Auswahl, wenn ein anderes Bit kommt', async () => {
    const w = mountChips()
    await chip(w, 'repeat').find('.chip__btn').trigger('click')
    await w.setProps({ bit: bitWith({ id: 'b2' }) })
    expect(chip(w, 'repeat').find('.chip__btn').attributes('aria-expanded')).toBe('false')
  })
})

describe('LDetailFooter', () => {
  function mountFooter(props: Partial<InstanceType<typeof LDetailFooter>['$props']> = {}) {
    wrapper = mount(LDetailFooter, {
      props: { createdAt: '2026-10-14T09:00:00.000Z', saveState: 'idle', failed: false, ...props },
      attachTo: host,
    })
    return wrapper
  }

  it('zeigt das Anlagedatum und im Ruhezustand keinen Speicherstatus', () => {
    const w = mountFooter()
    expect(w.find('.detail__created').text()).toBe('Created 14 Oct')
    expect(w.find('.detail__save').text()).toBe('')
  })

  it('zeigt Saving… während gespeichert wird', () => {
    const w = mountFooter({ saveState: 'saving' })
    expect(w.find('.detail__save').text()).toBe('Saving…')
  })

  it.each([
    { saveState: 'error' as const, failed: false },
    { saveState: 'idle' as const, failed: true },
  ])('zeigt Couldn’t save mit Retry bei %o', async (props) => {
    const w = mountFooter(props)
    expect(w.find('.detail__save').text()).toContain('Couldn’t save')
    await w.find('.detail__retry').trigger('click')
    expect(w.emitted('retry')).toHaveLength(1)
  })

  it('meldet Delete', async () => {
    const w = mountFooter()
    await w.find('.detail__delete').trigger('click')
    expect(w.emitted('delete')).toHaveLength(1)
  })
})
