<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { LogOut, Sun, Moon } from 'lucide-vue-next'
import { useUserStore } from '@/stores/userStore'
import { useTheme } from '@/composables/useTheme.ts'

const isOpen = ref(false)
const menuRef = ref<HTMLElement | null>(null)
const userStore = useUserStore()
const router = useRouter()
const { isDark, toggle: toggleTheme } = useTheme()

const displayName = computed(() => userStore.user?.name || userStore.user?.email || 'Unknown')

const initials = computed(() => {
  const name = userStore.user?.name || userStore.user?.email || '?'
  return name
    .split(/[\s@._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join('')
})

async function handleLogout() {
  await userStore.logout()
  isOpen.value = false
  router.push('/login')
}

function handleClickOutside(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

function handleEscape(e: KeyboardEvent) {
  if (e.key === 'Escape') isOpen.value = false
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
  document.addEventListener('keydown', handleEscape)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', handleClickOutside)
  document.removeEventListener('keydown', handleEscape)
})
</script>

<template>
  <div ref="menuRef" class="fixed top-3 right-4 z-[9999]">
    <button
      class="menu-btn material--thin pressable"
      type="button"
      :aria-expanded="isOpen"
      aria-label="Menü öffnen"
      @click="isOpen = !isOpen"
    >
      <div class="menu__icon">
        <span class="menu__bar" :class="{ 'menu__bar--top-open': isOpen }" />
        <span class="menu__bar" :class="{ 'menu__bar--mid-open': isOpen }" />
        <span class="menu__bar" :class="{ 'menu__bar--bot-open': isOpen }" />
      </div>
    </button>

    <Transition name="dropdown">
      <div v-if="isOpen" class="dropdown material" role="menu">
        <div class="dropdown__header">
          <div class="avatar">{{ initials }}</div>
          <span class="dropdown__name">{{ displayName }}</span>
        </div>

        <div class="dropdown__body">
          <button
            class="menu-item menu-item--theme"
            type="button"
            role="menuitem"
            :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
            @click="toggleTheme"
          >
            <span class="theme-toggle">
              <Sun
                :size="15"
                class="theme-toggle__icon theme-toggle__icon--sun"
                :class="{ 'theme-toggle__icon--active': !isDark }"
              />
              <Moon
                :size="15"
                class="theme-toggle__icon theme-toggle__icon--moon"
                :class="{ 'theme-toggle__icon--active': isDark }"
              />
              <span class="theme-toggle__pill" :class="{ 'theme-toggle__pill--dark': isDark }" />
            </span>
            {{ isDark ? 'Dark mode' : 'Light mode' }}
          </button>

          <div class="dropdown__sep" />

          <button class="menu-item" type="button" role="menuitem" @click="handleLogout">
            <LogOut :size="15" class="shrink-0" />
            Logout
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* ── Trigger button ─────────────────────────────────────── */
.menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 18px;
  border: 1px solid var(--material-stroke);
  cursor: pointer;
}

.menu-btn:hover {
  background-color: var(--material-regular);
}

/* ── Hamburger icon ─────────────────────────────────────── */
.menu__icon {
  width: 16px;
  height: 11px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.menu__bar {
  display: block;
  width: 100%;
  height: 1.75px;
  border-radius: 2px;
  background-color: var(--text1);
  transform-origin: center;
  transition:
    transform var(--spring-duration) var(--ease-spring),
    opacity 0.2s ease;
}

.menu__bar--top-open {
  transform: translateY(4.6px) rotate(45deg);
}

.menu__bar--mid-open {
  opacity: 0;
  transform: scaleX(0.2);
}

.menu__bar--bot-open {
  transform: translateY(-4.6px) rotate(-45deg);
}

/* ── Dropdown panel ─────────────────────────────────────── */
.dropdown {
  position: absolute;
  right: 0;
  margin-top: 8px;
  width: 232px;
  border-radius: 16px;
  overflow: hidden;
  /* anchored to the trigger: grows out of the button, not from its own centre */
  transform-origin: top right;
}

.dropdown__header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 14px 10px;
}

.dropdown__name {
  font-size: 0.9375rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text0);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dropdown__body {
  padding: 4px 6px 6px;
}

.dropdown__sep {
  height: 1px;
  margin: 4px 10px;
  background: var(--separator);
}

/* ── Avatar ─────────────────────────────────────────────── */
.avatar {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(160deg, color-mix(in srgb, var(--brand) 75%, white), var(--brand));
  color: hsl(0 0% 100%);
  font-size: 0.75rem;
  font-weight: 650;
  letter-spacing: 0.02em;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── Menu item ──────────────────────────────────────────── */
.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border-radius: 10px;
  font-size: 0.9375rem;
  letter-spacing: -0.005em;
  color: var(--text1);
  cursor: pointer;
  transition: background-color 0.12s ease;
  text-align: left;
}

.menu-item:hover {
  background-color: var(--fill-hover);
  color: var(--text0);
}

/* highlight lands on press, instantly */
.menu-item:active {
  background-color: var(--fill-press);
  transition: none;
}

/* ── Theme toggle ───────────────────────────────────────── */
.menu-item--theme {
  justify-content: space-between;
}

.theme-toggle {
  position: relative;
  display: flex;
  align-items: center;
  width: 48px;
  height: 26px;
  border-radius: 999px;
  background-color: var(--fill-press);
  flex-shrink: 0;
  order: -1;
  transition: background-color 0.3s ease;
}

.theme-toggle__icon {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1;
  transition:
    color 0.2s ease,
    opacity 0.2s ease;
  color: var(--text2);
  opacity: 0.5;
}

.theme-toggle__icon--sun {
  left: 5px;
}

.theme-toggle__icon--moon {
  right: 5px;
}

.theme-toggle__icon--active {
  opacity: 1;
  color: var(--text0);
}

.theme-toggle__pill {
  position: absolute;
  left: 2px;
  top: 2px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background-color: var(--surface1);
  box-shadow:
    0 1px 2px hsl(0 0% 0% / 0.15),
    0 2px 6px hsl(0 0% 0% / 0.12);
  /* a toggle the user flicks may overshoot a touch */
  transition: transform var(--spring-duration) var(--ease-spring-bounce);
}

.theme-toggle__pill--dark {
  transform: translateX(22px);
}

/* ── Dropdown transition: materialize (scale + blur + opacity together) ── */
.dropdown-enter-active {
  transition:
    opacity 0.18s ease,
    transform var(--spring-duration) var(--ease-spring),
    filter 0.25s ease;
}
.dropdown-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.2s ease,
    filter 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: scale(0.9);
  filter: blur(4px);
}

@media (prefers-reduced-motion: reduce) {
  .dropdown-enter-from,
  .dropdown-leave-to {
    transform: none;
    filter: none;
  }
}
</style>
