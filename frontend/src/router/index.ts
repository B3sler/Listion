import { createRouter, createWebHistory } from 'vue-router'
import LWorkspace from '@/layout/LWorkspace.vue'
import LLandingPage from '@/layout/LLandingPage.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: LLandingPage,
      children: [],
    },
    {
      path: '/workspace',
      name: 'workspace',
      component: LWorkspace,
      children: [],
    },
  ],
})

export default router
