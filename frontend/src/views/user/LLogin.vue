<script setup lang="ts">
import { useTheme } from '@/composables/useTheme.ts'
import { computed, onMounted, ref } from 'vue'
import router from '@/router'
import { useUserStore } from '@/stores/userStore'
import { storeToRefs } from 'pinia'
import { CircleAlert, LoaderCircle } from 'lucide-vue-next'

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
const isSubmitting = ref(false)

const userStore = useUserStore()
const { error } = storeToRefs(userStore)

async function handleLogin() {
  loginErrorMessage.value = ''
  isSubmitting.value = true
  try {
    await userStore.login(email.value, password.value)
    await router.push('/workspace')
  } catch {
    loginErrorMessage.value = error.value || 'Login failed.'
  } finally {
    isSubmitting.value = false
  }
}

function navigateToRegister() {
  router.push('/register')
}
</script>

<template>
  <div class="auth">
    <div class="auth__hero">
      <div class="text-center l-rise">
        <img :src="logoSrc" alt="Listion Logo" class="auth__logo" />
        <h2 class="auth__headline">Welcome to Listion</h2>
        <p class="auth__tagline">Your tasks. Your flow.</p>
      </div>
    </div>

    <div class="auth__side" :class="isDark ? 'bg-dotted-grid-dark' : 'bg-dotted-grid-light'">
      <div class="auth__card material--thick l-rise" style="animation-delay: 60ms">
        <h1 class="auth__title">Sign in</h1>
        <p class="auth__subtitle">Welcome back. Pick up where you left off.</p>
        <form class="auth__form" @submit.prevent="handleLogin">
          <label class="sr-only" for="login-email">E-Mail</label>
          <input
            id="login-email"
            v-model="email"
            type="email"
            autocomplete="email"
            required
            placeholder="E-Mail"
            class="l-input"
            :aria-invalid="!!loginErrorMessage"
          />
          <label class="sr-only" for="login-password">Password</label>
          <input
            id="login-password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
            placeholder="Password"
            class="l-input"
            :aria-invalid="!!loginErrorMessage"
          />
          <Transition name="error">
            <p v-if="loginErrorMessage" class="l-error" role="alert">
              <CircleAlert :size="14" />
              {{ loginErrorMessage }}
            </p>
          </Transition>
          <button type="submit" class="l-btn-primary mt-2" :disabled="isSubmitting">
            <LoaderCircle v-if="isSubmitting" :size="16" class="animate-spin" />
            {{ isSubmitting ? 'Signing in…' : 'Sign in' }}
          </button>
        </form>
        <p class="auth__switch">
          New to Listion?
          <a href="/register" class="l-link" @click.prevent="navigateToRegister"
            >Create an account</a
          >
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth {
  min-height: 100vh;
  display: flex;
  background: linear-gradient(135deg, var(--surface3), var(--surface1) 55%, var(--surface4));
}

.auth__hero {
  flex: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.auth__logo {
  height: 12rem;
  margin: 0 auto 1.5rem;
  opacity: 0.85;
}

.auth__headline {
  font-size: clamp(2rem, 3.5vw, 2.75rem);
  color: var(--text0);
  margin-bottom: 0.5rem;
}

.auth__tagline {
  font-size: 1.125rem;
  letter-spacing: -0.01em;
  color: var(--text1);
}

.auth__side {
  flex: 1;
  min-width: 380px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.5rem;
  background-color: var(--surface1);
  border-radius: 28px 0 0 28px;
  box-shadow: -12px 0 48px -16px hsl(var(--surface-shadow) / 0.35);
}

.auth__card {
  width: 100%;
  max-width: 22rem;
  padding: 2rem;
  border-radius: 22px;
  border: 1px solid var(--material-stroke);
}

.auth__title {
  font-size: 1.75rem;
  color: var(--text0);
  margin-bottom: 0.25rem;
}

.auth__subtitle {
  font-size: 0.9375rem;
  color: var(--text2);
  margin-bottom: 1.5rem;
}

.auth__form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.auth__switch {
  margin-top: 1.25rem;
  font-size: 0.875rem;
  color: var(--text2);
  text-align: center;
}

.error-enter-active,
.error-leave-active {
  transition:
    opacity 0.2s ease,
    transform var(--spring-duration) var(--ease-spring);
}
.error-enter-from,
.error-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* Small screens: stack instead of squeezing two columns */
@media (max-width: 767px) {
  .auth {
    flex-direction: column;
  }
  .auth__hero {
    flex: none;
    padding: 3rem 1.5rem 1.5rem;
  }
  .auth__logo {
    height: 6rem;
    margin-bottom: 1rem;
  }
  .auth__side {
    min-width: 0;
    flex: 1;
    border-radius: 28px 28px 0 0;
    align-items: flex-start;
  }
}
</style>
