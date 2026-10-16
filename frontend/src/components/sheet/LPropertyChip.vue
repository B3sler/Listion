<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, useTemplateRef, watch, type Component } from 'vue'
import { X } from 'lucide-vue-next'
import { Spring } from '@/helpers/motion'

interface Props {
  icon: Component
  label: string
  set: boolean
  expanded: boolean
  tone?: 'default' | 'danger'
}

const props = withDefaults(defineProps<Props>(), { tone: 'default' })
const emit = defineEmits<{ toggle: []; clear: [] }>()

const regionId = `chip-region-${useId()}`
const button = useTemplateRef<HTMLButtonElement>('button')
const region = useTemplateRef<HTMLElement>('region')

// The slot stays rendered through the closing animation and is unmounted once it rests.
const rendered = ref(props.expanded)
// null = natural height (at rest, so content may grow, e.g. a month with six rows)
const height = ref<number | null>(null)
const spring = new Spring(0, (v) => (height.value = v))

function settle() {
  height.value = null
}

watch(
  () => props.expanded,
  async (open) => {
    if (open) {
      if (!rendered.value) {
        spring.set(0)
        rendered.value = true
      } else if (height.value === null) {
        spring.set(region.value?.offsetHeight ?? 0)
      }
      await nextTick()
      const el = region.value
      if (!el) return
      spring.to(el.scrollHeight, { onRest: settle })
    } else {
      const el = region.value
      if (!el) {
        rendered.value = false
        return
      }
      if (height.value === null) spring.set(el.offsetHeight)
      spring.to(0, {
        onRest: () => {
          rendered.value = false
          settle()
        },
      })
    }
  },
)

function onEscape(event: KeyboardEvent) {
  // closes this picker only; the sheet's own Esc handling must not also fire
  event.stopPropagation()
  emit('toggle')
  button.value?.focus()
}

onBeforeUnmount(() => spring.stop())
</script>

<template>
  <div class="property">
    <div
      class="chip"
      :class="{
        'chip--set': set,
        'chip--danger': tone === 'danger',
        'chip--open': expanded,
      }"
    >
      <button
        ref="button"
        type="button"
        class="chip__btn pressable"
        :class="{ 'chip__btn--clearable': set }"
        :aria-expanded="expanded"
        :aria-controls="regionId"
        @click="emit('toggle')"
      >
        <component :is="icon" class="chip__icon" :size="14" aria-hidden="true" />
        <span class="chip__label">{{ label }}</span>
      </button>
      <button
        v-if="set"
        type="button"
        class="chip__clear pressable"
        :aria-label="`Clear ${label}`"
        @click.stop="emit('clear')"
      >
        <X :size="12" aria-hidden="true" />
      </button>
    </div>

    <div
      :id="regionId"
      ref="region"
      class="chip__region"
      :class="{ 'chip__region--animating': height !== null }"
      :style="height !== null ? { height: `${height}px` } : undefined"
      @keydown.esc="onEscape"
    >
      <slot v-if="rendered" />
    </div>
  </div>
</template>

<style scoped>
.property {
  min-width: 0;
}

.chip {
  --chip-fg: var(--text2);
  --chip-bg: var(--fill-hover);
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  height: 30px;
  border-radius: 999px;
  background-color: var(--chip-bg);
  color: var(--chip-fg);
}
.chip--set {
  --chip-fg: var(--text0);
  --chip-bg: var(--fill-press);
}
.chip--danger {
  --chip-fg: hsl(0 72% 52%);
  --chip-bg: hsl(0 72% 52% / 0.12);
}

.chip__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  height: 100%;
  padding: 0 12px 0 10px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: inherit;
  font-family: inherit;
  font-size: 0.8125rem;
  font-weight: 550;
  letter-spacing: -0.005em;
  white-space: nowrap;
  cursor: pointer;
  outline: none;
}
.chip__btn--clearable {
  padding-right: 6px;
}
.chip__icon {
  flex: none;
}
.chip__label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.chip__clear {
  display: grid;
  place-items: center;
  flex: none;
  width: 20px;
  height: 20px;
  margin-right: 5px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  opacity: 0.7;
  cursor: pointer;
  outline: none;
}
.chip__clear:hover {
  opacity: 1;
  background-color: var(--fill-hover);
}

.chip:hover .chip__btn {
  filter: brightness(1.04);
}
.chip__btn:focus-visible,
.chip__clear:focus-visible {
  box-shadow: 0 0 0 2px var(--brand);
}

.chip__region {
  display: flow-root;
}
/* clip only while the height is driven; at rest nothing may cut off focus rings */
.chip__region--animating {
  overflow: hidden;
}
</style>
