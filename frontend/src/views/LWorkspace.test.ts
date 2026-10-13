import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import LWorkspace from './LWorkspace.vue'

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
                  id: 1,
                  title: 'Plan',
                  status: 2,
                  x: 0,
                  y: 0,
                  packetId: 7,
                  order: 0,
                  createdAt: '',
                },
                {
                  id: 2,
                  title: 'Build',
                  status: 0,
                  x: 0,
                  y: 0,
                  packetId: 7,
                  order: 1,
                  createdAt: '',
                },
                {
                  id: 3,
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
              ? [{ id: 7, name: 'Release', x: 0, y: 0 }]
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

  it('Doppelklick auf eine freie Fläche öffnet „New Bit“, auf einer Kapsel nicht', async () => {
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
                  id: 3,
                  title: 'Loose',
                  status: 0,
                  x: 400,
                  y: 0,
                  packetId: null,
                  order: 0,
                  flowId: 9,
                  createdAt: '',
                },
              ]
            : url === '/api/flow'
              ? [{ id: 9, name: 'Release Q4', color: '#818cf8' }]
              : [],
      }),
    )
    const wrapper = mount(LWorkspace, {
      global: { plugins: [router, createPinia()] },
      attachTo: document.body,
    })
    await router.isReady()
    await new Promise((r) => setTimeout(r, 0))
    expect(wrapper.find('[data-flow-id="9"]').exists()).toBe(true)
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
      id: 3,
      title: 'Loose',
      status: 0,
      x: 400,
      y: 0,
      packetId: null,
      order: 0,
      flowId: 9,
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
                  ? [{ id: 9, name: 'Release Q4', color: '#818cf8' }]
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
          { ...looseInFlow, id: 1, packetId: 7, flowId: null, x: 0, order: 0 },
          { ...looseInFlow, id: 2, packetId: 7, flowId: null, x: 0, order: 1 },
          { ...looseInFlow, id: 4, title: 'Outside', x: 1600, flowId: null },
        ],
        packets: [{ id: 7, name: 'Stack', x: 0, y: 200, flowId: 9 }],
      })
      const capsule = () => wrapper.findAll('.flow-item').find((c) => c.text().includes('Loose'))!
      const outsider = () =>
        wrapper.findAll('.flow-item').find((c) => c.text().includes('Outside'))!
      const stack = () => wrapper.find('.stack')
      expect(capsule().classes()).not.toContain('flow-item--following')
      expect(stack().classes()).not.toContain('stack--dragging')

      wrapper
        .find('[data-flow-id="9"]')
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

    it('Doppelklick im Flow-Modus öffnet kein „New Bit“', async () => {
      const { wrapper } = await mountWithFlow()
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' }))
      await wrapper.vm.$nextTick()
      await wrapper.find('.lasso-capture').trigger('dblclick')
      expect(wrapper.text()).not.toContain('New Bit')
      wrapper.unmount()
    })

    it('ein im Flow-Rahmen angelegtes Bit wird Mitglied des Flows, außerhalb nicht', async () => {
      const { wrapper, api } = await mountWithFlow()
      const data = {
        title: 'Neu',
        status: 0,
        priority: undefined,
        dueDate: undefined,
        notes: undefined,
        color: '#6366f1',
      }
      const frame = wrapper.find('[data-flow-id="9"]')
      const m = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(frame.attributes('style') ?? '')!
      const el = frame.element as HTMLElement
      const inside = {
        clientX: Number(m[1]) + parseFloat(el.style.width) / 2,
        clientY: Number(m[2]) + parseFloat(el.style.height) / 2,
      }
      vi.mocked(api.post).mockClear()
      frame.element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, ...inside }))
      await wrapper.vm.$nextTick()
      wrapper.findComponent({ name: 'LBitPanel' }).vm.$emit('confirm', data)
      await new Promise((r) => setTimeout(r, 0))
      expect(api.post).toHaveBeenCalledWith('/api/bit', expect.objectContaining({ flowId: 9 }))

      vi.mocked(api.post).mockClear()
      wrapper
        .find('.bg-surface1')
        .element.dispatchEvent(
          new MouseEvent('dblclick', { bubbles: true, clientX: -2000, clientY: -2000 }),
        )
      await wrapper.vm.$nextTick()
      wrapper.findComponent({ name: 'LBitPanel' }).vm.$emit('confirm', data)
      await new Promise((r) => setTimeout(r, 0))
      expect(api.post).toHaveBeenCalledTimes(1)
      expect(vi.mocked(api.post).mock.calls[0]![1]).not.toHaveProperty('flowId')
      wrapper.unmount()
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
                  id: 1,
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
                  id: 2,
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
})
