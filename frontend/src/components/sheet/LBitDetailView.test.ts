import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { useBitStore, type Bit } from '@/stores/bitStore'
import { useSheetStore } from '@/stores/sheetStore'
import { BIT_COMMANDS, type BitCommands } from '@/composables/useBitCommands'
import { dueToApi, todayKey } from '@/helpers/localDate'
import { firstDue } from '@/helpers/recurrence'
import LBitDetailView from './LBitDetailView.vue'
import LPropertyChip from './LPropertyChip.vue'

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
    notes: '',
    color: '#ef4444',
    ...extra,
  }
}

function mockCommands() {
  return {
    update: vi.fn<BitCommands['update']>().mockResolvedValue(undefined),
    complete: vi.fn<BitCommands['complete']>().mockResolvedValue({ rolledTo: null }),
    reopen: vi.fn<BitCommands['reopen']>().mockResolvedValue(undefined),
    remove: vi.fn<BitCommands['remove']>(),
    create: vi.fn<BitCommands['create']>(),
    removeDependency: vi.fn<BitCommands['removeDependency']>().mockResolvedValue(undefined),
  }
}

let pinia: Pinia
let commands: ReturnType<typeof mockCommands>
let host: HTMLElement
let wrapper: VueWrapper | null = null

function mountView(bit: Partial<Bit> = {}, props: { canGoBack?: boolean } = {}) {
  useBitStore().bits = [bitWith(bit)]
  wrapper = mount(LBitDetailView, {
    props: { bitId: 'b1', canGoBack: false, ...props },
    attachTo: host,
    global: { plugins: [pinia], provide: { [BIT_COMMANDS as symbol]: commands } },
  })
  return wrapper
}

function chip(w: VueWrapper, name: string) {
  const found = w.findAll('[data-chip]').find((c) => c.attributes('data-chip') === name)
  if (!found) throw new Error(`chip ${name} not found`)
  return found
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 16, 10, 0, 0))
  pinia = createPinia()
  setActivePinia(pinia)
  commands = mockCommands()
  host = document.createElement('div')
  document.body.appendChild(host)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  host.remove()
  vi.useRealTimers()
})

