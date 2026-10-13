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
})
