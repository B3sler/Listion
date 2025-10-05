import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import LLandingPage from './layout/LLandingPage.vue'
import LWorkspace from './layout/LWorkspace.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: LLandingPage },
    { path: '/workspace', component: LWorkspace },
  ],
})

describe('App', () => {
  it('should render without crashing', async () => {
    const wrapper = mount(App, {
      global: {
        plugins: [router],
      },
    })
    await router.isReady()
    expect(wrapper).toBeTruthy()
  })

  it('should render RouterView', async () => {
    const wrapper = mount(App, {
      global: {
        plugins: [router],
      },
    })
    await router.isReady()
    expect(wrapper.html()).toBeTruthy()
  })

  it('should render LLandingPage on root path', async () => {
    const wrapper = mount(App, {
      global: {
        plugins: [router],
      },
    })
    await router.push('/')
    await router.isReady()
    expect(wrapper.text()).toContain('Modern Task Management')
  })
})
