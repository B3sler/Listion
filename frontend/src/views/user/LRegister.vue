<script setup lang="ts">
import { useTheme } from '@/composables/useTheme.ts'
import { computed, onMounted, ref } from 'vue'
import router from '@/router'
import { useUserStore } from '@/stores/userStore'
import { storeToRefs } from 'pinia'
import { CircleAlert, CircleCheck, LoaderCircle } from 'lucide-vue-next'

const { initTheme, applyTheme, isDark } = useTheme()

onMounted(() => {
  initTheme()
  applyTheme()
})

const logoSrc = computed(() =>
  isDark.value ? '/listion/listion_written_light.svg' : '/listion/listion_written_dark.svg',
)

const email = ref('')
const username = ref('')
const password = ref('')
const passwordRepeat = ref('')
const registerErrorMessage = ref('')
const isSubmitting = ref(false)

// Validate inline while typing, not only on submit
const repeatTouched = computed(() => passwordRepeat.value.length > 0)
const passwordsMatch = computed(() => password.value === passwordRepeat.value)
const showMismatch = computed(
  () =>
    repeatTouched.value &&
    !passwordsMatch.value &&
    passwordRepeat.value.length >= Math.min(password.value.length, 3),
)

const userStore = useUserStore()
const { error } = storeToRefs(userStore)

async function handleRegister() {
  registerErrorMessage.value = ''
  if (!passwordsMatch.value) {
    registerErrorMessage.value = "Passwords don't match."
    return
  }
  isSubmitting.value = true
  try {
    await userStore.register(email.value, password.value, username.value)
    await router.push('/workspace')
  } catch {
    registerErrorMessage.value = error.value || 'Registration failed.'
  } finally {
    isSubmitting.value = false
  }
}

function navigateToLogin() {
  router.push('/login')
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
        <h1 class="auth__title">Create account</h1>
        <p class="auth__subtitle">It takes less than a minute.</p>
        <form class="auth__form" @submit.prevent="handleRegister">
          <label class="sr-only" for="reg-email">E-Mail</label>
          <input
            id="reg-email"
            v-model="email"
            type="email"
            autocomplete="email"
            required
            placeholder="E-Mail"
            class="l-input"
          />
          <label class="sr-only" for="reg-username">Username</label>
          <input
            id="reg-username"
            v-model="username"
            type="text"
            autocomplete="username"
            required
            placeholder="Username"
            class="l-input"
          />
          <label class="sr-only" for="reg-password">Password</label>
          <input
            id="reg-password"
            v-model="password"
            type="password"
            autocomplete="new-password"
            required
            placeholder="Password"
            class="l-input"
          />
          <Transition name="reveal">
            <div v-if="password" class="relative">
              <label class="sr-only" for="reg-password-repeat">Repeat password</label>
              <input
                id="reg-password-repeat"
                v-model="passwordRepeat"
                required
                type="password"
                autocomplete="new-password"
                placeholder="Repeat password"
                class="l-input pr-10"
                :aria-invalid="showMismatch"
                aria-describedby="reg-password-hint"
              />
              <Transition name="fade-icon">
                <CircleCheck
                  v-if="repeatTouched && passwordsMatch"
                  :size="18"
                  class="match-icon"
                  aria-hidden="true"
                />
              </Transition>
            </div>
          </Transition>
          <Transition name="error">
            <p v-if="showMismatch" id="reg-password-hint" class="l-error">
              <CircleAlert :size="14" />
              Passwords don't match yet.
            </p>
          </Transition>
          <Transition name="error">
            <p v-if="registerErrorMessage" class="l-error" role="alert">
              <CircleAlert :size="14" />
              {{ registerErrorMessage }}
            </p>
          </Transition>
          <button type="submit" class="l-btn-primary mt-2" :disabled="isSubmitting">
            <LoaderCircle v-if="isSubmitting" :size="16" class="animate-spin" />
            {{ isSubmitting ? 'Creating account…' : 'Create account' }}
          </button>
        </form>
        <p class="auth__switch">
          Already have an account?
          <a href="/login" class="l-link" @click.prevent="navigateToLogin">Sign in</a>
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

.match-icon {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  translate: 0 -50%;
  color: #10b981;
  pointer-events: none;
}

.reveal-enter-active,
.reveal-leave-active {
  transition:
    opacity 0.2s ease,
    transform var(--spring-duration) var(--ease-spring);
}
.reveal-enter-from,
.reveal-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.fade-icon-enter-active,
.fade-icon-leave-active {
  transition:
    opacity 0.15s ease,
    scale var(--spring-duration) var(--ease-spring-bounce);
}
.fade-icon-enter-from,
.fade-icon-leave-to {
  opacity: 0;
  scale: 0.6;
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
