import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
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
    const wrapper = mount(LWorkspace, {
      global: {
        plugins: [router],
      },
    })
    await router.isReady()
    expect(wrapper).toBeTruthy()
  })

  it('should display workspace text', async () => {
    const wrapper = mount(LWorkspace, {
      global: {
        plugins: [router],
      },
    })
    await router.isReady()
    expect(wrapper.text()).toContain('Workspace')
  })
})
