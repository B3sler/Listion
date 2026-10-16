import { computed, inject, onScopeDispose, ref, watch, type Ref } from 'vue'
import api from '@/helpers/api'
import { useBitStore, type Bit } from '@/stores/bitStore'
import { useHistoryStore } from '@/stores/historyStore'
import { BIT_COMMANDS, type UpdateMeta } from './useBitCommands'

type TextField = 'title' | 'notes'
export type SaveState = 'idle' | 'saving' | 'error'

const TEXT_DEBOUNCE_MS = 400
const SAVING_AFTER_MS = 500
const SHAKE_MS = 240

const TEXT_META: Record<TextField, UpdateMeta> = {
  title: { label: 'Rename', coalesce: 'title' },
  notes: { label: 'Edit notes', coalesce: 'notes' },
}

/**
 * Draft of the open detail view, saved live: chips at once via `set`, title and notes 400 ms
 * after the last keystroke. `flush()` sends any waiting text now; it runs on blur, on a bit
 * switch and on unmount (sheet closed); on `pagehide` it goes out as a keepalive fetch. A failed save keeps the draft so `retry`
 * can send it again, even though the store has rolled the bit back.
 */
export function useBitEditor(bitId: Ref<string | null>) {
  const commands = inject(BIT_COMMANDS)
  if (!commands) throw new Error('useBitEditor needs BIT_COMMANDS to be provided')
  const bitStore = useBitStore()
  const history = useHistoryStore()

  const bit = computed(() => bitStore.bits.find((b) => b.id === bitId.value) ?? null)

  const title = ref('')
  const notes = ref('')
  const saveState = ref<SaveState>('idle')
  const shake = ref(false)

  // Text the user typed that the store has not confirmed yet (waiting, in flight or failed).
  // While a field is in here, store changes do not overwrite the field.
  const drafts = new Map<TextField, string>()
  const timers = new Map<TextField, ReturnType<typeof setTimeout>>()
  /** Fields whose last save failed, with the value that failed; retry sends them again. */
  let failed: Partial<Bit> = {}
  let inflight = 0
  let savingTimer: ReturnType<typeof setTimeout> | null = null
  let shakeTimer: ReturnType<typeof setTimeout> | null = null

  function hasFailed(): boolean {
    return Object.keys(failed).length > 0
  }

  function settleState() {
    if (hasFailed()) saveState.value = 'error'
    else if (inflight === 0) saveState.value = 'idle'
  }

  async function send(id: string, patch: Partial<Bit>, meta: UpdateMeta): Promise<void> {
    inflight++
    if (inflight === 1) {
      savingTimer = setTimeout(() => {
        savingTimer = null
        if (inflight > 0 && !hasFailed()) saveState.value = 'saving'
      }, SAVING_AFTER_MS)
    }
    try {
      await commands!.update(id, patch, meta)
      // a save for a bit no longer open must not touch this bit's draft or error state
      if (id === bitId.value) {
        for (const k of Object.keys(patch) as (keyof Bit)[]) {
          // saves of one bit go out in order, so this one supersedes an earlier failure
          delete failed[k]
          // a newer keystroke since this save keeps its draft
          if ((k === 'title' || k === 'notes') && drafts.get(k) === patch[k]) drafts.delete(k)
        }
      }
    } catch {
      if (id === bitId.value) failed = { ...failed, ...patch }
    } finally {
      inflight--
      if (inflight === 0 && savingTimer) {
        clearTimeout(savingTimer)
        savingTimer = null
      }
      settleState()
    }
  }

  function load(b: Bit | null) {
    title.value = b?.title ?? ''
    notes.value = b?.notes ?? ''
  }

  // Follow outside changes (undo, another tab's reload) unless the user has a draft there.
  watch(
    () => bit.value?.title,
    (t) => {
      if (t !== undefined && !drafts.has('title')) title.value = t
    },
  )
  watch(
    () => bit.value?.notes,
    (n) => {
      if (!drafts.has('notes')) notes.value = n ?? ''
    },
  )

  function schedule(field: TextField) {
    const old = timers.get(field)
    if (old) clearTimeout(old)
    timers.set(
      field,
      setTimeout(() => void flushFor(bitId.value, [field]), TEXT_DEBOUNCE_MS),
    )
  }

  function onTitleInput(v: string) {
    title.value = v
    drafts.set('title', v)
    if (v.trim() === '') {
      // an empty title is never sent; blur brings the saved one back
      const t = timers.get('title')
      if (t) clearTimeout(t)
      timers.delete('title')
      return
    }
    schedule('title')
  }

  function onNotesInput(v: string) {
    notes.value = v
    drafts.set('notes', v)
    schedule('notes')
  }

  /** Sends the waiting text of `fields` (default: all) for `id` from the current field values. */
  function flushFor(id: string | null, fields: TextField[] = [...timers.keys()]): Promise<void> {
    const waiting = fields.filter((f) => timers.has(f))
    for (const field of waiting) {
      clearTimeout(timers.get(field))
      timers.delete(field)
    }
    if (!id) return Promise.resolve()
    const sends: Promise<void>[] = []
    for (const field of waiting) {
      const value = field === 'title' ? title.value : notes.value
      if (field === 'title' && value.trim() === '') continue
      sends.push(send(id, { [field]: value }, TEXT_META[field]))
    }
    return Promise.all(sends).then(() => undefined)
  }

  function flush(): Promise<void> {
    return flushFor(bitId.value)
  }

  async function onTextBlur(): Promise<void> {
    if (title.value.trim() === '') {
      const timer = timers.get('title')
      if (timer) clearTimeout(timer)
      timers.delete('title')
      drafts.delete('title')
      title.value = bit.value?.title ?? ''
      shake.value = true
      if (shakeTimer) clearTimeout(shakeTimer)
      shakeTimer = setTimeout(() => {
        shake.value = false
        shakeTimer = null
      }, SHAKE_MS)
    } else if (title.value !== title.value.trim()) {
      onTitleInput(title.value.trim())
    }
    // the send above happens synchronously, so the typing step is complete when it is sealed
    const flushed = flush()
    history.seal()
    await flushed
  }

  async function set(patch: Partial<Bit>, label: string): Promise<void> {
    const id = bitId.value
    if (!id) return
    await send(id, patch, { label })
  }

  /** Sends what failed again, with the current text in place of the text that failed. */
  async function retry(): Promise<void> {
    const id = bitId.value
    if (!id) return
    const patch: Partial<Bit> = { ...failed }
    if ('title' in patch) {
      if (title.value.trim() === '') delete patch.title
      else patch.title = title.value
    }
    if ('notes' in patch) patch.notes = notes.value
    for (const field of ['title', 'notes'] as const) {
      // text still waiting for its debounce goes along
      if (timers.has(field) && (field !== 'title' || title.value.trim() !== '')) {
        patch[field] = field === 'title' ? title.value : notes.value
      }
    }
    for (const t of timers.values()) clearTimeout(t)
    timers.clear()
    failed = {}
    settleState()
    if (Object.keys(patch).length === 0) return
    await send(id, patch, { label: 'Retry' })
  }

  watch(
    bitId,
    (_next, prev) => {
      // the old bit's waiting text goes out first, with the values still on screen
      void flushFor(prev)
      drafts.clear()
      failed = {}
      shake.value = false
      settleState()
      load(bit.value)
    },
    { flush: 'sync' },
  )

  /**
   * The page goes away: an axios request may be cancelled with it, so the waiting text goes out
   * as one keepalive PUT that outlives the page. Nothing is recorded; the page is gone.
   */
  function onPageHide() {
    const id = bitId.value
    const patch: Partial<Bit> = {}
    for (const field of [...timers.keys()]) {
      clearTimeout(timers.get(field))
      timers.delete(field)
      const value = field === 'title' ? title.value : notes.value
      if (field === 'title' && value.trim() === '') continue
      patch[field] = value
    }
    if (!id || Object.keys(patch).length === 0) return
    void fetch(`${api.defaults.baseURL ?? ''}/api/bit/${id}`, {
      method: 'PUT',
      keepalive: true,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).catch(() => {})
  }
  if (typeof window !== 'undefined') window.addEventListener('pagehide', onPageHide)

  onScopeDispose(() => {
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', onPageHide)
    void flush()
    if (savingTimer) clearTimeout(savingTimer)
    if (shakeTimer) clearTimeout(shakeTimer)
  })

  load(bit.value)

  return {
    bit,
    title,
    notes,
    onTitleInput,
    onNotesInput,
    onTextBlur,
    set,
    flush,
    saveState,
    retry,
    shake,
  }
}
