import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'
import LLandingPage from './LLandingPage.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: LLandingPage },
    { path: '/workspace', component: { template: '<div>Workspace</div>' } },
  ],
})

describe('LLandingPage', () => {
  it('should render without crashing', async () => {
    const wrapper = mount(LLandingPage, {
      global: {
        plugins: [router],
      },
    })
    await router.isReady()
    expect(wrapper).toBeTruthy()
  })

  it('should display the Listion logo', async () => {
    const wrapper = mount(LLandingPage, {
      global: {
        plugins: [router],
      },
    })
    await router.isReady()
    const logo = wrapper.find('img[alt="Listion Logo"]')
    expect(logo.exists()).toBe(true)
    expect(logo.attributes('src')).toBe('/listion/listion_written_light.svg')
  })

  it('should display the main heading', async () => {
    const wrapper = mount(LLandingPage, {
      global: {
        plugins: [router],
      },
    })
    await router.isReady()
    const heading = wrapper.find('h1')
    expect(heading.exists()).toBe(true)
    expect(heading.text()).toContain('Moderne Task-Verwaltung')
  })

  it('should display feature cards', async () => {
    const wrapper = mount(LLandingPage, {
      global: {
        plugins: [router],
      },
    })
    await router.isReady()
    const features = wrapper.text()
    expect(features).toContain('Drag & Drop')
    expect(features).toContain('Visuelle Task-Größen')
    expect(features).toContain('Timeline-Planung')
    expect(features).toContain('Smart Filter')
  })
})
