import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: {
        template: `
          <div class="min-h-screen bg-gray-50 py-12">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div class="text-center">
                <h1 class="text-4xl font-bold text-gray-900 mb-4">Willkommen bei Listion</h1>
                <p class="text-xl text-gray-600">Ihre Anwendung ist bereit für die Entwicklung.</p>
              </div>
            </div>
          </div>
        `
      }
    },
    {
      path: '/about',
      name: 'about',
      component: {
        template: `
          <div class="min-h-screen bg-gray-50 py-12">
            <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
              <div class="text-center">
                <h1 class="text-4xl font-bold text-gray-900 mb-6">Über Listion</h1>
                <p class="text-lg text-gray-600 leading-relaxed">
                  Dies ist die About-Seite Ihrer Anwendung.
                </p>
              </div>
            </div>
          </div>
        `
      }
    }
  ]
})

export default router
