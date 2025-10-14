import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/helpers/api'

export const useUserStore = defineStore('user', () => {
  const user = ref<{ email: string; name?: string } | null>(null)
  const isAuthenticated = ref(false)
  const error = ref<string | null>(null)

  async function register(email: string, password: string, username: string) {
    error.value = null
    try {
      const res = await api.post('/api/auth/register', { email, password, name: username })
      user.value = res.data.user
      isAuthenticated.value = true
    } catch (e: unknown) {
      error.value = (e as any)?.response?.data?.message || 'Registration failed.'
      throw e
    }
  }

  async function login(email: string, password: string) {
    error.value = null
    try {
      const res = await api.post('/api/auth/login', { email, password })
      user.value = res.data.user
      isAuthenticated.value = true
    } catch (e: unknown) {
      error.value = (e as any)?.response?.data?.message || 'Login failed.'
      throw e
    }
  }

  async function checkAuth() {
    try {
      const res = await api.get('/api/auth/me')
      if (res.data.user) {
        user.value = res.data.user
        isAuthenticated.value = true
      } else {
        user.value = null
        isAuthenticated.value = false
      }
    } catch {
      user.value = null
      isAuthenticated.value = false
    }
  }

  async function logout() {
    try {
      await api.post('/api/auth/logout')
    } catch (e) {
      console.error('Logout failed', e)
    } finally {
      user.value = null
      isAuthenticated.value = false
    }
  }

  return { user, isAuthenticated, error, register, login, checkAuth, logout }
})
