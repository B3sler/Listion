<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useTheme } from '@/composables/useTheme.ts'

const router = useRouter()
const { isDark } = useTheme()

const navigateToLogin = () => {
  router.push('/login')
}

const logoSrc = computed(() =>
  isDark.value ? '/listion/listion_written_light.svg' : '/listion/listion_written_dark.svg',
)

const features = [
  {
    icon: '🎯',
    title: 'Drag & Drop',
    description: 'Intuitive task and group management via drag & drop',
  },
  {
    icon: '📊',
    title: 'Visual Task Sizing',
    description: 'Quick effort estimation through visual sizing',
  },
  {
    icon: '📅',
    title: 'Timeline Planning',
    description: 'Timeline-style planning with dependencies',
  },
  { icon: '🔍', title: 'Smart Filters', description: 'Filter by status, priority and tags' },
]
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-surface2 via-surface3 to-surface2">
    <div class="container mx-auto px-4 py-16">
      <div class="flex flex-col items-center justify-center text-center space-y-8 min-h-[80vh]">
        <div class="animate-fade-in">
          <img :src="logoSrc" alt="Listion Logo" class="h-80 md:h-56 w-auto" />
        </div>

        <div class="space-y-4 max-w-3xl">
          <h1 class="text-4xl md:text-6xl font-bold text-text0">Modern Task Management</h1>
          <p class="text-xl md:text-2xl text-text1">
            Workspace-based with visual sizing, drag & drop and timeline planning
          </p>
        </div>

        <button
          @click="navigateToLogin"
          class="group relative px-8 py-4 bg-brand hover:bg-blue-500 text-white text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
        >
          <span class="flex items-center gap-2"> Login > </span>
        </button>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-16 w-full max-w-6xl">
          <div
            v-for="(feature, index) in features"
            :key="index"
            class="bg-surface1 p-6 rounded-lg border border-surface3 hover:bg-surface2 transition-all duration-300 hover:transform hover:scale-105 shadow-lg"
          >
            <div class="text-4xl mb-3">{{ feature.icon }}</div>
            <h3 class="text-lg font-semibold text-text1 mb-2">{{ feature.title }}</h3>
            <p class="text-sm text-text2">{{ feature.description }}</p>
          </div>
        </div>

        <div class="mt-16 pt-8 border-t border-surface3 max-w-4xl">
          <p class="text-text2 text-sm">
            by
            <a
              href="https://github.com/B3sler"
              target="_blank"
              rel="noopener"
              class="underline hover:text-blue-400"
              >@B3sler</a
            >
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fade-in 1s ease-out;
}
</style>