describe('LBitDetailView', () => {
  it('zeigt den Titel im Titelfeld und fokussiert ihn mit dem Cursor am Ende', async () => {
    const w = mountView()
    await vi.advanceTimersByTimeAsync(0)
    const title = w.find<HTMLTextAreaElement>('textarea.detail__title')
    expect(title.element.value).toBe('Steuer abgeben')
    expect(title.attributes('maxlength')).toBe('500')
    expect(document.activeElement).toBe(title.element)
    expect(title.element.selectionStart).toBe('Steuer abgeben'.length)
  })

  it('ruft beim Status-Segment Done commands.complete auf', async () => {
    const w = mountView()
    const status = w.find('[aria-label="Status"]')
    const done = status.findAll('[role="radio"]').find((r) => r.text() === 'Done')!
    await done.trigger('click')
    expect(commands.complete).toHaveBeenCalledWith('b1')
  })

  it('setzt In Progress per Update und öffnet ein erledigtes Bit per reopen', async () => {
    const w = mountView()
    const radios = w.find('[aria-label="Status"]').findAll('[role="radio"]')
    await radios.find((r) => r.text() === 'In Progress')!.trigger('click')
    expect(commands.update).toHaveBeenCalledWith('b1', { status: 1 }, { label: 'Status' })
    w.unmount()
    wrapper = null

    const w2 = mountView({ status: 2 })
    await w2
      .find('[aria-label="Status"]')
      .findAll('[role="radio"]')
      .find((r) => r.text() === 'Open')!
      .trigger('click')
    expect(commands.reopen).toHaveBeenCalledWith('b1')
  })

  it('öffnet mit dem Priorität-Chip die Auswahl, !!! sendet priority 3', async () => {
    const w = mountView()
    const priority = chip(w, 'priority')
    expect(priority.find('.chip__btn').attributes('aria-expanded')).toBe('false')
    await priority.find('.chip__btn').trigger('click')
    expect(priority.find('.chip__btn').attributes('aria-expanded')).toBe('true')
    const high = priority.findAll('[role="radio"]').find((r) => r.text() === '!!!')!
    await high.trigger('click')
    expect(commands.update).toHaveBeenCalledWith('b1', { priority: 3 }, { label: 'Priority' })
  })

  it('hat immer nur einen Chip offen', async () => {
    const w = mountView()
    await chip(w, 'priority').find('.chip__btn').trigger('click')
    await chip(w, 'size').find('.chip__btn').trigger('click')
    const expanded = w
      .findAllComponents(LPropertyChip)
      .filter((c) => c.props('expanded'))
      .map((c) => c.props('label'))
    expect(expanded).toEqual(['Size'])
    // a second tap closes it again
    await chip(w, 'size').find('.chip__btn').trigger('click')
    expect(w.findAllComponents(LPropertyChip).some((c) => c.props('expanded'))).toBe(false)
  })

  it('färbt den Fälligkeits-Chip rot, wenn das Bit überfällig ist', () => {
    const w = mountView({ dueDate: dueToApi('2026-10-12')! })
    const due = w.findAllComponents(LPropertyChip).find((c) => c.attributes('data-chip') === 'due')!
    expect(due.props('tone')).toBe('danger')
  })

  it('färbt den Fälligkeits-Chip nicht, wenn das Bit erledigt ist', () => {
    const w = mountView({ dueDate: dueToApi('2026-10-12')!, status: 2 })
    const due = w.findAllComponents(LPropertyChip).find((c) => c.attributes('data-chip') === 'due')!
    expect(due.props('tone')).toBe('default')
  })

  it('setzt die Fälligkeit per Schnellwahl und leert sie per × mit null', async () => {
    const w = mountView({ dueDate: dueToApi('2026-10-20')! })
    expect(chip(w, 'due').find('.chip__label').text()).toBe('Tue 20')
    await chip(w, 'due').find('.chip__btn').trigger('click')
    const tomorrow = chip(w, 'due')
      .findAll('.picker__quick')
      .find((b) => b.text() === 'Tomorrow')!
    await tomorrow.trigger('click')
    expect(commands.update).toHaveBeenCalledWith(
      'b1',
      { dueDate: dueToApi('2026-10-17') },
      { label: 'Due date' },
    )
    await chip(w, 'due').find('.chip__clear').trigger('click')
    expect(commands.update).toHaveBeenLastCalledWith('b1', { dueDate: null }, { label: 'Due date' })
  })

  it('setzt bei einer Wiederholung ohne Fälligkeit das erste Datum mit', async () => {
    const w = mountView()
    await chip(w, 'repeat').find('.chip__btn').trigger('click')
    const weekly = chip(w, 'repeat')
      .findAll('.picker__quick')
      .find((b) => b.text() === 'Weekly')!
    await weekly.trigger('click')
    expect(commands.update).toHaveBeenCalledWith(
      'b1',
      { recurrence: 'weekly', dueDate: dueToApi(firstDue('weekly', todayKey())) },
      { label: 'Repeat' },
    )
  })

  it('lässt eine vorhandene Fälligkeit bei einer Wiederholung stehen', async () => {
    const w = mountView({ dueDate: dueToApi('2026-10-20')! })
    await chip(w, 'repeat').find('.chip__btn').trigger('click')
    await chip(w, 'repeat')
      .findAll('.picker__quick')
      .find((b) => b.text() === 'Daily')!
      .trigger('click')
    expect(commands.update).toHaveBeenCalledWith('b1', { recurrence: 'daily' }, { label: 'Repeat' })
  })

  it('zeigt die Wiederholung mit Zähler erst ab einer Erledigung', () => {
    const w = mountView({ recurrence: 'weekly', completedCount: 0 })
    expect(chip(w, 'repeat').find('.chip__label').text()).toBe('Weekly')
    w.unmount()
    wrapper = null
    const w2 = mountView({ recurrence: 'weekly', completedCount: 12 })
    expect(chip(w2, 'repeat').find('.chip__label').text()).toBe('Weekly · 12×')
  })

  it('zeigt den Snooze-Chip mit until und weckt per × mit null', async () => {
    const w = mountView({ snoozedUntil: '2026-10-19' })
    expect(chip(w, 'snooze').find('.chip__label').text()).toBe('until Mon 19')
    await chip(w, 'snooze').find('.chip__clear').trigger('click')
    expect(commands.update).toHaveBeenCalledWith('b1', { snoozedUntil: null }, { label: 'Snooze' })
  })

  it('snoozt per Weekend bis zum nächsten Samstag als Datums-Schlüssel', async () => {
    const w = mountView()
    await chip(w, 'snooze').find('.chip__btn').trigger('click')
    await chip(w, 'snooze')
      .findAll('.picker__quick')
      .find((b) => b.text() === 'Weekend')!
      .trigger('click')
    expect(commands.update).toHaveBeenCalledWith(
      'b1',
      { snoozedUntil: '2026-10-17' },
      { label: 'Snooze' },
    )
  })

  it('zeigt am Aufwand-Chip den Richtwert', () => {
    const w = mountView({ size: 3 })
    expect(chip(w, 'size').find('.chip__label').text()).toBe('L · ≈ 3 h')
  })

  it('zeigt eine Farbe außerhalb der Palette als zusätzliches Feld vorn', async () => {
    const w = mountView({ color: '#123456' })
    await chip(w, 'color').find('.chip__btn').trigger('click')
    const swatches = chip(w, 'color').findAll('.swatch')
    expect(swatches).toHaveLength(13)
    expect(swatches[0]!.attributes('aria-label')).toBe('Custom #123456')
    expect(swatches[0]!.attributes('aria-pressed')).toBe('true')
    await swatches[2]!.trigger('click')
    expect(commands.update).toHaveBeenCalledWith('b1', { color: '#f97316' }, { label: 'Color' })
  })

  it('zeigt bei einer Palettenfarbe genau zwölf Felder', async () => {
    const w = mountView({ color: '#ef4444' })
    await chip(w, 'color').find('.chip__btn').trigger('click')
    expect(chip(w, 'color').findAll('.swatch')).toHaveLength(12)
  })

  it('zeigt im Footer das Erstelldatum', () => {
    const w = mountView()
    expect(w.find('.detail__created').text()).toBe('Created 14 Oct')
  })

  it('löscht per Delete ohne Bestätigung und schließt', async () => {
    const w = mountView()
    await w.find('.detail__delete').trigger('click')
    expect(commands.remove).toHaveBeenCalledWith('b1')
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('zeigt den Chevron zurück nur bei canGoBack', async () => {
    const w = mountView()
    expect(w.find('.detail__back').exists()).toBe(false)
    await w.setProps({ canGoBack: true })
    await w.find('.detail__back').trigger('click')
    expect(w.emitted('back')).toHaveLength(1)
  })

  it('schließt über ×', async () => {
    const w = mountView()
    await w.find('[aria-label="Close"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })

  describe('Abhaken-Geste', () => {
    it('hakt nach 600 ms Halten auf dem ◯ ab, ein Klick allein nicht', async () => {
      const w = mountView()
      await w.find('.hold').trigger('click')
      expect(commands.complete).not.toHaveBeenCalled()
      await w.find('.hold').trigger('pointerdown')
      await vi.advanceTimersByTimeAsync(599)
      expect(commands.complete).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      expect(commands.complete).toHaveBeenCalledTimes(1)
      expect(commands.complete).toHaveBeenCalledWith('b1')
    })

    it('hakt per Leertaste auf dem ◯ sofort ab', async () => {
      const w = mountView()
      await w.find('.hold').trigger('keydown', { key: ' ' })
      expect(commands.complete).toHaveBeenCalledWith('b1')
    })

    it('lässt die Capsule setteln und schließt das Sheet 350 ms nach dem Abhaken', async () => {
      const w = mountView()
      const sheet = useSheetStore()
      const settle = vi.spyOn(sheet, 'requestSettle')
      await w.find('.hold').trigger('keydown', { key: 'Enter' })
      expect(settle).toHaveBeenCalledWith('b1')
      await vi.advanceTimersByTimeAsync(349)
      expect(w.emitted('close')).toBeUndefined()
      await vi.advanceTimersByTimeAsync(1)
      expect(w.emitted('close')).toHaveLength(1)
    })

    it('schließt nicht, wenn das Abhaken scheitert, und bietet Retry an', async () => {
      commands.complete.mockRejectedValueOnce(new Error('offline'))
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const w = mountView()
      await w.find('.hold').trigger('keydown', { key: 'Enter' })
      await vi.advanceTimersByTimeAsync(1000)
      expect(w.emitted('close')).toBeUndefined()
      expect(w.find('.detail__save').text()).toContain('Couldn’t save')
      await w.find('.detail__retry').trigger('click')
      expect(commands.complete).toHaveBeenCalledTimes(2)
      await vi.advanceTimersByTimeAsync(400)
      expect(w.find('.detail__save').text()).toBe('')
      expect(w.emitted('close')).toHaveLength(1)
    })

    it('öffnet ein erledigtes Bit mit einem Klick wieder, ohne das Sheet zu schließen', async () => {
      const w = mountView({ status: 2 })
      await w.find('.hold').trigger('click')
      expect(commands.reopen).toHaveBeenCalledWith('b1')
      await vi.advanceTimersByTimeAsync(1000)
      expect(w.emitted('close')).toBeUndefined()
    })

    it('zeigt einen gescheiterten Reopen als Couldn’t save', async () => {
      commands.reopen.mockRejectedValueOnce(new Error('offline'))
      vi.spyOn(console, 'error').mockImplementation(() => undefined)
      const w = mountView({ status: 2 })
      await w.find('.hold').trigger('click')
      await vi.advanceTimersByTimeAsync(0)
      expect(w.find('.detail__save').text()).toContain('Couldn’t save')
    })

    it('schließt nicht mehr, wenn das Sheet vorher verlassen wurde', async () => {
      const w = mountView()
      await w.find('.hold').trigger('keydown', { key: 'Enter' })
      w.unmount()
      wrapper = null
      await vi.advanceTimersByTimeAsync(1000)
      expect(w.emitted('close')).toBeUndefined()
    })
  })

  it('speichert den Titel live nach 400 ms', async () => {
    const w = mountView()
    await w.find('textarea.detail__title').setValue('Steuer abgeben!')
    await vi.advanceTimersByTimeAsync(400)
    expect(commands.update).toHaveBeenCalledWith(
      'b1',
      { title: 'Steuer abgeben!' },
      expect.objectContaining({ coalesce: 'title' }),
    )
  })

  it('zeigt bei einem Fehler Couldn’t save mit Retry', async () => {
    commands.update.mockRejectedValueOnce(new Error('offline'))
    const w = mountView()
    await chip(w, 'priority').find('.chip__btn').trigger('click')
    await chip(w, 'priority')
      .findAll('[role="radio"]')
      .find((r) => r.text() === '!')!
      .trigger('click')
    await vi.advanceTimersByTimeAsync(0)
    expect(w.find('.detail__save').text()).toContain('Couldn’t save')
    await w.find('.detail__retry').trigger('click')
    expect(commands.update).toHaveBeenLastCalledWith('b1', { priority: 1 }, expect.anything())
  })
})
