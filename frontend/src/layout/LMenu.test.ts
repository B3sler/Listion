import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import { useHistoryStore } from '@/stores/historyStore'
import LMenu from './LMenu.vue'

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}))
vi.mock('@/helpers/api', () => ({ default: api }))

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/login', component: { template: '<div />' } },
  ],
})

beforeEach(() => {
  setActivePinia(createPinia())
  vi.resetAllMocks()
  api.post.mockResolvedValue({ data: {} })
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function logout() {
  const wrapper = mount(LMenu, { global: { plugins: [router] }, attachTo: document.body })
  await wrapper.find('.menu-btn').trigger('click')
  const button = wrapper.findAll('[role="menuitem"]').find((b) => b.text().includes('Logout'))!
  await button.trigger('click')
  return wrapper
}

describe('LMenu', () => {
  it('committet einen offenen Toast (z. B. ein Löschen) vor dem Logout-Request', async () => {
    const history = useHistoryStore()
    const order: string[] = []
    let finish!: () => void
    history.showToast({
      id: 't',
      message: 'Bit deleted',
      undoable: true,
      onCommit: () =>
        new Promise<void>((r) => {
          order.push('commit')
          finish = () => {
            order.push('committed')
            r()
          }
        }),
    })
    api.post.mockImplementation(async (url: string) => {
      order.push(url)
      return { data: {} }
    })

    const wrapper = await logout()
    expect(order).toEqual(['commit'])
    finish()
    await vi.waitFor(() => expect(order).toEqual(['commit', 'committed', '/api/auth/logout']))
    expect(history.toast).toBeNull()
    wrapper.unmount()
  })

  it('löst bei einem Doppelklick keinen zweiten Logout vor dem Delete-Commit aus', async () => {
    const history = useHistoryStore()
    const order: string[] = []
    let finish!: () => void
    history.showToast({
      id: 't',
      message: 'Bit deleted',
      undoable: true,
      onCommit: () =>
        new Promise<void>((r) => {
          order.push('commit')
          finish = () => {
            order.push('committed')
            r()
          }
        }),
    })
    api.post.mockImplementation(async (url: string) => {
      order.push(url)
      return { data: {} }
    })

    const wrapper = await logout()
    const button = wrapper.findAll('[role="menuitem"]').find((b) => b.text().includes('Logout'))!
    await button.trigger('click')
    await Promise.resolve()
    expect(order).toEqual(['commit'])
    finish()
    await vi.waitFor(() => expect(order).toEqual(['commit', 'committed', '/api/auth/logout']))
    await new Promise((r) => setTimeout(r, 0))
    expect(order).toEqual(['commit', 'committed', '/api/auth/logout'])
    wrapper.unmount()
  })

  it('meldet sich auch ohne Toast ab', async () => {
    const wrapper = await logout()
    await vi.waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/auth/logout'))
    wrapper.unmount()
  })
})
