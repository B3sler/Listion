import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/helpers/api'

export const useUserStore = defineStore('user', () => {
  const user = ref<{ email: string; name?: string } | null>(null)
  const token = ref<string | null>(null)
  const isAuthenticated = ref(false)
  const error = ref<string | null>(null)

  async function register(email: string, password: string, username: string) {
    error.value = null
    try {
      const res = await api.post('/api/auth/register', { email, password, name: username })
      user.value = res.data.user
      token.value = res.data.token
      isAuthenticated.value = true
    }  catch (e: unknown) {
      if (typeof e === 'object' && e !== null && 'response' in e) {
        error.value = (e as { response?: { data?: { message?: string } } }).response?.data?.message || 'Registration failed.'
      } else {
        error.value = 'Registration failed.'
      }
    }
  }

  async function login(email: string, password: string) {
    error.value = null
    try {
      const res = await api.post('/api/auth/login', { email, password })
      user.value = res.data.user
      token.value = res.data.token
      isAuthenticated.value = true
    } catch (e: unknown) {
      if (typeof e === 'object' && e !== null && 'response' in e) {
        error.value = (e as { response?: { data?: { message?: string } } }).response?.data?.message || 'Login failed.'
      } else {
        error.value = 'Login failed.'
      }
    }
  }

  function logout() {
    user.value = null
    token.value = null
    isAuthenticated.value = false
  }

  return { user, token, isAuthenticated, error, register, login, logout }
})
