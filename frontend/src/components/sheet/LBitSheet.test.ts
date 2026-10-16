import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { useBitStore, type Bit } from '@/stores/bitStore'
import { useSheetStore } from '@/stores/sheetStore'
import { useToolStore } from '@/stores/toolStore'
import { BIT_COMMANDS, type BitCommands, type CreateFields } from '@/composables/useBitCommands'
import { CAPSULE_H, CAPSULE_W } from '@/composables/useFlowLayout'
import { DEFAULT_COLOR } from '@/helpers/palette'
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
      const bit = bitWith({ ...fields, ...pos, id: `n${++created}` })
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
      { title: 'Steuer', color: DEFAULT_COLOR },
      { x: 100 - CAPSULE_W / 2, y: 200 - CAPSULE_H / 2 },
      'f1',
    )
    expect(input.element.value).toBe('')
    await flush()
    expect(useSheetStore().series).toEqual([{ id: 'n1', failed: false }])
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
    await flush()
    expect(sheet.view).toBe('detail')
    expect(sheet.bitId).toBe('n1')
    expect(w.find('[role="dialog"]').attributes('aria-label')).toBe('Bit: A')

    sheet.backToCapture()
    await w.vm.$nextTick()
    await w.find('.capture input').setValue('B')
    await w.find('.capture input').trigger('keydown', { key: 'Enter', metaKey: true })
    await flush()
    expect(sheet.bitId).toBe('n2')
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
    expect(sheet.bitId).toBe('n1')

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
