<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div id="app" class="min-h-screen bg-white">
    <header class="bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center py-4">
          <div class="flex items-center">
            <h1 class="text-2xl font-bold text-gray-900">Listion</h1>
          </div>
          <nav class="flex space-x-8">
            <RouterLink
              to="/"
              class="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200"
              active-class="text-blue-600 bg-blue-50"
            >
              Home
            </RouterLink>
            <RouterLink
              to="/about"
              class="text-gray-500 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200"
              active-class="text-blue-600 bg-blue-50"
            >
              About
            </RouterLink>
          </nav>
        </div>
      </div>
    </header>

    <main>
      <RouterView />
    </main>
  </div>
</template>
