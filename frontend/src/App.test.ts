import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: { template: '<div>Home</div>' } },
    { path: '/about', component: { template: '<div>About</div>' } }
  ]
})

describe('App', () => {
  it('should render without crashing', async () => {
    const wrapper = mount(App, {
      global: {
        plugins: [router]
      }
    })
    await router.isReady()
    expect(wrapper).toBeTruthy()
  })

  it('should have the correct component structure', async () => {
    const wrapper = mount(App, {
      global: {
        plugins: [router]
      }
    })
    await router.isReady()
    expect(wrapper.find('#app')).toBeTruthy()
  })
})
