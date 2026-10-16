import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { addDays, dueToApi, todayKey } from '@/helpers/localDate'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import LWorkspace from './LWorkspace.vue'
import { useBitStore } from '@/stores/bitStore'
import { useSheetStore } from '@/stores/sheetStore'
import { useDependencyStore } from '@/stores/dependencyStore'
import { useHistoryStore } from '@/stores/historyStore'
import { FOCUS_KEY, FOCUS_PENDING_KEY, useFocusStore } from '@/stores/focusStore'
import { useToolStore } from '@/stores/toolStore'

// Keine echten HTTP-Requests im Test: Stores laden Bits/Verbindungen über den API-Client.
vi.mock('../helpers/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
  },
}))

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: { template: '<div>Home</div>' } },
    { path: '/workspace', component: LWorkspace },
  ],
})

describe('LWorkspace', () => {
  it('should render without crashing', async () => {
    const wrapper = mount(LWorkspace, {
      global: {
        plugins: [router, createPinia()],
      },
    })
    await router.isReady()
    expect(wrapper).toBeTruthy()
  })

  it('should display workspace text', async () => {
    const wrapper = mount(LWorkspace, {
      global: {
        plugins: [router, createPinia()],
      },
    })
    await router.isReady()
    expect(wrapper.text()).toContain('Workspace')
  })

  it('rendert Stapel und lose Kapseln aus den Stores', async () => {
    const { default: api } = await import('../helpers/api')
    vi.mocked(api.get).mockImplementation((url: string) =>
      Promise.resolve({
        data:
          url === '/api/bit'
            ? [
                {
                  id: '1',
                  title: 'Plan',
                  status: 2,
                  x: 0,
                  y: 0,
                  packetId: '7',
                  order: 0,
                  createdAt: '',
                },
                {
                  id: '2',
                  title: 'Build',
                  status: 0,
                  x: 0,
                  y: 0,
                  packetId: '7',
                  order: 1,
                  createdAt: '',
                },
                {
                  id: '3',
                  title: 'Loose',
                  status: 0,
                  x: 400,
                  y: 0,
                  packetId: null,
                  order: 0,
                  createdAt: '',
                },
              ]
            : url === '/api/packet'
              ? [{ id: '7', name: 'Release', x: 0, y: 0 }]
              : [],
      }),
    )
    const wrapper = mount(LWorkspace, { global: { plugins: [router, createPinia()] } })
    await router.isReady()
    await new Promise((r) => setTimeout(r, 0))
    expect(wrapper.findAll('[data-node-type="packet"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-node-type="bit"]')).toHaveLength(3)
    expect(wrapper.text()).toContain('Release')
  })

  it('Doppelklick auf eine freie Fläche öffnet „New Bits“, auf einer Kapsel nicht', async () => {
    const wrapper = mount(LWorkspace, { global: { plugins: [router, createPinia()] } })
    await router.isReady()
    await new Promise((r) => setTimeout(r, 0))

    await wrapper.find('[data-node-type="bit"]').trigger('dblclick')
    expect(wrapper.text()).not.toContain('New Bit')

    await wrapper.find('.bg-surface1').trigger('dblclick')
    expect(wrapper.text()).toContain('New Bit')
  })

  it('zeigt Flow-Rahmen mit Namen und schaltet per F/Esc in den Lasso-Modus', async () => {
    const { default: api } = await import('../helpers/api')
    vi.mocked(api.get).mockImplementation((url: string) =>
      Promise.resolve({
        data:
          url === '/api/bit'
            ? [
                {
                  id: '3',
                  title: 'Loose',
                  status: 0,
                  x: 400,
                  y: 0,
                  packetId: null,
                  order: 0,
                  flowId: 'f9',
                  createdAt: '',
                },
              ]
            : url === '/api/flow'
              ? [{ id: 'f9', name: 'Release Q4', color: '#818cf8' }]
              : [],
      }),
    )
    const wrapper = mount(LWorkspace, {
      global: { plugins: [router, createPinia()] },
      attachTo: document.body,
    })
    await router.isReady()
    await new Promise((r) => setTimeout(r, 0))
    expect(wrapper.find('[data-flow-id="f9"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Release Q4')

    expect(wrapper.find('.lasso-capture').exists()).toBe(false)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }))
    await wrapper.vm.$nextTick()
    // the capture layer sits above bits so a lasso can start on top of them
    expect(wrapper.find('.lasso-capture').exists()).toBe(true)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.lasso-capture').exists()).toBe(false)
    wrapper.unmount()
  })

  describe('Flow-Rahmen', () => {
    const looseInFlow = {
      id: '3',
      title: 'Loose',
      status: 0,
      x: 400,
      y: 0,
      packetId: null,
      order: 0,
      flowId: 'f9',
      createdAt: '',
    }

    async function mountWithFlow(extra: { bits?: object[]; packets?: object[] } = {}) {
      const { default: api } = await import('../helpers/api')
      vi.mocked(api.get).mockImplementation((url: string) =>
        Promise.resolve({
          data:
            url === '/api/bit'
              ? [looseInFlow, ...(extra.bits ?? [])]
              : url === '/api/packet'
                ? (extra.packets ?? [])
                : url === '/api/flow'
                  ? [{ id: 'f9', name: 'Release Q4', color: '#818cf8' }]
                  : [],
        }),
      )
      const wrapper = mount(LWorkspace, {
        global: { plugins: [router, createPinia()] },
        attachTo: document.body,
      })
      await router.isReady()
      await new Promise((r) => setTimeout(r, 0))
      return { wrapper, api }
    }

    it('Mitglieder folgen beim Ziehen des Rahmens ohne Verzögerung', async () => {
      const { wrapper } = await mountWithFlow({
        bits: [
          { ...looseInFlow, id: '1', packetId: '7', flowId: null, x: 0, order: 0 },
          { ...looseInFlow, id: '2', packetId: '7', flowId: null, x: 0, order: 1 },
          { ...looseInFlow, id: '4', title: 'Outside', x: 1600, flowId: null },
        ],
        packets: [{ id: '7', name: 'Stack', x: 0, y: 200, flowId: 'f9' }],
      })
      const capsule = () => wrapper.findAll('.flow-item').find((c) => c.text().includes('Loose'))!
      const outsider = () =>
        wrapper.findAll('.flow-item').find((c) => c.text().includes('Outside'))!
      const stack = () => wrapper.find('.stack')
      expect(capsule().classes()).not.toContain('flow-item--following')
      expect(stack().classes()).not.toContain('stack--dragging')

      wrapper
        .find('[data-flow-id="f9"]')
        .element.dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 10 }),
        )
      window.dispatchEvent(new PointerEvent('pointermove', { clientX: 90, clientY: 10 }))
      await wrapper.vm.$nextTick()

      expect(capsule().classes()).toContain('flow-item--following')
      expect(stack().classes()).toContain('stack--dragging')
      // a loose bit outside the flow keeps its glide
      expect(outsider().classes()).not.toContain('flow-item--following')

      window.dispatchEvent(new PointerEvent('pointerup', { clientX: 90, clientY: 10 }))
      await wrapper.vm.$nextTick()
      expect(capsule().classes()).not.toContain('flow-item--following')
      wrapper.unmount()
    })

    it('Doppelklick im Flow-Modus öffnet kein „New Bits“', async () => {
      const { wrapper } = await mountWithFlow()
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }))
      await wrapper.vm.$nextTick()
      await wrapper.find('.lasso-capture').trigger('dblclick')
      expect(wrapper.text()).not.toContain('New Bit')
      wrapper.unmount()
    })

    it('ein im Flow-Rahmen angelegtes Bit wird Mitglied des Flows, außerhalb nicht', async () => {
      const { wrapper, api } = await mountWithFlow()
      vi.mocked(api.post).mockImplementation((_url: string, body?: unknown) =>
        Promise.resolve({ data: body }),
      )
      const frame = wrapper.find('[data-flow-id="f9"]')
      const m = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(frame.attributes('style') ?? '')!
      const el = frame.element as HTMLElement
      const inside = {
        clientX: Number(m[1]) + parseFloat(el.style.width) / 2,
        clientY: Number(m[2]) + parseFloat(el.style.height) / 2,
      }
      vi.mocked(api.post).mockClear()
      frame.element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, ...inside }))
      await wrapper.vm.$nextTick()
      await wrapper.find('.capture input').setValue('Neu')
      await wrapper.find('.capture input').trigger('keydown', { key: 'Enter' })
      await new Promise((r) => setTimeout(r, 0))
      expect(api.post).toHaveBeenCalledWith(
        '/api/bit',
        expect.objectContaining({ title: 'Neu', flowId: 'f9' }),
      )

      vi.mocked(api.post).mockClear()
      wrapper
        .find('.bg-surface1')
        .element.dispatchEvent(
          new MouseEvent('dblclick', { bubbles: true, clientX: -2000, clientY: -2000 }),
        )
      await wrapper.vm.$nextTick()
      await wrapper.find('.capture input').setValue('Draußen')
      await wrapper.find('.capture input').trigger('keydown', { key: 'Enter' })
      await new Promise((r) => setTimeout(r, 0))
      expect(api.post).toHaveBeenCalledTimes(1)
      expect(vi.mocked(api.post).mock.calls[0]![1]).toMatchObject({ title: 'Draußen' })
      expect(vi.mocked(api.post).mock.calls[0]![1]).not.toHaveProperty('flowId')
      wrapper.unmount()
    })

    it('ein Klick auf eine Kapsel öffnet die Detail-Ansicht mit dem Titel des Bits', async () => {
      const { wrapper } = await mountWithFlow()
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)

      const capsule = wrapper.find('[data-node-type="bit"]')
      capsule.element.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 5, clientY: 5 }),
      )
      window.dispatchEvent(new PointerEvent('pointerup', { clientX: 5, clientY: 5 }))
      await wrapper.vm.$nextTick()

      const sheet = wrapper.find('[role="dialog"]')
      expect(sheet.attributes('aria-label')).toBe('Bit: Loose')
      expect(sheet.find<HTMLTextAreaElement>('textarea.detail__title').element.value).toBe('Loose')
      wrapper.unmount()
    })

    it('Esc schließt das Sheet', async () => {
      // reduced motion: the slide settles at once instead of over several frames
      vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduced-motion') }))
      try {
        const { wrapper } = await mountWithFlow()
        await wrapper.find('.bg-surface1').trigger('dblclick')
        expect(wrapper.find('.capture').exists()).toBe(true)

        await wrapper.find('.capture input').trigger('keydown', { key: 'Escape' })
        expect(wrapper.find('.capture').exists()).toBe(false)
        expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
        wrapper.unmount()
      } finally {
        vi.unstubAllGlobals()
      }
    })

    it('der Canvas weicht dem offenen Sheet aus', async () => {
      vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduced-motion') }))
      try {
        const { wrapper } = await mountWithFlow()
        const canvas = () => wrapper.find('.bg-surface1').element as HTMLElement
        expect(canvas().style.transform).toBe('translateX(0px)')
        await wrapper.find('.bg-surface1').trigger('dblclick')
        expect(canvas().style.transform).toBe('translateX(320px)')
        expect(canvas().style.transition).toBe('')
        wrapper.unmount()
      } finally {
        vi.unstubAllGlobals()
      }
    })

    it('Redo eines Löschens bei offenem Sheet schließt es und gibt den Canvas frei', async () => {
      vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduced-motion') }))
      try {
        const { wrapper } = await mountWithFlow()
        // the stores of this mount (an earlier, still mounted workspace may own the active pinia)
        setActivePinia((wrapper.vm as unknown as { $pinia: Pinia }).$pinia)
        const sheet = useSheetStore()
        const history = useHistoryStore()
        const canvas = () => wrapper.find('.bg-surface1').element as HTMLElement
        const capsules = () => wrapper.findAll('[data-node-type="bit"]')

        sheet.openDetail('3')
        await wrapper.vm.$nextTick()
        await wrapper.find('.detail__delete').trigger('click')
        expect(capsules()).toHaveLength(0)
        expect(canvas().style.transform).toBe('translateX(0px)')

        await history.undo()
        await wrapper.vm.$nextTick()
        expect(capsules()).toHaveLength(1)
        sheet.openDetail('3')
        await wrapper.vm.$nextTick()
        expect(canvas().style.transform).toBe('translateX(320px)')

        // the redo deletes again through the command alone, no close from the detail view
        await history.redo()
        await wrapper.vm.$nextTick()
        expect(capsules()).toHaveLength(0)
        expect(sheet.open).toBe(false)
        expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
        expect(canvas().style.transform).toBe('translateX(0px)')
        history.dismissToast()
        wrapper.unmount()
      } finally {
        vi.unstubAllGlobals()
      }
    })

    const pressKey = (target: EventTarget, init: KeyboardEventInit) => {
      const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
      target.dispatchEvent(event)
      return event
    }

    it('Abhaken im Sheet lässt die Kapsel setteln und schließt das Sheet nach 350 ms', async () => {
      const { wrapper } = await mountWithFlow()
      setActivePinia((wrapper.vm as unknown as { $pinia: Pinia }).$pinia)
      const sheet = useSheetStore()
      sheet.openDetail('3')
      await wrapper.vm.$nextTick()
      const capsule = () => wrapper.findAll('.flow-item').find((c) => c.text().includes('Loose'))!
      const settleScale = () =>
        (capsule().element as HTMLElement)
          .querySelector<HTMLElement>('[data-node-type="bit"]')!
          .style.getPropertyValue('--settle')
      expect(settleScale()).toBe('')

      await wrapper.find('.hold').trigger('keydown', { key: 'Enter' })
      await wrapper.vm.$nextTick()
      expect(settleScale()).toBe('1.04')
      expect(sheet.open).toBe(true)

      await vi.waitFor(() => expect(sheet.open).toBe(false), { timeout: 2000 })
      wrapper.unmount()
    })

    it('lässt auch eine Kapsel im Stapel setteln, jedes Mal erneut', async () => {
      const { wrapper } = await mountWithFlow({
        bits: [{ ...looseInFlow, id: '1', packetId: '7', flowId: null, x: 0, order: 0 }],
        packets: [{ id: '7', name: 'Stack', x: 0, y: 200, flowId: null }],
      })
      setActivePinia((wrapper.vm as unknown as { $pinia: Pinia }).$pinia)
      const sheet = useSheetStore()
      const stacked = () => wrapper.find('.stack [data-node-type="bit"]')
      const settleScale = () =>
        (stacked().element as HTMLElement).style.getPropertyValue('--settle')
      expect(stacked().exists()).toBe(true)
      expect(settleScale()).toBe('')

      sheet.requestSettle('1')
      await wrapper.vm.$nextTick()
      expect(settleScale()).toBe('1.04')

      // a second completion of the same bit fires again
      ;(stacked().element as HTMLElement).style.setProperty('--settle', '1')
      sheet.requestSettle('1')
      await wrapper.vm.$nextTick()
      expect(settleScale()).toBe('1.04')
      wrapper.unmount()
    })

    describe('Abhängigkeiten im Sheet', () => {
      let rect: ReturnType<typeof vi.spyOn>
      beforeEach(() => {
        // the canvas restores its last pan from localStorage; start from the origin
        localStorage.clear()
        vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduced-motion') }))
        rect = vi
          .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
          .mockReturnValue(DOMRect.fromRect({ x: 0, y: 0, width: 1000, height: 800 }))
      })
      afterEach(() => {
        rect.mockRestore()
        vi.unstubAllGlobals()
      })

      async function mountWithArrow() {
        const mounted = await mountWithFlow({
          bits: [
            { ...looseInFlow, id: '4', title: 'Far', x: 1600, flowId: null },
            { ...looseInFlow, id: '5', title: 'Packed', x: 0, packetId: '7', flowId: null },
          ],
          packets: [{ id: '7', name: 'Stack', x: 2400, y: 200, flowId: null }],
        })
        setActivePinia((mounted.wrapper.vm as unknown as { $pinia: Pinia }).$pinia)
        useDependencyStore().dependencies = [
          { id: 'd1', fromType: 'bit', fromId: '3', toType: 'bit', toId: '4' },
        ]
        await mounted.wrapper.vm.$nextTick()
        const layer = () =>
          (mounted.wrapper.find('.bg-surface1 > .origin-top-left').element as HTMLElement).style
            .transform
        return { ...mounted, layer }
      }

      it('hebt beim Hover im Sheet den Pfeil hervor, ohne Löschgriff', async () => {
        const { wrapper } = await mountWithArrow()
        const sheet = useSheetStore()
        expect(wrapper.find('.dep--selected').exists()).toBe(false)
        sheet.hoverDependencyId = 'd1'
        await wrapper.vm.$nextTick()
        expect(wrapper.find('.dep--selected').exists()).toBe(true)
        expect(wrapper.find('.dep__delete').exists()).toBe(false)
        sheet.hoverDependencyId = null
        await wrapper.vm.$nextTick()
        expect(wrapper.find('.dep--selected').exists()).toBe(false)
        wrapper.unmount()
      })

      it('navigate zu einem Bit schwenkt dorthin und wechselt das Sheet', async () => {
        const { wrapper, layer } = await mountWithArrow()
        const sheet = useSheetStore()
        sheet.openDetail('3')
        await wrapper.vm.$nextTick()
        expect(layer()).toBe('translate3d(0px, 0px, 0) scale(1)')
        sheet.requestNavigate({ type: 'bit', id: '4' })
        await wrapper.vm.$nextTick()
        expect(sheet.bitId).toBe('4')
        expect(sheet.view).toBe('detail')
        expect(layer()).toMatch(/^translate3d\(-\d+(\.\d+)?px,/)
        wrapper.unmount()
      })

      it('navigate zu einem Packet fokussiert den Stapel', async () => {
        const { wrapper, layer } = await mountWithArrow()
        const sheet = useSheetStore()
        sheet.openDetail('3')
        await wrapper.vm.$nextTick()
        expect(layer()).toBe('translate3d(0px, 0px, 0) scale(1)')
        sheet.requestNavigate({ type: 'packet', id: '7' })
        await wrapper.vm.$nextTick()
        expect(layer()).toMatch(/^translate3d\(-\d+(\.\d+)?px,/)
        // the sheet stays on its bit
        expect(sheet.bitId).toBe('3')
        wrapper.unmount()
      })
    })

    describe('Fokus-Timer', () => {
      beforeEach(() => localStorage.clear())
      afterEach(() => {
        useFocusStore().cancel()
        localStorage.clear()
      })

      it('Löschen eines Bits mit laufendem Timer beendet ihn ohne Buchung', async () => {
        vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduced-motion') }))
        try {
          const { wrapper, api } = await mountWithFlow()
          setActivePinia((wrapper.vm as unknown as { $pinia: Pinia }).$pinia)
          const focus = useFocusStore()
          focus.start('3')
          vi.mocked(api.post).mockClear()
          useSheetStore().openDetail('3')
          await wrapper.vm.$nextTick()
          await wrapper.find('.detail__delete').trigger('click')
          expect(focus.running).toBeNull()
          expect(api.post).not.toHaveBeenCalled()
          useHistoryStore().dismissToast()
          wrapper.unmount()
        } finally {
          vi.unstubAllGlobals()
        }
      })

      it('stellt einen Timer wieder her und reicht Offenes nach dem Laden nach', async () => {
        localStorage.setItem(
          FOCUS_KEY,
          JSON.stringify({ bitId: '3', startedAt: Date.now() - 90_000 }),
        )
        localStorage.setItem(FOCUS_PENDING_KEY, JSON.stringify({ '3': 40 }))
        const { default: api } = await import('../helpers/api')
        vi.mocked(api.post).mockClear()
        const { wrapper } = await mountWithFlow()
        setActivePinia((wrapper.vm as unknown as { $pinia: Pinia }).$pinia)
        await vi.waitFor(() =>
          expect(api.post).toHaveBeenCalledWith('/api/bit/3/focus', { seconds: 40 }),
        )
        const focus = useFocusStore()
        expect(focus.running?.bitId).toBe('3')
        expect(focus.elapsed).toBeGreaterThanOrEqual(90)
        wrapper.unmount()
      })
    })

    describe('Undo-Tastatur und Toast', () => {
      async function mountWithHistory() {
        const { wrapper } = await mountWithFlow()
        // the stores of this mount (an earlier, still mounted workspace may own the active pinia)
        setActivePinia((wrapper.vm as unknown as { $pinia: Pinia }).$pinia)
        return { wrapper, history: useHistoryStore(), sheet: useSheetStore() }
      }

      it('Strg+Z auf dem Body macht rückgängig, Strg+Umschalt+Z stellt wieder her', async () => {
        const { wrapper, history } = await mountWithHistory()
        const undo = vi.spyOn(history, 'undo').mockResolvedValue(true)
        const redo = vi.spyOn(history, 'redo').mockResolvedValue(true)

        const first = pressKey(document.body, { key: 'z', ctrlKey: true })
        expect(undo).toHaveBeenCalledTimes(1)
        expect(first.defaultPrevented).toBe(true)

        pressKey(document.body, { key: 'Z', metaKey: true, shiftKey: true })
        expect(redo).toHaveBeenCalledTimes(1)
        expect(undo).toHaveBeenCalledTimes(1)
        wrapper.unmount()
      })

      it('Strg+Z im Textfeld überlässt dem Browser das Text-Undo', async () => {
        const { wrapper, history, sheet } = await mountWithHistory()
        const undo = vi.spyOn(history, 'undo').mockResolvedValue(true)
        const redo = vi.spyOn(history, 'redo').mockResolvedValue(true)
        sheet.openDetail('3')
        await wrapper.vm.$nextTick()

        const area = wrapper.find('textarea.detail__title').element
        const event = pressKey(area, { key: 'z', ctrlKey: true })
        pressKey(area, { key: 'z', ctrlKey: true, shiftKey: true })
        expect(undo).not.toHaveBeenCalled()
        expect(redo).not.toHaveBeenCalled()
        expect(event.defaultPrevented).toBe(false)
        wrapper.unmount()
      })

      it('Z ohne Strg oder ⌘ tut nichts', async () => {
        const { wrapper, history } = await mountWithHistory()
        const undo = vi.spyOn(history, 'undo').mockResolvedValue(true)
        pressKey(document.body, { key: 'z' })
        expect(undo).not.toHaveBeenCalled()
        wrapper.unmount()
      })

      it('Löschen über das Sheet zeigt „Bit deleted“, Undo im Toast bringt die Kapsel zurück', async () => {
        vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduced-motion') }))
        try {
          const { wrapper, history, sheet } = await mountWithHistory()
          sheet.openDetail('3')
          await wrapper.vm.$nextTick()
          await wrapper.find('.detail__delete').trigger('click')
          expect(wrapper.findAll('[data-node-type="bit"]')).toHaveLength(0)
          expect(wrapper.find('.toast').text()).toContain('Bit deleted')

          await wrapper.find('.toast__undo').trigger('click')
          await vi.waitFor(() => expect(wrapper.findAll('[data-node-type="bit"]')).toHaveLength(1))
          expect(history.toast).toBeNull()
          expect(wrapper.find('.toast').exists()).toBe(false)
          wrapper.unmount()
        } finally {
          vi.unstubAllGlobals()
        }
      })

      it('Done → In Progress im Sheet ist ein Schritt: ein Strg+Z stellt Done wieder her', async () => {
        const { wrapper, history, sheet } = await mountWithHistory()
        const bitStore = useBitStore()
        bitStore.bits = bitStore.bits.map((b) => (b.id === '3' ? { ...b, status: 2 } : b))
        sheet.openDetail('3')
        await wrapper.vm.$nextTick()

        await wrapper
          .find('[aria-label="Status"]')
          .findAll('[role="radio"]')
          .find((r) => r.text() === 'In Progress')!
          .trigger('click')
        await vi.waitFor(() => expect(bitStore.bits.find((b) => b.id === '3')?.status).toBe(1))
        await new Promise((r) => setTimeout(r, 0))

        pressKey(document.body, { key: 'z', ctrlKey: true })
        await vi.waitFor(() => expect(history.canRedo).toBe(true))
        expect(bitStore.bits.find((b) => b.id === '3')?.status).toBe(2)
        expect(history.canUndo).toBe(false)
        wrapper.unmount()
      })

      it('Verlassen (Abmelden) schließt das Sheet, leert die History und committet keinen Toast mehr', async () => {
        vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduced-motion') }))
        try {
          const { wrapper, history, sheet } = await mountWithHistory()
          const { default: api } = await import('../helpers/api')
          const pinia = (wrapper.vm as unknown as { $pinia: Pinia }).$pinia
          vi.mocked(api.delete).mockClear()
          sheet.openDetail('3')
          await wrapper.vm.$nextTick()
          await wrapper.find('.detail__delete').trigger('click')
          expect(history.toast?.message).toBe('Bit deleted')
          sheet.openCapture({ x: 0, y: 0 }, null)
          await wrapper.vm.$nextTick()
          expect(sheet.ghost).not.toBeNull()

          vi.useFakeTimers()
          try {
            wrapper.unmount()
            expect(sheet.open).toBe(false)
            expect(sheet.ghost).toBeNull()
            expect(sheet.series).toEqual([])
            expect(sheet.revealed).toBe(0)
            expect(history.canUndo).toBe(false)
            expect(history.canRedo).toBe(false)
            expect(history.toast).toBeNull()
            await vi.advanceTimersByTimeAsync(10_000)
            expect(api.delete).not.toHaveBeenCalled()
          } finally {
            vi.useRealTimers()
          }
          // the delete never went out: the bit is not left hidden either
          expect(useBitStore().hiddenIds.has('3')).toBe(false)

          // the next login: the sheet does not slide in by itself
          const again = mount(LWorkspace, {
            global: { plugins: [router, pinia] },
            attachTo: document.body,
          })
          await new Promise((r) => setTimeout(r, 0))
          expect(again.find('[role="dialog"]').exists()).toBe(false)
          expect(sheet.revealed).toBe(0)
          again.unmount()
        } finally {
          vi.unstubAllGlobals()
        }
      })

      it('Strg+Z auf dem Body nimmt das Löschen ebenfalls zurück', async () => {
        vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduced-motion') }))
        try {
          const { wrapper, history, sheet } = await mountWithHistory()
          sheet.openDetail('3')
          await wrapper.vm.$nextTick()
          await wrapper.find('.detail__delete').trigger('click')
          expect(wrapper.findAll('[data-node-type="bit"]')).toHaveLength(0)

          pressKey(document.body, { key: 'z', ctrlKey: true })
          await vi.waitFor(() => expect(wrapper.findAll('[data-node-type="bit"]')).toHaveLength(1))
          history.dismissToast()
          wrapper.unmount()
        } finally {
          vi.unstubAllGlobals()
        }
      })
    })
  })

  it('Filter dimmt nicht passende Kapseln', async () => {
    const { default: api } = await import('../helpers/api')
    vi.mocked(api.get).mockImplementation((url: string) =>
      Promise.resolve({
        data:
          url === '/api/bit'
            ? [
                {
                  id: '1',
                  title: 'High',
                  status: 0,
                  x: 0,
                  y: 0,
                  packetId: null,
                  order: 0,
                  priority: 3,
                  createdAt: '',
                },
                {
                  id: '2',
                  title: 'Low',
                  status: 0,
                  x: 300,
                  y: 0,
                  packetId: null,
                  order: 0,
                  priority: 1,
                  createdAt: '',
                },
              ]
            : [],
      }),
    )
    localStorage.setItem('listion-filter', JSON.stringify({ workflow: [], priority: [3], due: [] }))
    const wrapper = mount(LWorkspace, { global: { plugins: [router, createPinia()] } })
    await router.isReady()
    await new Promise((r) => setTimeout(r, 0))
    const caps = wrapper.findAll('[data-node-type="bit"]')
    const high = caps.find((c) => c.text().includes('High'))!
    const low = caps.find((c) => c.text().includes('Low'))!
    expect(high.classes()).not.toContain('capsule--dimmed')
    expect(low.classes()).toContain('capsule--dimmed')
    localStorage.clear()
  })

  describe('Filter „Hide snoozed“', () => {
    beforeEach(() => localStorage.clear())
    afterEach(() => localStorage.clear())

    const LATER = '2099-01-01'
    const bit = (id: string, packetId: string | null, extra: Record<string, unknown> = {}) => ({
      id,
      title: `B${id}`,
      status: 0,
      x: Number(id) * 300,
      y: 0,
      packetId,
      order: Number(id),
      createdAt: '',
      ...extra,
    })

    async function mountSheet() {
      const { default: api } = await import('../helpers/api')
      vi.mocked(api.get).mockImplementation((url: string) =>
        Promise.resolve({
          data:
            url === '/api/bit'
              ? [
                  bit('1', null, { snoozedUntil: LATER }),
                  bit('2', null),
                  bit('3', '7', { snoozedUntil: LATER }),
                  bit('4', '7'),
                ]
              : url === '/api/packet'
                ? [{ id: '7', name: 'Release', x: 1500, y: 0 }]
                : url === '/api/dependency'
                  ? [
                      { id: 'a', fromType: 'bit', fromId: '1', toType: 'bit', toId: '2' },
                      { id: 'b', fromType: 'bit', fromId: '2', toType: 'bit', toId: '4' },
                    ]
                  : [],
        }),
      )
      const wrapper = mount(LWorkspace, { global: { plugins: [router, createPinia()] } })
      await router.isReady()
      await new Promise((r) => setTimeout(r, 0))
      setActivePinia((wrapper.vm as unknown as { $pinia: Pinia }).$pinia)
      return wrapper
    }
    const capsule = (w: VueWrapper, title: string) =>
      w.findAll('[data-node-type="bit"]').find((c) => c.text().includes(title))

    it('blendet gesnoozte lose Bits und ihre Pfeile aus, Stapel-Mitglieder bleiben blass', async () => {
      const wrapper = await mountSheet()
      expect(wrapper.findAll('[data-node-type="bit"]')).toHaveLength(4)
      expect(wrapper.findAll('.dep__line')).toHaveLength(2)

      useToolStore().setHideSnoozed(true)
      await wrapper.vm.$nextTick()
      expect(capsule(wrapper, 'B1')).toBeUndefined()
      expect(capsule(wrapper, 'B2')).toBeDefined()
      const inStack = capsule(wrapper, 'B3')!
      expect(inStack.classes()).toContain('capsule--snoozed')
      expect(capsule(wrapper, 'B4')).toBeDefined()
      // the arrow into the hidden bit goes, the one between visible bits stays
      expect(wrapper.findAll('.dep__line')).toHaveLength(1)
      wrapper.unmount()
    })

    describe('verborgene Bits zählen für Interaktionen nicht', () => {
      async function mountHidden(bits: object[], flows: object[] = []) {
        const { default: api } = await import('../helpers/api')
        vi.mocked(api.get).mockImplementation((url: string) =>
          Promise.resolve({
            data: url === '/api/bit' ? bits : url === '/api/flow' ? flows : [],
          }),
        )
        vi.mocked(api.post).mockReset()
        vi.mocked(api.post).mockImplementation((_url: string, body?: unknown) =>
          Promise.resolve({ data: body }),
        )
        vi.mocked(api.put).mockClear()
        const wrapper = mount(LWorkspace, {
          global: { plugins: [router, createPinia()] },
          attachTo: document.body,
        })
        await router.isReady()
        await new Promise((r) => setTimeout(r, 0))
        setActivePinia((wrapper.vm as unknown as { $pinia: Pinia }).$pinia)
        useToolStore().setHideSnoozed(true)
        await wrapper.vm.$nextTick()
        return { wrapper, api }
      }
      const press = (el: Element, x: number, y: number) =>
        el.dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: x, clientY: y }),
        )
      const move = (x: number, y: number) =>
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y }))
      const release = (x: number, y: number) =>
        window.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y }))

      it('ein Bit neben einem verborgenen Bit rastet dort nicht zu einem Stapel ein', async () => {
        const { wrapper, api } = await mountHidden([
          bit('1', null, { snoozedUntil: LATER, x: 0 }),
          bit('2', null, { x: 600 }),
        ])
        const dragged = capsule(wrapper, 'B2')!
        press(dragged.element, 610, 10)
        move(200, 15)
        move(10, 12)
        await wrapper.vm.$nextTick()
        release(10, 12)
        await new Promise((r) => setTimeout(r, 0))
        expect(api.post).not.toHaveBeenCalledWith('/api/packet', expect.anything())
        expect(api.put).toHaveBeenCalled()
        wrapper.unmount()
      })

      it('ein Lasso über ein verborgenes Bit nimmt es nicht in den Flow auf', async () => {
        const { wrapper, api } = await mountHidden([
          bit('1', null, { snoozedUntil: LATER, x: 0 }),
          bit('2', null, { x: 0, y: 200 }),
        ])
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }))
        await wrapper.vm.$nextTick()
        const layer = wrapper.find('.lasso-capture').element
        press(layer, -50, -50)
        for (const [x, y] of [
          [300, -50],
          [300, 300],
          [-50, 300],
          [-40, -40],
        ] as const)
          move(x, y)
        release(-40, -40)
        await new Promise((r) => setTimeout(r, 0))
        const call = vi.mocked(api.post).mock.calls.find(([url]) => url === '/api/flow')
        expect(call).toBeDefined()
        expect((call![1] as { bitIds: string[] }).bitIds).toEqual(['2'])
        wrapper.unmount()
      })

      it('ein Flow, dessen einziges Mitglied verborgen ist, zeichnet keinen Rahmen', async () => {
        const { wrapper } = await mountHidden(
          [bit('1', null, { snoozedUntil: LATER, x: 0, flowId: 'f1' }), bit('2', null, { x: 900 })],
          [{ id: 'f1', name: 'Leer', color: '#818cf8' }],
        )
        expect(wrapper.find('[data-flow-id="f1"]').exists()).toBe(false)
        useToolStore().setHideSnoozed(false)
        await wrapper.vm.$nextTick()
        expect(wrapper.find('[data-flow-id="f1"]').exists()).toBe(true)
        wrapper.unmount()
      })
    })

    it('dimmt mit nur diesem Schalter keine Kapsel und zeigt alles wieder beim Ausschalten', async () => {
      const wrapper = await mountSheet()
      const tools = useToolStore()
      tools.setHideSnoozed(true)
      await wrapper.vm.$nextTick()
      expect(wrapper.findAll('.capsule--dimmed')).toHaveLength(0)
      expect(wrapper.findAll('.dep--dimmed')).toHaveLength(0)

      tools.setHideSnoozed(false)
      await wrapper.vm.$nextTick()
      expect(capsule(wrapper, 'B1')).toBeDefined()
      expect(wrapper.findAll('.dep__line')).toHaveLength(2)
      wrapper.unmount()
    })
  })

  describe('Serie in der Capture-Ansicht', () => {
    async function mountEmpty() {
      const { default: api } = await import('../helpers/api')
      vi.mocked(api.get).mockImplementation(() => Promise.resolve({ data: [] }))
      vi.mocked(api.post).mockReset()
      vi.mocked(api.post).mockImplementation((_url: string, body?: unknown) =>
        Promise.resolve({ data: body }),
      )
      const wrapper = mount(LWorkspace, {
        global: { plugins: [router, createPinia()] },
        attachTo: document.body,
      })
      await router.isReady()
      await new Promise((r) => setTimeout(r, 0))
      return { wrapper, api }
    }

    async function enter(wrapper: VueWrapper, text: string) {
      const input = wrapper.find('.capture input')
      await input.setValue(text)
      await input.trigger('keydown', { key: 'Enter' })
    }

    it('legt per Enter untereinander an, behält nur die Farbe und zeigt die Geister-Capsule', async () => {
      const { wrapper, api } = await mountEmpty()
      await wrapper.find('.bg-surface1').trigger('dblclick', { clientX: 400, clientY: 300 })
      expect(wrapper.find('.ghost').exists()).toBe(true)

      await enter(wrapper, 'A morgen !! #grün')
      await enter(wrapper, 'B')
      await new Promise((r) => setTimeout(r, 0))

      const posts = vi.mocked(api.post).mock.calls.filter((c) => c[0] === '/api/bit')
      expect(posts).toHaveLength(2)
      const first = posts[0]![1] as Record<string, number | string>
      const second = posts[1]![1] as Record<string, number | string>
      expect(first).toMatchObject({
        title: 'A',
        priority: 2,
        dueDate: dueToApi(addDays(todayKey(), 1)),
        color: '#22c55e',
        x: 400 - 100,
        y: 300 - 16,
      })
      expect(second).toMatchObject({ title: 'B', color: '#22c55e', x: first.x })
      expect(second.y).toBe((first.y as number) + 32 + 12)
      expect(second).not.toHaveProperty('priority')
      expect(second).not.toHaveProperty('dueDate')

      // the ghost waits at the next slot
      expect(wrapper.find('.ghost').exists()).toBe(true)
      expect(wrapper.find('.ghost').text()).toContain('New Bit')
      wrapper.unmount()
    })

    it('Strg+Z bis vor das Anlegen schließt das Sheet, gibt den Canvas frei und beendet den Timer ohne Buchung', async () => {
      vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduced-motion') }))
      localStorage.clear()
      try {
        const { wrapper, api } = await mountEmpty()
        setActivePinia((wrapper.vm as unknown as { $pinia: Pinia }).$pinia)
        const sheet = useSheetStore()
        const bitStore = useBitStore()
        const focus = useFocusStore()
        const canvas = () => wrapper.find('.bg-surface1').element as HTMLElement
        const undo = () =>
          document.body.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }),
          )

        await wrapper.find('.bg-surface1').trigger('dblclick', { clientX: 400, clientY: 300 })
        const input = wrapper.find('.capture input')
        await input.setValue('A')
        await input.trigger('keydown', { key: 'Enter', ctrlKey: true })
        await new Promise((r) => setTimeout(r, 0))
        expect(sheet.view).toBe('detail')
        const id = sheet.bitId!

        // an edit in the detail view, a timer running on the new bit
        await wrapper
          .find('[aria-label="Status"]')
          .findAll('[role="radio"]')
          .find((r) => r.text() === 'In Progress')!
          .trigger('click')
        await new Promise((r) => setTimeout(r, 0))
        focus.start(id)
        vi.mocked(api.post).mockClear()

        const history = useHistoryStore()
        undo()
        // the undo of the edit has finished (it moved to Redo); the sheet stays on the bit
        await vi.waitFor(() => expect(history.canRedo).toBe(true))
        expect(bitStore.bits.find((b) => b.id === id)?.status).toBe(0)
        expect(sheet.open).toBe(true)
        undo()
        await vi.waitFor(() => expect(bitStore.bits.some((b) => b.id === id)).toBe(false))
        await wrapper.vm.$nextTick()

        expect(sheet.open).toBe(false)
        expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
        expect(canvas().style.transform).toBe('translateX(0px)')
        expect(focus.running).toBeNull()
        expect(api.post).not.toHaveBeenCalled()
        wrapper.unmount()
      } finally {
        useFocusStore().cancel()
        localStorage.clear()
        vi.unstubAllGlobals()
      }
    })

    it('zeigt in der Geister-Capsule den bereinigten Titel', async () => {
      const { wrapper } = await mountEmpty()
      await wrapper.find('.bg-surface1').trigger('dblclick', { clientX: 400, clientY: 300 })
      await wrapper.find('.capture input').setValue('Steuer abgeben morgen !!')
      expect(wrapper.find('.ghost').text()).toBe('Steuer abgeben')
      wrapper.unmount()
    })

    it('blendet die Geister-Capsule mit dem Schließen des Sheets aus', async () => {
      vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduced-motion') }))
      try {
        const { wrapper } = await mountEmpty()
        await wrapper.find('.bg-surface1').trigger('dblclick', { clientX: 400, clientY: 300 })
        expect(wrapper.find('.ghost').exists()).toBe(true)
        await wrapper.find('.capture [aria-label="Close"]').trigger('click')
        expect(wrapper.find('.ghost').exists()).toBe(false)
        wrapper.unmount()
      } finally {
        vi.unstubAllGlobals()
      }
    })

    it('markiert die neue Capsule für die Materialisierung', async () => {
      const { wrapper } = await mountEmpty()
      await wrapper.find('.bg-surface1').trigger('dblclick', { clientX: 400, clientY: 300 })
      await enter(wrapper, 'A')
      const capsule = wrapper.find('[data-node-type="bit"]')
      expect(capsule.classes()).toContain('capsule--materialize')
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      await wrapper.vm.$nextTick()
      expect(capsule.classes()).not.toContain('capsule--materialize')
      wrapper.unmount()
    })

    it('schwenkt den Canvas, wenn der Slot hinter dem Sheet oder außerhalb liegt', async () => {
      // the canvas restores its last pan from localStorage; start from the origin
      localStorage.clear()
      vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduced-motion') }))
      const rect = vi
        .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
        .mockReturnValue(DOMRect.fromRect({ x: 0, y: 0, width: 1000, height: 800 }))
      try {
        const { wrapper } = await mountEmpty()
        const layer = () =>
          (wrapper.find('.bg-surface1 > .origin-top-left').element as HTMLElement).style.transform

        // well inside the visible part: nothing moves
        await wrapper.find('.bg-surface1').trigger('dblclick', { clientX: 300, clientY: 400 })
        expect(layer()).toBe('translate3d(0px, 0px, 0) scale(1)')
        await wrapper.find('.capture [aria-label="Close"]').trigger('click')

        // the slot 800…1000 reaches past 1000 − 320 − 24: x lands 48 px from the left edge,
        // the slot's middle in the middle of the container
        await wrapper.find('.bg-surface1').trigger('dblclick', { clientX: 900, clientY: 400 })
        expect(layer()).toBe('translate3d(-752px, 0px, 0) scale(1)')
        wrapper.unmount()
      } finally {
        rect.mockRestore()
        vi.unstubAllGlobals()
      }
    })

    describe('Schwenken nur, wenn die Serie weiterrückt', () => {
      async function openAndPanAway() {
        const { wrapper } = await mountEmpty()
        const layer = () =>
          (wrapper.find('.bg-surface1 > .origin-top-left').element as HTMLElement).style.transform
        await wrapper.find('.bg-surface1').trigger('dblclick', { clientX: 300, clientY: 400 })
        expect(layer()).toBe('translate3d(0px, 0px, 0) scale(1)')
        // the user scrolls the canvas away: the slot (200…400) is now off to the left
        await wrapper.find('.bg-surface1').trigger('wheel', { deltaX: 600, deltaY: 0 })
        expect(layer()).toBe('translate3d(-600px, 0px, 0) scale(1)')
        return { wrapper, layer }
      }

      let rect: ReturnType<typeof vi.spyOn>
      beforeEach(() => {
        // the canvas restores its last pan from localStorage; start from the origin
        localStorage.clear()
        vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduced-motion') }))
        rect = vi
          .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
          .mockReturnValue(DOMRect.fromRect({ x: 0, y: 0, width: 1000, height: 800 }))
      })
      afterEach(() => {
        rect.mockRestore()
        vi.unstubAllGlobals()
      })

      it('Tippen im Eingabefeld schwenkt den Canvas nicht zurück', async () => {
        const { wrapper, layer } = await openAndPanAway()
        await wrapper.find('.capture input').setValue('Steuer')
        await wrapper.find('.capture input').setValue('Steuer ~xl #rot')
        expect(layer()).toBe('translate3d(-600px, 0px, 0) scale(1)')
        wrapper.unmount()
      })

      it('eine Änderung an einem anderen Bit schwenkt den Canvas nicht zurück', async () => {
        const { wrapper, layer } = await openAndPanAway()
        setActivePinia((wrapper.vm as unknown as { $pinia: Pinia }).$pinia)
        const store = useBitStore()
        store.bits.push({
          id: 'x',
          title: 'Woanders',
          status: 0,
          x: 2000,
          y: 2000,
          packetId: null,
          order: 0,
          createdAt: '',
        })
        await wrapper.vm.$nextTick()
        await store.updateBit('x', { x: 2100 })
        await wrapper.vm.$nextTick()
        expect(layer()).toBe('translate3d(-600px, 0px, 0) scale(1)')
        wrapper.unmount()
      })

      it('Enter mit dem nächsten Slot außerhalb schwenkt dorthin', async () => {
        const { wrapper, layer } = await openAndPanAway()
        await enter(wrapper, 'A')
        // next slot (200, 384 + 32 + 12): x 48 px from the left, its middle at 800 / 2
        expect(layer()).toBe('translate3d(-152px, -44px, 0) scale(1)')
        wrapper.unmount()
      })
    })
  })

  it('versteckte Bits, ihre Stapel und Pfeile werden nicht gerendert', async () => {
    const { default: api } = await import('../helpers/api')
    const bit = (id: string, packetId: string | null, order = 0, x = 0) => ({
      id,
      title: `B${id}`,
      status: 0,
      x,
      y: 0,
      packetId,
      order,
      createdAt: '',
    })
    vi.mocked(api.get).mockImplementation((url: string) =>
      Promise.resolve({
        data:
          url === '/api/bit'
            ? [bit('1', null), bit('2', null, 0, 400), bit('3', '7'), bit('4', '7', 1)]
            : url === '/api/packet'
              ? [{ id: '7', name: 'Release', x: 800, y: 0 }]
              : url === '/api/dependency'
                ? [{ id: 'd', fromType: 'bit', fromId: '1', toType: 'bit', toId: '2' }]
                : [],
      }),
    )
    const pinia = createPinia()
    const wrapper = mount(LWorkspace, { global: { plugins: [router, pinia] } })
    await router.isReady()
    await new Promise((r) => setTimeout(r, 0))
    expect(wrapper.findAll('[data-node-type="bit"]')).toHaveLength(4)
    expect(wrapper.findAll('.dep__line')).toHaveLength(1)

    setActivePinia(pinia)
    const store = useBitStore()
    store.hide('1')
    store.hide('3')
    store.hide('4')
    await wrapper.vm.$nextTick()
    const titles = wrapper.findAll('[data-node-type="bit"]').map((c) => c.text())
    expect(titles).toHaveLength(1)
    expect(titles[0]).toContain('B2')
    expect(wrapper.findAll('[data-node-type="packet"]')).toHaveLength(0)
    expect(wrapper.findAll('.dep__line')).toHaveLength(0)

    store.unhide('1')
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('[data-node-type="bit"]')).toHaveLength(2)
    expect(wrapper.findAll('.dep__line')).toHaveLength(1)
    wrapper.unmount()
  })
})
