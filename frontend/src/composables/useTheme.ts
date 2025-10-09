import { ref, onMounted } from 'vue'

const isDark = ref<boolean | null>(null)
let initialized = false

function applyTheme() {
  const root = document.documentElement
  if (isDark.value) root.classList.add('theme-dark')
  else root.classList.remove('theme-dark')
}

function initTheme() {
  if (initialized) return
  const saved = localStorage.getItem('theme')
  if (saved === 'dark' || saved === 'light') {
    isDark.value = saved === 'dark'
  } else {
    isDark.value = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  initialized = true
  applyTheme()
}

export function useTheme() {
  onMounted(() => {
    initTheme()
  })

  const toggle = () => {
    if (isDark.value === null) {
      initTheme()
    }
    isDark.value = !isDark.value
    localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
    applyTheme()
  }

  return {
    isDark,
    initTheme,
    applyTheme,
    toggle,
  }
}
