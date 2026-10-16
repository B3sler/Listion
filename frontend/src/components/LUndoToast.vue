<script setup lang="ts">
import { prefersReducedMotion, Spring } from '@/helpers/motion'
import { useHistoryStore } from '@/stores/historyStore'

const history = useHistoryStore()

/** How far below its resting place the toast starts and ends, in px. */
const OFFSET = 12
/** Reduced motion: no travel, the toast only fades. */
const FADE_MS = 150

// One spring per toast element, on the offset in px. Opacity follows the offset, so a toast that
// is dismissed halfway in reverses from where it is, with the velocity it has.
const springs = new WeakMap<Element, Spring>()

function paint(el: HTMLElement, offset: number) {
  el.style.transform = `translateY(${offset}px)`
  el.style.opacity = String(Math.min(1, Math.max(0, 1 - offset / OFFSET)))
}

function springOf(el: Element): Spring {
  let spring = springs.get(el)
  if (!spring) {
    spring = new Spring(OFFSET, (v) => paint(el as HTMLElement, v))
    springs.set(el, spring)
  }
  return spring
}

function fade(el: HTMLElement, to: 0 | 1, done: () => void) {
  el.style.transition = `opacity ${FADE_MS}ms ease`
  // the start value must be painted before the transition has something to run from
  if (to === 1) el.style.opacity = '0'
  void el.offsetWidth
  el.style.opacity = String(to)
  setTimeout(done, FADE_MS)
}

function onEnter(el: Element, done: () => void) {
  const target = el as HTMLElement
  if (prefersReducedMotion()) {
    fade(target, 1, () => {
      target.style.transition = ''
      done()
    })
    return
  }
  const spring = springOf(el)
  spring.set(OFFSET)
  spring.to(0, {
    onRest: () => {
      // at rest the toast carries no inline transform, so nothing keeps a layer of its own
      target.style.transform = ''
      target.style.opacity = ''
      done()
    },
  })
}

function onLeave(el: Element, done: () => void) {
  if (prefersReducedMotion()) {
    fade(el as HTMLElement, 0, done)
    return
  }
  // retargets the running enter, if any, instead of restarting
  springOf(el).to(OFFSET, { onRest: done })
}
</script>

<template>
  <div class="toast-host">
    <Transition :css="false" mode="out-in" @enter="onEnter" @leave="onLeave">
      <div
        v-if="history.toast"
        :key="history.toast.id"
        class="toast material material--regular"
        role="status"
        aria-live="polite"
        @mouseenter="history.pauseToast()"
        @mouseleave="history.resumeToast()"
      >
        <span class="toast__message">{{ history.toast.message }}</span>
        <button
          v-if="history.toast.undoable"
          type="button"
          class="toast__undo pressable"
          @click="history.undoToast()"
        >
          Undo
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* The host spans the width only to centre the pill; it must not swallow clicks on the canvas. */
.toast-host {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 24px;
  /* above the sheet (100), so Undo stays reachable when a narrow viewport puts them side by side */
  z-index: 110;
  display: flex;
  justify-content: center;
  padding: 0 16px;
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  padding: 6px 6px 6px 16px;
  border-radius: 999px;
  color: var(--text0);
  font-size: 0.875rem;
  line-height: 1.25rem;
}

.toast__message {
  padding: 4px 8px 4px 0;
  overflow-wrap: anywhere;
}

.toast__undo {
  flex: none;
  min-height: 32px;
  padding: 0 14px;
  border-radius: 999px;
  color: var(--brand);
  font-size: inherit;
  font-weight: 600;
}
.toast__undo:hover {
  background-color: var(--fill-hover);
}
.toast__undo:active {
  background-color: var(--fill-press);
}
.toast__undo:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--brand) 70%, transparent);
  outline-offset: -2px;
}
</style>
