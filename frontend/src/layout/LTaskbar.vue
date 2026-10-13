<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme.ts'
const { isDark } = useTheme()

// Dark taskbar in light mode → light logo; light taskbar in dark mode → dark logo
const logoSrc = computed(() =>
  isDark.value ? '/listion/listion_written_dark.svg' : '/listion/listion_written_light.svg',
)
</script>

<template>
  <div class="fixed top-0 left-0 w-full h-14 flex z-60">
    <div class="flex flex-1 justify-end z-60">
      <svg
        class="h-6"
        style="color: var(--taskbar)"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1024 1024"
      >
        <path d="M1024,1024C1024,458,566,0,0,0h1024v1024Z" fill="currentColor" />
      </svg>
    </div>
    <div class="flex-[0.7] flex items-center justify-center rounded-b-2xl bg-taskbar shadow-lg">
      <img :src="logoSrc" alt="Listion Logo" class="h-8" />
    </div>
    <div class="flex-1">
      <svg
        class="h-6"
        style="color: var(--taskbar)"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1024 1024"
      >
        <path d="M0,0h1024C458,0,0,458,0,1024V0Z" fill="currentColor" />
      </svg>
    </div>
  </div>
</template>

<style scoped></style>
