import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia } from 'pinia'
import LWorkspace from './LWorkspace.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: { template: '<div>Home</div>' } },
    { path: '/workspace', component: LWorkspace },
  ],
})

describe('LWorkspace', () => {
  it('should render without crashing', async () => {
    const pinia = createPinia()
    const wrapper = mount(LWorkspace, {
      global: {
        plugins: [router, pinia],
        stubs: {
          LContextMenu: true,
          LCreateBitModal: true,
          LBit: true,
          LTaskbar: true,
          LMenu: true,
        },
      },
    })
    await router.isReady()
    expect(wrapper).toBeTruthy()
  })

  it('should display workspace text', async () => {
    const pinia = createPinia()
    const wrapper = mount(LWorkspace, {
      global: {
        plugins: [router, pinia],
        stubs: {
          LContextMenu: true,
          LCreateBitModal: true,
          LBit: true,
          LTaskbar: true,
          LMenu: true,
        },
      },
    })
    await router.isReady()
    expect(wrapper.text()).toContain('Workspace')
  })
})
