<script setup lang="ts">
import { computed } from 'vue'
import { Trash2 } from 'lucide-vue-next'
import type { SaveState } from '@/composables/useBitEditor'

interface Props {
  createdAt: string
  saveState: SaveState
  /** A status change (complete, reopen) failed and waits for Retry. */
  failed: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{ retry: []; delete: [] }>()

const created = computed(() =>
  new Date(props.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
)
</script>

<template>
  <footer class="detail__footer">
    <div class="detail__meta">
      <span class="detail__created">Created {{ created }}</span>
      <span class="detail__save" role="status" aria-live="polite">
        <template v-if="saveState === 'saving'">Saving…</template>
        <template v-else-if="saveState === 'error' || failed">
          Couldn’t save ·
          <button type="button" class="detail__retry pressable" @click="emit('retry')">
            Retry
          </button>
        </template>
      </span>
    </div>
    <button type="button" class="detail__delete pressable" @click="emit('delete')">
      <Trash2 :size="13" aria-hidden="true" />
      Delete
    </button>
  </footer>
</template>

<style scoped>
.detail__footer {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  flex: none;
  padding: 10px 12px 14px 20px;
}

.detail__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  color: var(--text2);
  font-size: 0.75rem;
  letter-spacing: 0.005em;
}
.detail__save:empty {
  display: none;
}

.detail__retry {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--brand);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  outline: none;
}

.detail__delete {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px 0 10px;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: hsl(0 72% 52%);
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 550;
  letter-spacing: -0.005em;
  cursor: pointer;
  outline: none;
}
.detail__delete:hover {
  background-color: hsl(0 72% 50% / 0.1);
}

.detail__retry:focus-visible,
.detail__delete:focus-visible {
  box-shadow: 0 0 0 2px var(--brand);
}
</style>
