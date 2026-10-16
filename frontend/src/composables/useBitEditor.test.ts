import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, nextTick, ref, type Ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { useBitStore, type Bit } from '@/stores/bitStore'
import { useHistoryStore } from '@/stores/historyStore'
import { BIT_COMMANDS, type BitCommands } from './useBitCommands'
import { useBitEditor } from './useBitEditor'

function bitWith(extra: Partial<Bit> = {}): Bit {
  return {
    id: 'b1',
    title: 'Alt',
    status: 0,
    x: 0,
    y: 0,
    packetId: null,
    order: 0,
    createdAt: '2026-10-14T09:00:00.000Z',
    notes: '',
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
const mounted: { unmount(): void }[] = []

function setup(id: Ref<string | null> = ref('b1')) {
  let editor!: ReturnType<typeof useBitEditor>
  const wrapper = mount(
    defineComponent({
      setup() {
        editor = useBitEditor(id)
        return () => null
      },
    }),
    { global: { plugins: [pinia], provide: { [BIT_COMMANDS as symbol]: commands } } },
  )
  mounted.push(wrapper)
  return { editor, wrapper, id }
}

beforeEach(() => {
  vi.useFakeTimers()
  pinia = createPinia()
  setActivePinia(pinia)
  useBitStore().bits = [bitWith(), bitWith({ id: 'b2', title: 'Zweites' })]
  commands = mockCommands()
})

afterEach(() => {
  // a mounted editor keeps listening for pagehide
  for (const w of mounted.splice(0)) w.unmount()
  vi.useRealTimers()
})

describe('useBitEditor', () => {
  it('übernimmt Titel und Notizen des Bits', () => {
    useBitStore().bits[0]!.notes = 'Belege'
    const { editor } = setup()
    expect(editor.title.value).toBe('Alt')
    expect(editor.notes.value).toBe('Belege')
  })

  it('speichert beim Tippen erst nach 400 ms Pause, dann genau einmal', async () => {
    const { editor } = setup()
    editor.onTitleInput('S')
    await vi.advanceTimersByTimeAsync(300)
    editor.onTitleInput('St')
    await vi.advanceTimersByTimeAsync(300)
    editor.onTitleInput('Steuer')
    await vi.advanceTimersByTimeAsync(399)
    expect(commands.update).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(commands.update).toHaveBeenCalledTimes(1)
    expect(commands.update).toHaveBeenCalledWith(
      'b1',
      { title: 'Steuer' },
      expect.objectContaining({ coalesce: 'title' }),
    )
    await vi.advanceTimersByTimeAsync(2000)
    expect(commands.update).toHaveBeenCalledTimes(1)
  })

  it('speichert Notizen mit coalesce notes', async () => {
    const { editor } = setup()
    editor.onNotesInput('Belege scannen')
    await vi.advanceTimersByTimeAsync(400)
    expect(commands.update).toHaveBeenCalledWith(
      'b1',
      { notes: 'Belege scannen' },
      expect.objectContaining({ coalesce: 'notes' }),
    )
  })

  it('flush() speichert sofort und danach nicht noch einmal', async () => {
    const { editor } = setup()
    editor.onTitleInput('Steuer abgeben')
    await editor.flush()
    expect(commands.update).toHaveBeenCalledTimes(1)
    expect(commands.update).toHaveBeenCalledWith(
      'b1',
      { title: 'Steuer abgeben' },
      expect.anything(),
    )
    await vi.advanceTimersByTimeAsync(1000)
    expect(commands.update).toHaveBeenCalledTimes(1)
  })

  it('sendet einen leeren Titel nicht und stellt ihn beim Blur wieder her', async () => {
    const { editor } = setup()
    editor.onTitleInput('   ')
    await vi.advanceTimersByTimeAsync(1000)
    expect(commands.update).not.toHaveBeenCalled()
    await editor.onTextBlur()
    expect(commands.update).not.toHaveBeenCalled()
    expect(editor.title.value).toBe('Alt')
    expect(editor.shake.value).toBe(true)
    await vi.advanceTimersByTimeAsync(240)
    expect(editor.shake.value).toBe(false)
  })

  it('kürzt beim Blur Leerraum am Rand des Titels', async () => {
    const { editor } = setup()
    editor.onTitleInput('Steuer ')
    await editor.onTextBlur()
    expect(editor.title.value).toBe('Steuer')
    expect(commands.update).toHaveBeenCalledWith('b1', { title: 'Steuer' }, expect.anything())
  })

  it('schliesst den Tipp-Schritt beim Blur ab, nachdem der Text gesendet wurde', async () => {
    const { editor } = setup()
    const order: string[] = []
    commands.update.mockImplementation(() => {
      order.push('update')
      return Promise.resolve()
    })
    const seal = vi.spyOn(useHistoryStore(), 'seal').mockImplementation(() => {
      order.push('seal')
    })
    editor.onTitleInput('Steuer abgeben')
    await editor.onTextBlur()
    expect(seal).toHaveBeenCalledTimes(1)
    expect(order).toEqual(['update', 'seal'])
  })

  it('set() speichert sofort mit dem Label', async () => {
    const { editor } = setup()
    await editor.set({ priority: 3 }, 'Priority')
    expect(commands.update).toHaveBeenCalledWith('b1', { priority: 3 }, { label: 'Priority' })
  })

  it('zeigt saving erst nach 500 ms laufendem Request', async () => {
    commands.update.mockReturnValue(new Promise(() => {}))
    const { editor } = setup()
    void editor.set({ priority: 1 }, 'Priority')
    await vi.advanceTimersByTimeAsync(499)
    expect(editor.saveState.value).toBe('idle')
    await vi.advanceTimersByTimeAsync(1)
    expect(editor.saveState.value).toBe('saving')
  })

  it('geht nach einer schnellen Antwort nie auf saving', async () => {
    const { editor } = setup()
    await editor.set({ priority: 1 }, 'Priority')
    await vi.advanceTimersByTimeAsync(1000)
    expect(editor.saveState.value).toBe('idle')
  })

  it('wird bei einem Fehler error, und retry sendet den Entwurf erneut', async () => {
    commands.update.mockRejectedValueOnce(new Error('offline'))
    const { editor } = setup()
    editor.onTitleInput('Steuer abgeben')
    await editor.flush()
    expect(editor.saveState.value).toBe('error')
    // the draft stays even though the store rolled back
    expect(editor.title.value).toBe('Steuer abgeben')

    await editor.retry()
    expect(commands.update).toHaveBeenCalledTimes(2)
    expect(commands.update).toHaveBeenLastCalledWith(
      'b1',
      { title: 'Steuer abgeben' },
      expect.anything(),
    )
    expect(editor.saveState.value).toBe('idle')
  })

  it('sendet bei retry auch fehlgeschlagene Chip-Änderungen erneut', async () => {
    commands.update.mockRejectedValueOnce(new Error('offline'))
    const { editor } = setup()
    await editor.set({ priority: 2 }, 'Priority')
    expect(editor.saveState.value).toBe('error')
    await editor.retry()
    expect(commands.update).toHaveBeenLastCalledWith('b1', { priority: 2 }, expect.anything())
    expect(editor.saveState.value).toBe('idle')
  })

  it('flusht beim Wechsel des Bits zuerst für das alte Bit', async () => {
    const { editor, id } = setup()
    editor.onTitleInput('Neu')
    id.value = 'b2'
    await nextTick()
    expect(commands.update).toHaveBeenCalledWith('b1', { title: 'Neu' }, expect.anything())
    expect(editor.title.value).toBe('Zweites')
    await vi.advanceTimersByTimeAsync(1000)
    expect(commands.update).toHaveBeenCalledTimes(1)
  })

  it('übernimmt Änderungen am Bit von außen, solange nichts getippt wird', async () => {
    const { editor } = setup()
    useBitStore().bits[0] = { ...useBitStore().bits[0]!, title: 'Von außen' }
    await nextTick()
    expect(editor.title.value).toBe('Von außen')
  })

  it('überschreibt einen ungespeicherten Entwurf nicht', async () => {
    const { editor } = setup()
    editor.onTitleInput('Entwurf')
    useBitStore().bits[0] = { ...useBitStore().bits[0]!, notes: 'x', title: 'Von außen' }
    await nextTick()
    expect(editor.title.value).toBe('Entwurf')
    expect(editor.notes.value).toBe('x')
  })

  describe('pagehide', () => {
    let fetchMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
      fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
      vi.stubGlobal('fetch', fetchMock)
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('sendet wartenden Text per fetch mit keepalive statt über axios', () => {
      const { editor } = setup()
      editor.onTitleInput('Neu')
      editor.onNotesInput('Notiz')
      window.dispatchEvent(new Event('pagehide'))
      expect(commands.update).not.toHaveBeenCalled()
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
      expect(url).toBe('/api/bit/b1')
      expect(init).toMatchObject({ method: 'PUT', keepalive: true, credentials: 'include' })
      expect(new Headers(init.headers).get('Content-Type')).toBe('application/json')
      expect(JSON.parse(init.body as string)).toEqual({ title: 'Neu', notes: 'Notiz' })
    })

    it('sendet nichts, wenn kein Text wartet', () => {
      setup()
      window.dispatchEvent(new Event('pagehide'))
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('sendet einen leeren Titel nicht', () => {
      const { editor } = setup()
      editor.onTitleInput('')
      editor.onNotesInput('Notiz')
      window.dispatchEvent(new Event('pagehide'))
      expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string)).toEqual({ notes: 'Notiz' })
    })

    it('verschickt den Text nach pagehide nicht noch einmal über den Debounce', async () => {
      const { editor } = setup()
      editor.onNotesInput('Notiz')
      window.dispatchEvent(new Event('pagehide'))
      await vi.advanceTimersByTimeAsync(1000)
      expect(commands.update).not.toHaveBeenCalled()
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('flusht beim Unmount und hört danach nicht mehr auf pagehide', async () => {
      const { editor, wrapper } = setup()
      editor.onNotesInput('Notiz')
      wrapper.unmount()
      expect(commands.update).toHaveBeenCalledTimes(1)
      editor.onNotesInput('Später')
      window.dispatchEvent(new Event('pagehide'))
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })
})
