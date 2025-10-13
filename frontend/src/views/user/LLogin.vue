<script setup lang="ts">
import { useTheme } from '@/composables/useTheme.ts'
import { computed, onMounted, ref } from 'vue'
import router from '@/router'

const { initTheme, applyTheme, isDark } = useTheme()

onMounted(() => {
  initTheme()
  applyTheme()
})

const logoSrc = computed(() =>
  isDark.value ? '/listion/listion_written_light.svg' : '/listion/listion_written_dark.svg',
)

const email = ref('')
const password = ref('')
const loginErrorMessage = ref('')

function handleLogin() {
  loginErrorMessage.value = 'Login function not implemented yet.'
}

function navigateToRegister() {
  router.push('/register')
}
</script>

<template>
  <div class="min-h-screen flex bg-gradient-to-br from-surface3 via-surface1 to-surface4">
    <div class="w-2/3 flex items-center justify-center">
      <div class="text-center">
        <img :src="logoSrc" alt="Listion Logo" class="h-60 mx-auto mb-6 opacity-80" />
        <h2 class="text-4xl font-bold text-text0 mb-4">Welcome to Listion!</h2>
        <p class="text-lg text-text1">Your tasks. Your flow.</p>
      </div>
    </div>
    <div
      class="w-1/3 flex items-center justify-center bg-surface1 rounded-l-3xl shadow-2xl"
      :class="isDark ? 'bg-dotted-grid-dark' : 'bg-dotted-grid-light'"
    >
      <div
        class="w-full max-w-sm bg-surface2 border-2 border-gray-300 rounded-xl shadow-lg p-8 flex flex-col items-center"
      >
        <h1 class="text-3xl font-bold mb-2 text-text0">Login</h1>
        <p class="mb-6 text-text1">Welcome back! Please login.</p>
        <form class="w-full flex flex-col gap-4" @submit.prevent="handleLogin">
          <input
            v-model="email"
            type="email"
            required
            placeholder="E-Mail"
            class="text-text0 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <input
            v-model="password"
            type="password"
            required
            placeholder="Password"
            class="text-text0 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <p v-if="loginErrorMessage" class="text-red-500 text-sm mt-2">
            {{ loginErrorMessage }}
          </p>
          <button
            type="submit"
            class="mt-2 bg-brand text-white font-semibold py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Login
          </button>
        </form>
        <div class="w-full flex justify-between mt-4 text-sm">
          <!--          <a href="#" class="text-blue-500 hover:underline">Forgot your password?</a>-->
          <a href="#" class="text-blue-500 hover:underline" @click.prevent="navigateToRegister"
            >Don't have an account yet?</a
          >
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
