<script lang="ts" setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useTheme } from '@/composables/useTheme.ts'
import { Hand, Ruler, ChartGantt, SlidersHorizontal, ArrowRight } from 'lucide-vue-next'

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
    icon: Hand,
    title: 'Drag & Drop',
    description: 'Intuitive task and group management via drag & drop',
  },
  {
    icon: Ruler,
    title: 'Visual Task Sizing',
    description: 'Quick effort estimation through visual sizing',
  },
  {
    icon: ChartGantt,
    title: 'Timeline Planning',
    description: 'Timeline-style planning with dependencies',
  },
  {
    icon: SlidersHorizontal,
    title: 'Smart Filters',
    description: 'Filter by status, priority and tags',
  },
]
</script>

<template>
  <div class="landing">
    <div class="mx-auto max-w-6xl px-4 py-16 md:px-6">
      <div class="flex min-h-[80vh] flex-col items-center justify-center text-center">
        <img :src="logoSrc" alt="Listion Logo" class="landing__logo l-rise" />

        <div class="mt-6 max-w-3xl l-rise" style="animation-delay: 50ms">
          <h1 class="landing__title">Modern Task Management</h1>
          <p class="landing__lead">
            Workspace-based with visual sizing, drag &amp; drop and timeline planning
          </p>
        </div>

        <button
          class="l-btn-primary landing__cta l-rise"
          style="animation-delay: 100ms"
          @click="navigateToLogin"
        >
          Sign in
          <ArrowRight :size="18" class="landing__cta-arrow" />
        </button>

        <div class="mt-20 grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div
            v-for="(feature, index) in features"
            :key="index"
            class="feature material l-rise"
            :style="{ animationDelay: `${150 + index * 40}ms` }"
          >
            <div class="feature__icon">
              <component :is="feature.icon" :size="20" />
            </div>
            <h3 class="feature__title">{{ feature.title }}</h3>
            <p class="feature__text">{{ feature.description }}</p>
          </div>
        </div>

        <div class="landing__footer">
          <p>
            by
            <a class="l-link" href="https://github.com/B3sler" rel="noopener" target="_blank"
              >@B3sler</a
            >
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.landing {
  min-height: 100vh;
  background:
    radial-gradient(
      1200px 600px at 50% -10%,
      color-mix(in srgb, var(--brand) 14%, transparent),
      transparent 70%
    ),
    linear-gradient(160deg, var(--surface2), var(--surface1) 60%, var(--surface2));
}

.landing__logo {
  height: 14rem;
  width: auto;
}

.landing__title {
  font-size: clamp(2.5rem, 6vw, 4.25rem);
  line-height: 1.04;
  letter-spacing: -0.035em;
  color: var(--text0);
}

.landing__lead {
  margin-top: 1rem;
  font-size: clamp(1.125rem, 2vw, 1.375rem);
  line-height: 1.4;
  letter-spacing: -0.012em;
  color: var(--text1);
}

.landing__cta {
  margin-top: 2.5rem;
  padding: 0.875rem 1.75rem;
  border-radius: 999px;
  font-size: 1.0625rem;
  box-shadow: 0 8px 24px -8px color-mix(in srgb, var(--brand) 60%, transparent);
}

/* the arrow hints in the direction the button takes you */
.landing__cta-arrow {
  transition: transform var(--spring-duration) var(--ease-spring);
}
.landing__cta:hover .landing__cta-arrow {
  transform: translateX(3px);
}

.feature {
  padding: 1.5rem;
  border-radius: 20px;
  text-align: left;
}

.feature__icon {
  width: 2.5rem;
  height: 2.5rem;
  margin-bottom: 1rem;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: color-mix(in srgb, var(--brand) 75%, var(--text0));
  background-color: color-mix(in srgb, var(--brand) 14%, transparent);
}

.feature__title {
  font-size: 1.0625rem;
  color: var(--text0);
  margin-bottom: 0.375rem;
}

.feature__text {
  font-size: 0.9375rem;
  line-height: 1.45;
  color: var(--text2);
}

.landing__footer {
  margin-top: 4rem;
  padding-top: 2rem;
  border-top: 1px solid var(--separator);
  font-size: 0.875rem;
  color: var(--text2);
}

@media (max-width: 767px) {
  .landing__logo {
    height: 8rem;
  }
}
</style>
