<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import type { Component } from 'vue'

export type MenuSeparator = { type: 'separator' }

export type MenuAction = {
  type?: 'default' | 'danger'
  label: string
  icon?: string | Component
  disabled?: boolean
  action: () => void
}

export type MenuItem = MenuSeparator | MenuAction

type Props = {
  x: number
  y: number
  items: MenuItem[]
}

const props = defineProps<Props>()
const emit = defineEmits<{ close: [] }>()

const menuRef = ref<HTMLElement | null>(null)
const resolvedX = ref(props.x)
const resolvedY = ref(props.y)

const isSeparator = (item: MenuItem): item is MenuSeparator =>
  'type' in item && item.type === 'separator'

const asAction = (item: MenuItem): MenuAction => item as MenuAction

const isComponent = (icon: string | Component): icon is Component => typeof icon !== 'string'

const handleClickOutside = (event: MouseEvent) => {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
    emit('close')
  }
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') emit('close')
}

onMounted(async () => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeyDown)

  await nextTick()
  if (menuRef.value) {
    const { width, height } = menuRef.value.getBoundingClientRect()
    const padding = 8
    resolvedX.value = Math.min(props.x, window.innerWidth - width - padding)
    resolvedY.value = Math.min(props.y, window.innerHeight - height - padding)
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeyDown)
})

const handleItemClick = (item: MenuItem) => {
  if (isSeparator(item)) return
  const action = asAction(item)
  if (action.disabled) return
  action.action()
  emit('close')
}
</script>

<template>
  <Transition name="ctx-menu" appear>
    <div
      ref="menuRef"
      role="menu"
      class="ctx-menu material fixed z-[1000] min-w-[200px] rounded-[14px] p-1.5"
      :style="{
        left: `${resolvedX}px`,
        top: `${resolvedY}px`,
        transformOrigin: `${props.x - resolvedX}px ${props.y - resolvedY}px`,
      }"
    >
      <template v-for="(item, index) in items" :key="index">
        <!-- Separator -->
        <div v-if="isSeparator(item)" class="mx-2.5 my-1 h-px bg-[var(--separator)]" />

        <!-- Action item -->
        <button
          v-else
          role="menuitem"
          :disabled="asAction(item).disabled"
          class="group flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left text-[0.9375rem] tracking-[-0.005em] select-none"
          :class="[
            asAction(item).disabled
              ? 'cursor-not-allowed opacity-40'
              : asAction(item).type === 'danger'
                ? 'cursor-pointer text-red-500 hover:bg-red-500/10 active:bg-red-500/15'
                : 'cursor-pointer text-text1 hover:bg-[var(--fill-hover)] active:bg-[var(--fill-press)]',
          ]"
          @click="handleItemClick(item)"
        >
          <!-- Icon slot — always reserved for alignment -->
          <span
            class="flex h-4 w-4 shrink-0 items-center justify-center"
            :class="
              asAction(item).disabled
                ? ''
                : asAction(item).type === 'danger'
                  ? 'text-red-500'
                  : 'text-text2 group-hover:text-text1'
            "
          >
            <template v-if="asAction(item).icon">
              <component
                :is="asAction(item).icon"
                v-if="isComponent(asAction(item).icon!)"
                :size="14"
              />
              <span v-else class="text-xs leading-none">{{ asAction(item).icon }}</span>
            </template>
          </span>

          <span class="leading-none">{{ asAction(item).label }}</span>
        </button>
      </template>
    </div>
  </Transition>
</template>

<style scoped>
/* Grows out of the exact point that was clicked (transform-origin set inline) */
.ctx-menu-enter-active {
  transition:
    opacity 120ms ease,
    transform var(--spring-duration) var(--ease-spring);
}
.ctx-menu-leave-active {
  transition:
    opacity 100ms ease,
    transform 150ms ease;
}
.ctx-menu-enter-from,
.ctx-menu-leave-to {
  opacity: 0;
  transform: scale(0.88);
}

@media (prefers-reduced-motion: reduce) {
  .ctx-menu-enter-from,
  .ctx-menu-leave-to {
    transform: none;
  }
}
</style>
