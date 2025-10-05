<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const navigateToWorkspace = () => {
  router.push('/workspace')
}

const features = [
  {
    icon: '🎯',
    title: 'Drag & Drop',
    description: 'Intuitive Aufgaben- und Gruppenverwaltung per Drag & Drop',
  },
  {
    icon: '📊',
    title: 'Visuelle Task-Größen',
    description: 'Schnelle Aufwandseinschätzung durch visuelle Sizing',
  },
  {
    icon: '📅',
    title: 'Timeline-Planung',
    description: 'Timeline-Style Planning mit Abhängigkeiten',
  },
  {
    icon: '🔍',
    title: 'Smart Filter',
    description: 'Filtere nach Status, Priorität und Tags',
  },
]
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
    <div class="container mx-auto px-4 py-16">
      <div class="flex flex-col items-center justify-center text-center space-y-8 min-h-[80vh]">
        <div class="animate-fade-in">
          <img
            src="/listion/listion_written_light.svg"
            alt="Listion Logo"
            class="h-80 md:h-56 w-auto"
          />
        </div>

        <div class="space-y-4 max-w-3xl">
          <h1 class="text-4xl md:text-6xl font-bold text-white">Moderne Task-Verwaltung</h1>
          <p class="text-xl md:text-2xl text-slate-300">
            Worpace-based mit visuellem Sizing, Drag & Drop und Timeline-Planung
          </p>
        </div>

        <button
          @click="navigateToWorkspace"
          class="group relative px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
        >
          <span class="flex items-center gap-2">
            Zum Workspace >
          </span>
        </button>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-16 w-full max-w-6xl">
          <div
            v-for="(feature, index) in features"
            :key="index"
            class="bg-slate-800/50 backdrop-blur-sm p-6 rounded-lg border border-slate-700 hover:border-blue-500 transition-all duration-300 hover:transform hover:scale-105"
          >
            <div class="text-4xl mb-3">{{ feature.icon }}</div>
            <h3 class="text-lg font-semibold text-white mb-2">{{ feature.title }}</h3>
            <p class="text-sm text-slate-400">{{ feature.description }}</p>
          </div>
        </div>
        <div class="mt-16 pt-8 border-t border-slate-700 max-w-4xl">
          <p class="text-slate-400 text-sm">
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
