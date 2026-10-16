import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useBitStore } from './bitStore'

export const FOCUS_KEY = 'listion.focus'
export const FOCUS_PENDING_KEY = 'listion.focus.pending'

/** Shorter sessions are not booked (a mis-click, not work). */
export const MIN_BOOKED_SECONDS = 5
/** A timer left running is capped to 12 h when stopped (a forgotten timer). */
export const MAX_BOOKED_SECONDS = 12 * 3600
/** The backend takes 1 … 86400 s per request. */
const MAX_REQUEST_SECONDS = 86400

export interface RunningFocus {
  bitId: string
  /** Epoch ms. */
  startedAt: number
}

/** Per-viewer convenience: anything unreadable simply means "nothing stored". */
function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as unknown) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage may be unavailable; the timer still runs for this page */
  }
}

function loadRunning(): RunningFocus | null {
  const raw = readJson(FOCUS_KEY)
  if (!raw || typeof raw !== 'object') return null
  const { bitId, startedAt } = raw as Record<string, unknown>
  if (typeof bitId !== 'string' || !bitId) return null
  if (typeof startedAt !== 'number' || !Number.isFinite(startedAt)) return null
  return { bitId, startedAt }
}

function loadPending(): Record<string, number> {
  const raw = readJson(FOCUS_PENDING_KEY)
  const result: Record<string, number> = {}
  if (!raw || typeof raw !== 'object') return result
  for (const [bitId, seconds] of Object.entries(raw)) {
    if (typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0) {
      result[bitId] = Math.floor(seconds)
    }
  }
  return result
}

function isNotFound(e: unknown): boolean {
  return (e as { response?: { status?: number } } | null)?.response?.status === 404
}

function secondsSince(startedAt: number): number {
  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
}

export const useFocusStore = defineStore('focus', () => {
  const bitStore = useBitStore()

  const running = ref<RunningFocus | null>(null)
  /** Seconds of the running timer; ticks once a second while one runs. */
  const elapsed = ref(0)
  /** Time that could not be booked yet (bitId -> seconds), sent on the next load or stop. */
  const pending = loadPending()

  let interval: ReturnType<typeof setInterval> | null = null

  function tick() {
    elapsed.value = running.value ? secondsSince(running.value.startedAt) : 0
  }

  function startTicking() {
    stopTicking()
    tick()
    interval = setInterval(tick, 1000)
  }

  function stopTicking() {
    if (interval !== null) clearInterval(interval)
    interval = null
  }

  /** Ends the running timer locally and returns what it was. */
  function clearRunning(): RunningFocus | null {
    const was = running.value
    running.value = null
    elapsed.value = 0
    stopTicking()
    writeJson(FOCUS_KEY, null)
    return was
  }

  function savePending() {
    writeJson(FOCUS_PENDING_KEY, Object.keys(pending).length ? pending : null)
  }

  function addPending(bitId: string, seconds: number) {
    pending[bitId] = (pending[bitId] ?? 0) + seconds
    savePending()
  }

  function takePending(bitId: string, seconds: number) {
    const left = (pending[bitId] ?? 0) - seconds
    if (left > 0) pending[bitId] = left
    else delete pending[bitId]
    savePending()
  }

  /** Books time on a bit. A failure keeps it for later; a bit the server no longer has drops it. */
  async function book(bitId: string, seconds: number): Promise<boolean> {
    try {
      await bitStore.addFocus(bitId, seconds)
      return true
    } catch (e) {
      if (!isNotFound(e)) addPending(bitId, seconds)
      return false
    }
  }

  let flushing: Promise<void> | null = null

  async function flushAll() {
    for (const bitId of Object.keys(pending)) {
      let remaining = pending[bitId] ?? 0
      while (remaining > 0) {
        const chunk = Math.min(remaining, MAX_REQUEST_SECONDS)
        try {
          await bitStore.addFocus(bitId, chunk)
        } catch (e) {
          if (isNotFound(e)) {
            delete pending[bitId]
            savePending()
          }
          break
        }
        takePending(bitId, chunk)
        remaining -= chunk
      }
    }
  }

  /** Sends what earlier failed bookings left behind. Never rejects; what fails stays queued. */
  function flushPending(): Promise<void> {
    if (!flushing) {
      flushing = flushAll().finally(() => {
        flushing = null
      })
    }
    return flushing
  }

  /** Starts the stopwatch on a bit; a timer on another bit is stopped and booked first. */
  function start(bitId: string): void {
    if (running.value?.bitId === bitId) return
    if (running.value) void stop()
    running.value = { bitId, startedAt: Date.now() }
    writeJson(FOCUS_KEY, running.value)
    startTicking()
  }

  /** Stops and books the time (capped at 12 h, nothing under 5 s). Never rejects. */
  async function stop(): Promise<void> {
    const was = clearRunning()
    if (!was) return
    const seconds = Math.min(secondsSince(was.startedAt), MAX_BOOKED_SECONDS)
    const ok = seconds < MIN_BOOKED_SECONDS ? true : await book(was.bitId, seconds)
    if (ok) await flushPending()
  }

  /** Ends the timer without booking (the bit is gone). */
  function cancel(): void {
    clearRunning()
  }

  /** Picks a timer up again after a reload; the stopwatch runs on wall-clock time. */
  function restore(): void {
    if (running.value) return
    const stored = loadRunning()
    if (!stored) return
    running.value = stored
    startTicking()
  }

  return { running, elapsed, start, stop, cancel, restore, flushPending }
})
