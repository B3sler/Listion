import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { useBitStore, type Bit } from '@/stores/bitStore'
import { useSheetStore } from '@/stores/sheetStore'
import { useToolStore } from '@/stores/toolStore'
import { useDependencyStore } from '@/stores/dependencyStore'
import { BIT_COMMANDS, type BitCommands, type CreateFields } from '@/composables/useBitCommands'
import { CAPSULE_H, CAPSULE_W } from '@/composables/useFlowLayout'
import { DEFAULT_COLOR } from '@/helpers/palette'
import { addDays, dueToApi, todayKey } from '@/helpers/localDate'
import LBitSheet from './LBitSheet.vue'

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

let created = 0

function mockCommands() {
  return {
    update: vi.fn<BitCommands['update']>().mockResolvedValue(undefined),
    complete: vi.fn<BitCommands['complete']>().mockResolvedValue({ rolledTo: null }),
    reopen: vi.fn<BitCommands['reopen']>().mockResolvedValue(undefined),
    remove: vi.fn<BitCommands['remove']>(),
    // like the store: the bit is there at once, the promise resolves with it
    create: vi.fn<BitCommands['create']>((fields: CreateFields, pos) => {
      const bit = bitWith({ ...fields, ...pos, id: fields.id ?? `n${++created}` })
      useBitStore().bits.push(bit)
      return Promise.resolve(bit)
    }),
    removeDependency: vi.fn<BitCommands['removeDependency']>().mockResolvedValue(undefined),
  }
}

let pinia: Pinia
let commands: ReturnType<typeof mockCommands>
let host: HTMLElement
let wrapper: VueWrapper | null = null

function mountSheet() {
  wrapper = mount(LBitSheet, {
    attachTo: host,
    global: { plugins: [pinia], provide: { [BIT_COMMANDS as symbol]: commands } },
  })
  return wrapper
}

const flush = () => new Promise((r) => setTimeout(r, 0))

/** The client id the capture view gave the n-th created bit. */
const createdId = (n: number) => commands.create.mock.calls[n]![0].id

function press(el: Element | Window, key: string, extra: KeyboardEventInit = {}) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...extra }))
}

beforeEach(() => {
  created = 0
  pinia = createPinia()
  setActivePinia(pinia)
  commands = mockCommands()
  host = document.createElement('div')
  document.body.appendChild(host)
  // reduced motion: the spring settles at once, so open/close are synchronous
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduced-motion') }))
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  host.remove()
  vi.unstubAllGlobals()
})

