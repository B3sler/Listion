import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn().mockResolvedValue({ data: {} }),
  put: vi.fn(),
  delete: vi.fn(),
}))
vi.mock('@/helpers/api', () => ({ default: api }))

import { useBitStore, type Bit } from '@/stores/bitStore'
import { useFocusStore } from '@/stores/focusStore'
import LFocusSection from './LFocusSection.vue'

const T0 = new Date(2026, 9, 16, 10, 0, 0).getTime()

function bitWith(extra: Partial<Bit> = {}): Bit {
  return {
    id: 'b1',
    title: 'Steuer abgeben',
    status: 0,
    x: 0,
    y: 0,
    packetId: null,
    order: 0,
    createdAt: '',
    ...extra,
  }
}

let wrapper: VueWrapper | null = null

function mountSection(extra: Partial<Bit> = {}) {
  const bit = bitWith(extra)
  useBitStore().bits = [bit]
  wrapper = mount(LFocusSection, { props: { bit } })
  return wrapper
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(T0)
  localStorage.clear()
  api.post.mockClear()
  setActivePinia(createPinia())
})

afterEach(() => {
  useFocusStore().cancel()
  wrapper?.unmount()
  wrapper = null
  vi.useRealTimers()
})

describe('LFocusSection', () => {
  it('nennt ohne Aufwand „No focus time yet“ und bietet ▶ an', () => {
    const w = mountSection()
    expect(w.text()).toContain('No focus time yet')
    expect(w.find('[aria-label="Start focus"]').exists()).toBe(true)
    expect(w.find('.focus__bar').exists()).toBe(false)
  })

  it('zeigt ohne Größe nur die Summe', () => {
    const w = mountSection({ focusSeconds: 4800 })
    expect(w.text()).toContain('1 h 20 m tracked')
    expect(w.find('.focus__bar').exists()).toBe(false)
  })

  it('schreibt Minuten ohne Stunden', () => {
    const w = mountSection({ focusSeconds: 2700 })
    expect(w.text()).toContain('45 m tracked')
  })

  it('▶ startet den Timer für das Bit und zeigt die laufende Zeit', async () => {
    const w = mountSection()
    await w.find('[aria-label="Start focus"]').trigger('click')
    expect(useFocusStore().running?.bitId).toBe('b1')
    vi.advanceTimersByTime(724_000)
    await w.vm.$nextTick()
    expect(w.find('.focus__clock').text()).toBe('12:04')
    expect(w.find('[aria-label="Stop focus"]').exists()).toBe(true)
  })

  it('zeigt ab einer Stunde Stunden in der Uhr', async () => {
    const w = mountSection()
    useFocusStore().start('b1')
    vi.advanceTimersByTime(4_324_000)
    await w.vm.$nextTick()
    expect(w.find('.focus__clock').text()).toBe('1:12:04')
  })

  it('■ stoppt und bucht', async () => {
    const w = mountSection()
    useFocusStore().start('b1')
    vi.advanceTimersByTime(65_000)
    await w.vm.$nextTick()
    await w.find('[aria-label="Stop focus"]').trigger('click')
    expect(api.post).toHaveBeenCalledWith('/api/bit/b1/focus', { seconds: 65 })
    await w.vm.$nextTick()
    expect(w.find('[aria-label="Start focus"]').exists()).toBe(true)
  })

  it('läuft ein Timer auf einem anderen Bit, ist hier ▶ zu sehen', async () => {
    const w = mountSection()
    useFocusStore().start('anderes')
    await w.vm.$nextTick()
    expect(w.find('.focus__clock').exists()).toBe(false)
    expect(w.find('[aria-label="Start focus"]').exists()).toBe(true)
  })

  it('zeigt mit Größe den Balken „<Summe> of ~<Richtwert>“', () => {
    const w = mountSection({ size: 3, focusSeconds: 4800 })
    expect(w.find('.focus__bar-label').text()).toBe('1 h 20 of ~3 h')
    expect(w.find('.focus__bar-fill').attributes('style')).toContain('width: 44.')
    expect(w.find('.focus__bar').classes()).not.toContain('focus__bar--over')
  })

  it('rechnet die laufende Zeit in den Balken ein', async () => {
    const w = mountSection({ size: 1, focusSeconds: 600 })
    useFocusStore().start('b1')
    vi.advanceTimersByTime(600_000)
    await w.vm.$nextTick()
    expect(w.find('.focus__bar-label').text()).toBe('20 m of ~30 m')
  })

  it('füllt den Balken über 100 % in der Warnfarbe und kappt die Breite', () => {
    const w = mountSection({ size: 1, focusSeconds: 3600 })
    expect(w.find('.focus__bar').classes()).toContain('focus__bar--over')
    expect(w.find('.focus__bar-fill').attributes('style')).toContain('width: 100%')
    expect(w.find('.focus__bar-label').text()).toBe('1 h of ~30 m')
  })
})
