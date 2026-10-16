import { describe, it, expect, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { addDays, dueToApi, todayKey } from '@/helpers/localDate'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import LWorkspace from './LWorkspace.vue'
import { useBitStore } from '@/stores/bitStore'
import { useSheetStore } from '@/stores/sheetStore'
import { useHistoryStore } from '@/stores/historyStore'

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
