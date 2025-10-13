import { createRouter, createWebHistory } from 'vue-router'
import LWorkspace from '@/views/LWorkspace.vue'
import LLandingPage from '@/views/LLandingPage.vue'
import LLogin from '@/views/user/LLogin.vue'
import LRegister from '@/views/user/LRegister.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LLogin,
      children: [],
    },
    {
      path: '/register',
      name: 'register',
      component: LRegister,
      children: [],
    },
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