describe('LBitSheet', () => {
  it('bleibt geschlossen, bis der Store es öffnet', async () => {
    const w = mountSheet()
    expect(w.find('[role="dialog"]').exists()).toBe(false)
    expect(useSheetStore().revealed).toBe(0)

    useSheetStore().openCapture({ x: 100, y: 200 }, null)
    await w.vm.$nextTick()
    const dialog = w.find('[role="dialog"]')
    expect(dialog.attributes('aria-modal')).toBe('false')
    expect(dialog.attributes('aria-label')).toBe('New Bits')
    expect(useSheetStore().revealed).toBe(320)
  })

  it('legt per Enter am Klickpunkt mit flowId an und leert die Eingabe', async () => {
    const w = mountSheet()
    useSheetStore().openCapture({ x: 100, y: 200 }, 'f1')
    await w.vm.$nextTick()
    const input = w.find<HTMLInputElement>('.capture input')
    expect(document.activeElement).toBe(input.element)

    await input.setValue('  Steuer  ')
    await input.trigger('keydown', { key: 'Enter' })
    expect(commands.create).toHaveBeenCalledWith(
      { id: expect.any(String), title: 'Steuer', color: DEFAULT_COLOR },
      { x: 100 - CAPSULE_W / 2, y: 200 - CAPSULE_H / 2 },
      'f1',
    )
    expect(input.element.value).toBe('')
    await flush()
    expect(useSheetStore().series).toEqual([{ id: createdId(0), failed: false }])
    expect(w.find('.capture__row').text()).toContain('Steuer')
    // still capturing: the next bit can be typed right away
    expect(useSheetStore().view).toBe('capture')
  })

  it('tut bei einem leeren Enter nichts', async () => {
    const w = mountSheet()
    useSheetStore().openCapture({ x: 0, y: 0 }, null)
    await w.vm.$nextTick()
    const input = w.find('.capture input')
    await input.setValue('   ')
    await input.trigger('keydown', { key: 'Enter' })
    expect(commands.create).not.toHaveBeenCalled()
  })

  it('öffnet per Strg+Enter bzw. ⌘+Enter das neue Bit im Detail', async () => {
    const w = mountSheet()
    const sheet = useSheetStore()
    sheet.openCapture({ x: 0, y: 0 }, null)
    await w.vm.$nextTick()
    await w.find('.capture input').setValue('A')
    await w.find('.capture input').trigger('keydown', { key: 'Enter', ctrlKey: true })
    // at once: the bit is on the canvas before the server answers
    expect(sheet.view).toBe('detail')
    expect(sheet.bitId).toBe(createdId(0))
    expect(w.find('[role="dialog"]').attributes('aria-label')).toBe('Bit: A')

    sheet.backToCapture()
    await w.vm.$nextTick()
    await w.find('.capture input').setValue('B')
    await w.find('.capture input').trigger('keydown', { key: 'Enter', metaKey: true })
    expect(sheet.bitId).toBe(createdId(1))
  })

  it('öffnet per Klick auf eine Zeile der Serie die Detail-Ansicht, ‹ New Bits führt zurück', async () => {
    const w = mountSheet()
    const sheet = useSheetStore()
    sheet.openCapture({ x: 0, y: 0 }, null)
    await w.vm.$nextTick()
    for (const t of ['A', 'B']) {
      await w.find('.capture input').setValue(t)
      await w.find('.capture input').trigger('keydown', { key: 'Enter' })
      await flush()
    }
    const rows = w.findAll('.capture__row')
    expect(rows.map((r) => r.text())).toEqual(['A', 'B'])
    await rows[0]!.trigger('click')
    expect(sheet.view).toBe('detail')
    expect(sheet.bitId).toBe(createdId(0))

    await w.find('.detail__back').trigger('click')
    expect(sheet.view).toBe('capture')
    expect(w.findAll('.capture__row')).toHaveLength(2)
  })

  it('leert die Serie bei jedem neuen Öffnen der Capture-Ansicht', async () => {
    const w = mountSheet()
    const sheet = useSheetStore()
    sheet.openCapture({ x: 0, y: 0 }, null)
    await w.vm.$nextTick()
    await w.find('.capture input').setValue('A')
    await w.find('.capture input').trigger('keydown', { key: 'Enter' })
    await flush()
    expect(sheet.series).toHaveLength(1)
    sheet.openCapture({ x: 50, y: 50 }, null)
    expect(sheet.series).toEqual([])
  })

  it('schließt über das × der Capture-Ansicht', async () => {
    const w = mountSheet()
    useSheetStore().openCapture({ x: 0, y: 0 }, null)
    await w.vm.$nextTick()
    await w.find('.capture [aria-label="Close"]').trigger('click')
    expect(useSheetStore().open).toBe(false)
    expect(useSheetStore().revealed).toBe(0)
    expect(w.find('[role="dialog"]').exists()).toBe(false)
  })

  it('schließt mit Esc zuerst einen offenen Chip, erst dann das Sheet', async () => {
    useBitStore().bits = [bitWith()]
    const w = mountSheet()
    const sheet = useSheetStore()
    sheet.openDetail('b1')
    await w.vm.$nextTick()
    const chipBtn = w.find('[data-chip="priority"] .chip__btn')
    await chipBtn.trigger('click')
    ;(chipBtn.element as HTMLElement).focus()
    expect(chipBtn.attributes('aria-expanded')).toBe('true')

    press(chipBtn.element, 'Escape')
    await w.vm.$nextTick()
    expect(chipBtn.attributes('aria-expanded')).toBe('false')
    expect(sheet.open).toBe(true)

    press(chipBtn.element, 'Escape')
    await w.vm.$nextTick()
    expect(sheet.open).toBe(false)
  })

  it('schließt per Esc auch, wenn der Fokus außerhalb liegt, nicht aber im Flow-Werkzeug', async () => {
    useBitStore().bits = [bitWith()]
    const w = mountSheet()
    const sheet = useSheetStore()
    sheet.openDetail('b1')
    await w.vm.$nextTick()
    ;(document.activeElement as HTMLElement | null)?.blur()

    useToolStore().setTool('flow')
    press(document.body, 'Escape')
    expect(sheet.open).toBe(true)

    useToolStore().setTool('select')
    press(document.body, 'Escape')
    expect(sheet.open).toBe(false)
  })

  it('zeigt die Detail-Ansicht mit dem Titel und wechselt ohne erneutes Einfahren zu einem anderen Bit', async () => {
    useBitStore().bits = [bitWith(), bitWith({ id: 'b2', title: 'Belege scannen' })]
    const w = mountSheet()
    const sheet = useSheetStore()
    sheet.openDetail('b1')
    await w.vm.$nextTick()
    const dialog = w.find('[role="dialog"]')
    expect(dialog.attributes('aria-label')).toBe('Bit: Steuer abgeben')

    sheet.openDetail('b2')
    await w.vm.$nextTick()
    // the same sheet element stays; only its content changes
    expect(w.find('[role="dialog"]').element).toBe(dialog.element)
    expect(w.find('[role="dialog"]').attributes('aria-label')).toBe('Bit: Belege scannen')
    expect(w.find<HTMLTextAreaElement>('textarea.detail__title').element.value).toBe(
      'Belege scannen',
    )
  })

  it('färbt den Kopf in der Bitfarbe, in der Capture-Ansicht in der Farbe des nächsten Bits', async () => {
    useBitStore().bits = [bitWith({ color: '#22c55e' })]
    const w = mountSheet()
    const sheet = useSheetStore()
    sheet.openDetail('b1')
    await w.vm.$nextTick()
    const style = () => (w.find('[role="dialog"]').element as HTMLElement).style
    expect(style().getPropertyValue('--c')).toBe('#22c55e')
    sheet.backToCapture()
    await w.vm.$nextTick()
    expect(style().getPropertyValue('--c')).toBe(DEFAULT_COLOR)
  })

  it('schließt, wenn die Detail-Ansicht das Bit löscht', async () => {
    useBitStore().bits = [bitWith()]
    const w = mountSheet()
    useSheetStore().openDetail('b1')
    await w.vm.$nextTick()
    await w.find('.detail__delete').trigger('click')
    expect(commands.remove).toHaveBeenCalledWith('b1')
    expect(useSheetStore().open).toBe(false)
  })

  it('schließt sich auch, wenn der Store von außen schließt, und gibt den Canvas frei', async () => {
    useBitStore().bits = [bitWith()]
    const w = mountSheet()
    const sheet = useSheetStore()
    sheet.openDetail('b1')
    await w.vm.$nextTick()
    expect(sheet.revealed).toBe(320)

    // e.g. a command deleting the open bit, without the view's own close
    sheet.close()
    await w.vm.$nextTick()
    expect(sheet.revealed).toBe(0)
    expect(w.find('[role="dialog"]').exists()).toBe(false)

    // and it opens again as usual
    sheet.openDetail('b1')
    await w.vm.$nextTick()
    expect(sheet.revealed).toBe(320)
  })
})

