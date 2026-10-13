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
      class="fixed z-[1000] min-w-[200px] rounded-xl border border-surface3/60 bg-surface2 py-1.5 shadow-[0_8px_24px_-4px_hsl(var(--surface-shadow)/0.4)]"
      :style="{ left: `${resolvedX}px`, top: `${resolvedY}px` }"
    >
      <template v-for="(item, index) in items" :key="index">
        <!-- Separator -->
        <div v-if="isSeparator(item)" class="mx-2 my-1.5 h-px bg-surface3/70" />

        <!-- Action item -->
        <button
          v-else
          role="menuitem"
          :disabled="asAction(item).disabled"
          class="group flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors duration-100 select-none"
          :class="[
            asAction(item).disabled
              ? 'cursor-not-allowed opacity-40'
              : asAction(item).type === 'danger'
                ? 'cursor-pointer text-red-500 hover:bg-red-500/10 active:bg-red-500/15'
                : 'cursor-pointer text-text1 hover:bg-surface3 active:bg-surface3/80',
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
.ctx-menu-enter-active {
  transition:
    opacity 130ms ease,
    transform 130ms ease;
}
.ctx-menu-leave-active {
  transition:
    opacity 80ms ease,
    transform 80ms ease;
}
.ctx-menu-enter-from,
.ctx-menu-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-4px);
}
</style>
