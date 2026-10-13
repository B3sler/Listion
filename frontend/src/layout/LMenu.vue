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
      class="menu-btn"
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
      <div v-if="isOpen" class="dropdown" role="menu">
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
  border-radius: 10px;
  background-color: var(--surface2);
  border: 1px solid var(--surface3);
  cursor: pointer;
  transition:
    background-color 0.2s,
    border-color 0.2s;
}

.menu-btn:hover {
  background-color: var(--surface3);
}

/* ── Hamburger icon ─────────────────────────────────────── */
.menu__icon {
  width: 18px;
  height: 12px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.menu__bar {
  display: block;
  width: 100%;
  height: 2px;
  border-radius: 2px;
  background-color: var(--text1);
  transform-origin: center;
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
}

.menu__bar--top-open {
  transform: translateY(5px) rotate(45deg);
}

.menu__bar--mid-open {
  opacity: 0;
  transform: scaleX(0);
}

.menu__bar--bot-open {
  transform: translateY(-5px) rotate(-45deg);
}

/* ── Dropdown panel ─────────────────────────────────────── */
.dropdown {
  position: absolute;
  right: 0;
  margin-top: 8px;
  width: 220px;
  border-radius: 12px;
  background-color: var(--surface2);
  border: 1px solid var(--surface3);
  box-shadow:
    0 4px 6px -1px hsl(var(--surface-shadow) / calc(var(--shadow-strength) + 0.05)),
    0 10px 15px -3px hsl(var(--surface-shadow) / var(--shadow-strength));
  overflow: hidden;
}

.dropdown__header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--surface3);
}

.dropdown__name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dropdown__body {
  padding: 6px;
}

/* ── Avatar ─────────────────────────────────────────────── */
.avatar {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: var(--brand);
  color: hsl(0 0% 100%);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── Menu item ──────────────────────────────────────────── */
.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 0.875rem;
  color: var(--text1);
  cursor: pointer;
  transition: background-color 0.15s;
  text-align: left;
}

.menu-item:hover {
  background-color: var(--surface3);
  color: var(--text0);
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
  height: 24px;
  border-radius: 999px;
  background-color: var(--surface3);
  border: 1px solid var(--surface3);
  flex-shrink: 0;
  order: -1;
}

.theme-toggle__icon {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  transition:
    color 0.2s ease,
    opacity 0.2s ease;
  color: var(--text2);
  opacity: 0.4;
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
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: var(--text1);
  transition: transform 0.25s ease;
}

.theme-toggle__pill--dark {
  transform: translateX(24px);
}

/* ── Dropdown transition ────────────────────────────────── */
.dropdown-enter-active,
.dropdown-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.97);
}
</style>
