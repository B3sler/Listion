<script setup lang="ts">
import { ref } from 'vue'
import { useUserStore } from '@/stores/userStore'
import router from '@/router'

const isOpen = ref(false)
const userStore = useUserStore()

function handleLogout() {
  userStore.logout()
  router.push('/login')
  isOpen.value = false
}
</script>

<template>
  <div class="fixed top-2 right-4 z-[9999]">
    <button @click="isOpen = !isOpen" class="background group" aria-label="Open Menu" type="button">
      <div class="menu__icon w-8 h-8 p-1">
        <span
          class="menu__bar block w-full h-0.75 rounded transition duration-400 group-hover:menu__bar-top"
        ></span>
        <span
          class="menu__bar block w-full h-0.75 rounded transition duration-400 group-hover:menu__bar-scaled"
        ></span>
        <span
          class="menu__bar block w-full h-0.75 rounded transition duration-400 group-hover:menu__bar-bottom"
        ></span>
      </div>
    </button>
    <div
      v-if="isOpen"
      class="absolute animate-fade-in right-0 p-3 mt-2 w-56 bg-surface2 rounded-lg shadow-lg border border-gray-200 flex flex-col items-end py-2 z-[9999]"
    >
      <div class="mb-4 text-text1 font-semibold text-lg">
        {{ userStore.user?.name || userStore.user?.email || 'unknown' }}
      </div>
      <button
        @click="handleLogout"
        class="self-center w-40 px-6 py-3 bg-gradient-to-br from-surface3 to-surface4 text-text0 font-semibold text-base rounded-xl shadow-lg hover:shadow-sm hover:shadow-red-100 hover:scale-105"
        type="button"
      >
        Logout
      </button>
    </div>
  </div>
</template>

<style scoped>
.menu__icon {
  width: 32px;
  height: 32px;
  padding: 4px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.menu__icon span {
  display: block;
  width: 100%;
  height: 0.125rem;
  border-radius: 2px;
  background-color: var(--brand);
  box-shadow: 0.5px 2px 0 hsla(0, 0%, 0%, 0.2);
  transition: background-color 0.4s;
  position: relative;
}

.menu__icon span + span {
  margin-top: 0.375rem;
}

.menu__bar {
  animation: ease 0.8s menu-icon-top-2 forwards;
}

.menu__bar + .menu__bar {
  animation: ease 0.8s menu-icon-scaled-2 forwards;
}

.menu__bar + .menu__bar + .menu__bar {
  animation: ease 0.8s menu-icon-bottom-2 forwards;
}

.group:hover .menu__bar:first-child {
  animation: ease 0.8s menu-icon-top forwards;
}

.group:hover .menu__bar:nth-child(2) {
  animation: ease 0.8s menu-icon-scaled forwards;
}

.group:hover .menu__bar:last-child {
  animation: ease 0.8s menu-icon-bottom forwards;
  background-color: rgb(22, 189, 11);
}

@keyframes menu-icon-top {
  0% {
    top: 0;
    transform: rotate(0);
  }
  50% {
    top: 0.5rem;
    transform: rotate(0);
  }
  100% {
    top: 0.5rem;
    transform: rotate(45deg);
  }
}

@keyframes menu-icon-top-2 {
  0% {
    top: 0.5rem;
    transform: rotate(45deg);
  }
  50% {
    top: 0.5rem;
    transform: rotate(0);
  }
  100% {
    top: 0;
    transform: rotate(0);
  }
}

@keyframes menu-icon-bottom {
  0% {
    bottom: 0;
    transform: rotate(0);
  }
  50% {
    bottom: 0.5rem;
    transform: rotate(0);
  }
  100% {
    bottom: 0.5rem;
    transform: rotate(135deg);
  }
}

@keyframes menu-icon-bottom-2 {
  0% {
    bottom: 0.5rem;
    transform: rotate(135deg);
  }
  50% {
    bottom: 0.5rem;
    transform: rotate(0);
  }
  100% {
    bottom: 0;
    transform: rotate(0);
  }
}

@keyframes menu-icon-scaled {
  50% {
    transform: scale(0);
  }
  100% {
    transform: scale(0);
  }
}

@keyframes menu-icon-scaled-2 {
  0% {
    transform: scale(0);
  }
  50% {
    transform: scale(0);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translatex(+40px);
  }
  to {
    opacity: 1;
    transform: translatex(0);
  }
}

.animate-fade-in {
  animation: fade-in 1s ease-out;
}
</style>
