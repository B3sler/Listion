<script setup lang="ts">
import { ref, onMounted } from 'vue'
import TheWelcome from '../components/TheWelcome.vue'

// Mini-Contract: Holt /api/ping und zeigt ok + app an
// Erfolge: zeigt Daten; Fehler: zeigt Meldung; Ladezustand: "Lade..."
type PingResponse = { ok: boolean; app: string }

const loading = ref(true)
const error = ref<string | null>(null)
const data = ref<PingResponse | null>(null)

onMounted(async () => {
  try {
    const res = await fetch('/api/ping', { headers: { Accept: 'application/json' } })
    if (!res.ok) {
      error.value = `HTTP ${res.status}`
      return
    }
    data.value = await res.json()
  }  finally {
    loading.value = false
  }
})
</script>

<template>
  <main class="space-y-6">
    <!-- Sichtbarer Tailwind-Nachweis -->
    <section
      class="rounded-xl border border-emerald-300/50 bg-emerald-50 dark:bg-emerald-900/20 p-6 shadow-sm"
    >
      <h2 class="text-xl font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
        <span class="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
        Tailwind ist aktiv
      </h2>
      <p class="mt-2 text-sm text-emerald-800/80 dark:text-emerald-200/80">
        Dieser Block nutzt Tailwind-Klassen (Farben, Abstände, Schatten, Animation).
      </p>
    </section>

    <!-- Backend-Check: Holt /api/ping und zeigt das Ergebnis -->
    <section class="rounded-xl border p-6 shadow-sm">
      <h3 class="text-lg font-medium">Backend-Check</h3>
      <div class="mt-3">
        <div v-if="loading" class="text-gray-500">Lade...</div>
        <div v-else-if="error" class="text-red-600">Fehler: {{ error }}</div>
        <div v-else class="space-y-1">
          <div class="text-gray-700">
            Status:
            <span class="font-mono px-2 py-0.5 rounded bg-gray-100">{{ data?.ok ? 'OK' : 'NOK' }}</span>
          </div>
          <div class="text-gray-700">
            App: <span class="font-semibold">{{ data?.app }}</span>
          </div>
          <button
            class="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 active:scale-95 transition"
          >
            Tailwind Button
          </button>
        </div>
      </div>
    </section>

    <TheWelcome />
  </main>
</template>