describe('Capture-Ansicht', () => {
  async function openCapture(at = { x: 300, y: 200 }) {
    const w = mountSheet()
    const sheet = useSheetStore()
    sheet.openCapture(at, null)
    await w.vm.$nextTick()
    return { w, sheet, input: () => w.find<HTMLInputElement>('.capture input') }
  }

  async function type(w: VueWrapper, text: string, extra: KeyboardEventInit = {}) {
    const input = w.find('.capture input')
    await input.setValue(text)
    await input.trigger('keydown', { key: 'Enter', ...extra })
  }

  const chip = (w: VueWrapper, kind: string) => w.find(`[data-chip="${kind}"]`)
  const chipLabel = (w: VueWrapper, kind: string) => chip(w, kind).find('.chip__label').text()

  it('gibt dem Eingabefeld eine Beschriftung', async () => {
    const { input } = await openCapture()
    expect(input().attributes('aria-label')).toBe('New bit title')
  })

  it('legt mit allen erkannten Feldern an, dueDate als lokaler Mittag', async () => {
    const { w } = await openCapture()
    await type(w, 'Steuer abgeben morgen !! ~l #rot')
    expect(commands.create).toHaveBeenCalledWith(
      {
        id: expect.any(String),
        title: 'Steuer abgeben',
        dueDate: dueToApi(addDays(todayKey(), 1)),
        priority: 2,
        size: 3,
        color: '#ef4444',
      },
      { x: 300 - CAPSULE_W / 2, y: 200 - 64 / 2 },
      null,
    )
  })

  it('übernimmt eine Wiederholung aus der Eingabe', async () => {
    const { w } = await openCapture()
    await type(w, 'Gießen täglich')
    expect(commands.create.mock.calls[0]![0]).toMatchObject({
      title: 'Gießen',
      recurrence: 'daily',
      dueDate: dueToApi(todayKey()),
    })
  })

  it('tut bei einem Titel nur aus Tokens nichts', async () => {
    const { w } = await openCapture()
    await type(w, 'morgen !!')
    expect(commands.create).not.toHaveBeenCalled()
  })

  it('füllt die Chips live aus den Tokens', async () => {
    const { w, input } = await openCapture()
    expect(chipLabel(w, 'due')).toBe('Due')
    await input().setValue('A morgen !!! ~xl #grün')
    expect(chipLabel(w, 'due')).toBe('Tomorrow')
    expect(chipLabel(w, 'priority')).toBe('High')
    expect(chipLabel(w, 'size')).toBe('XL')
    expect(chipLabel(w, 'color')).toBe('Green')
    expect(chip(w, 'priority').find('.chip').classes()).toContain('chip--set')
  })

  it('färbt den Kopf in der Farbe des nächsten Bits', async () => {
    const { w, input } = await openCapture()
    const style = () => (w.find('[role="dialog"]').element as HTMLElement).style
    expect(style().getPropertyValue('--c')).toBe(DEFAULT_COLOR)
    await input().setValue('A #grün')
    expect(style().getPropertyValue('--c')).toBe('#22c55e')
  })

  it('übernimmt eine explizite Chip-Wahl, solange es kein Token derselben Art gibt', async () => {
    const { w, input } = await openCapture()
    await chip(w, 'priority').find('.chip__btn').trigger('click')
    await chip(w, 'priority').find('[role="radio"][title="High"]').trigger('click')
    expect(chipLabel(w, 'priority')).toBe('High')

    await input().setValue('A !')
    // the token wins over the explicit choice
    expect(chipLabel(w, 'priority')).toBe('Low')
    await input().setValue('A')
    expect(chipLabel(w, 'priority')).toBe('High')
    await input().trigger('keydown', { key: 'Enter' })
    expect(commands.create.mock.calls[0]![0]).toMatchObject({ title: 'A', priority: 3 })
  })

  it('setzt die Fälligkeit per Schnellwahl und leert sie per ×', async () => {
    const { w } = await openCapture()
    await chip(w, 'due').find('.chip__btn').trigger('click')
    const tomorrow = chip(w, 'due')
      .findAll('.picker__quick')
      .find((b) => b.text() === 'Tomorrow')!
    await tomorrow.trigger('click')
    expect(chipLabel(w, 'due')).toBe('Tomorrow')
    await chip(w, 'due').find('.chip__clear').trigger('click')
    expect(chipLabel(w, 'due')).toBe('Due')
  })

  it('behält nach Enter nur die Farbe für das nächste Bit', async () => {
    const { w } = await openCapture()
    await chip(w, 'size').find('.chip__btn').trigger('click')
    await chip(w, 'size')
      .findAll('[role="radio"]')
      .find((b) => b.text() === 'S')!
      .trigger('click')
    await type(w, 'A morgen !! #grün')
    expect(commands.create.mock.calls[0]![0]).toMatchObject({ size: 1, color: '#22c55e' })

    expect(chipLabel(w, 'due')).toBe('Due')
    expect(chipLabel(w, 'priority')).toBe('Priority')
    expect(chipLabel(w, 'size')).toBe('Size')
    expect(chipLabel(w, 'color')).toBe('Green')
    await type(w, 'B')
    const second = commands.create.mock.calls[1]![0]
    expect(second).toEqual({ id: expect.any(String), title: 'B', color: '#22c55e' })
  })

  it('bietet an einem Chip mit Token „Keep as text“: das Token bleibt Titel', async () => {
    const { w, input } = await openCapture()
    await input().setValue('Mail an Fr. Müller !!')
    await chip(w, 'priority').find('.chip__btn').trigger('click')
    const keep = chip(w, 'priority')
      .findAll('button')
      .find((b) => b.text() === 'Keep as text')!
    await keep.trigger('click')
    expect(chipLabel(w, 'priority')).toBe('Priority')
    expect(input().element.value).toBe('Mail an Fr. Müller !!')
    await input().trigger('keydown', { key: 'Enter' })
    const fields = commands.create.mock.calls[0]![0]
    expect(fields.title).toBe('Mail an Fr. Müller !!')
    expect(fields).not.toHaveProperty('priority')
  })

  it('bietet an einem Chip mit Token „Clear“: das Token verschwindet aus dem Text', async () => {
    const { w, input } = await openCapture()
    await input().setValue('Bericht morgen schreiben ~m')
    await chip(w, 'size').find('.chip__btn').trigger('click')
    const clear = chip(w, 'size')
      .findAll('button')
      .find((b) => b.text() === 'Clear')!
    await clear.trigger('click')
    expect(input().element.value).toBe('Bericht morgen schreiben')
    expect(chipLabel(w, 'size')).toBe('Size')
  })

  it('verschiebt „Keep as text“ mit, wenn davor Text eingefügt wird', async () => {
    const { w, input } = await openCapture()
    await input().setValue('A !!')
    await chip(w, 'priority').find('.chip__btn').trigger('click')
    await chip(w, 'priority')
      .findAll('button')
      .find((b) => b.text() === 'Keep as text')!
      .trigger('click')
    await input().setValue('Neu A !!')
    expect(chipLabel(w, 'priority')).toBe('Priority')
  })

  it('schließt mit Esc zuerst einen offenen Chip, erst dann das Sheet', async () => {
    const { w, sheet, input } = await openCapture()
    await chip(w, 'priority').find('.chip__btn').trigger('click')
    expect(chip(w, 'priority').find('.chip__btn').attributes('aria-expanded')).toBe('true')
    press(input().element, 'Escape')
    await w.vm.$nextTick()
    expect(chip(w, 'priority').find('.chip__btn').attributes('aria-expanded')).toBe('false')
    expect(sheet.open).toBe(true)
    press(input().element, 'Escape')
    expect(sheet.open).toBe(false)
  })

  it('zeigt die neue Zeile sofort, noch bevor der Server antwortet', async () => {
    commands.create.mockImplementation((fields: CreateFields, pos) => {
      useBitStore().bits.push(bitWith({ ...fields, ...pos, id: fields.id! }))
      return new Promise<Bit>(() => {})
    })
    const { w, sheet } = await openCapture()
    await type(w, 'Sofort')
    expect(w.find('.capture__row').text()).toContain('Sofort')
    expect(sheet.series).toEqual([{ id: createdId(0), failed: false }])
  })

  it('setzt Geister-Capsule und lastRect und rückt nach Enter um Höhe + 12 px nach unten', async () => {
    const { sheet, input } = await openCapture()
    expect(sheet.ghost).toEqual({ x: 200, y: 184, h: 32, title: '', color: DEFAULT_COLOR })
    await input().setValue('A ~m')
    expect(sheet.ghost).toMatchObject({ x: 200, y: 178, h: 44, title: 'A' })
    await input().trigger('keydown', { key: 'Enter' })
    expect(sheet.lastRect).toEqual({ x: 200, y: 178, w: CAPSULE_W, h: 44 })
    expect(sheet.ghost).toMatchObject({ x: 200, y: 178 + 44 + 12, h: 32, title: '' })
    expect(sheet.materializeId).toBe(createdId(0))
  })

  it('räumt Geister-Capsule und lastRect beim Schließen und neuen Öffnen ab', async () => {
    const { w, sheet } = await openCapture()
    await type(w, 'A')
    sheet.openCapture({ x: 0, y: 0 }, null)
    expect(sheet.lastRect).toBeNull()
    await w.vm.$nextTick()
    await w.find('.capture [aria-label="Close"]').trigger('click')
    expect(sheet.ghost).toBeNull()
    expect(sheet.lastRect).toBeNull()
  })

  it('zeigt bei einem Fehler „Couldn’t create“ mit Retry, Retry legt mit neuer ID an', async () => {
    commands.create.mockImplementationOnce(() => Promise.reject(new Error('offline')))
    const { w, sheet } = await openCapture()
    await type(w, 'Steuer !!')
    await flush()
    const row = w.find('.capture__row--failed')
    expect(row.text()).toContain('Steuer')
    expect(row.text()).toContain('Couldn’t create')
    // the ghost stays where the next bit goes
    expect(sheet.ghost).not.toBeNull()

    await row.find('button').trigger('click')
    expect(commands.create).toHaveBeenCalledTimes(2)
    const [first, firstPos] = commands.create.mock.calls[0]!
    const [again, againPos] = commands.create.mock.calls[1]!
    expect(again).toEqual({ ...first, id: expect.any(String) })
    expect(again.id).not.toBe(first.id)
    expect(againPos).toEqual(firstPos)
    await flush()
    expect(w.find('.capture__row--failed').exists()).toBe(false)
    expect(sheet.series).toEqual([{ id: again.id, failed: false }])
  })

  it('kehrt nach Strg+Enter bei einem Fehler zur Capture-Ansicht zurück', async () => {
    commands.create.mockImplementationOnce(
      () => new Promise<Bit>((_, reject) => setTimeout(() => reject(new Error('offline')))),
    )
    const { w, sheet } = await openCapture()
    await type(w, 'A', { ctrlKey: true })
    expect(sheet.view).toBe('detail')
    await flush()
    expect(sheet.view).toBe('capture')
    await w.vm.$nextTick()
    expect(w.find('.capture__row--failed').exists()).toBe(true)
  })

  it('reicht einen Klick auf eine Abhängigkeit als Navigationswunsch an den Store weiter', async () => {
    useBitStore().bits = [bitWith(), bitWith({ id: 'b2', title: 'Belege sammeln' })]
    useDependencyStore().dependencies = [
      { id: 'd1', fromType: 'bit', fromId: 'b2', toType: 'bit', toId: 'b1' },
    ]
    const w = mountSheet()
    const sheet = useSheetStore()
    sheet.openDetail('b1')
    await w.vm.$nextTick()
    await w.find('.deplist__main').trigger('click')
    expect(sheet.navigateRequest).toEqual({ type: 'bit', id: 'b2' })
  })
})
