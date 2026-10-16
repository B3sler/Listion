import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CreateFields } from '@/composables/useBitCommands'
import type { Rect } from '@/composables/useFlowLayout'

export type SheetView = 'capture' | 'detail'

/** One bit created in the open capture view; a failed create keeps what a retry needs. */
export interface SeriesEntry {
  id: string
  failed: boolean
  fields?: CreateFields
  pos?: { x: number; y: number }
}

/** The translucent preview of where the next captured bit lands (canvas coordinates). */
export interface Ghost {
  x: number
  y: number
  h: number
  title: string
  color: string
}

/**
 * What the bit sheet shows. Opening and closing *move* through `LBitSheet`'s gesture: the
 * open actions show it at once, `close()` runs once the slide out has come to rest.
 */
export const useSheetStore = defineStore('sheet', () => {
  const open = ref(false)
  const view = ref<SheetView>('capture')
  const bitId = ref<string | null>(null)
  /** Canvas point the capture view was opened at. */
  const origin = ref({ x: 0, y: 0 })
  /** Flow the captured bits join (the click point lay in its frame). */
  const flowId = ref<string | null>(null)
  const series = ref<SeriesEntry[]>([])
  /** How far the sheet is in view, 0 … SHEET_WIDTH px, live from the gesture. */
  const revealed = ref(0)
  /** Set by the capture view while it is shown; the workspace draws it and keeps it in view. */
  const ghost = ref<Ghost | null>(null)
  /** Where the last bit of the series was placed; the next one lines up below it. */
  const lastRect = ref<Rect | null>(null)
  /** Colour the next captured bit keeps from the previous one (null: the default). */
  const seriesColor = ref<string | null>(null)
  /** The bit just created from the series: its capsule materialises out of the ghost. */
  const materializeId = ref<string | null>(null)

  /** A new series starts; the ghost follows from the capture view (it recomputes on its own). */
  function resetSeries() {
    series.value = []
    lastRect.value = null
    seriesColor.value = null
    materializeId.value = null
  }

  function openCapture(at: { x: number; y: number }, flow: string | null) {
    resetSeries()
    origin.value = { x: at.x, y: at.y }
    flowId.value = flow
    bitId.value = null
    view.value = 'capture'
    open.value = true
  }

  function openDetail(id: string) {
    bitId.value = id
    view.value = 'detail'
    open.value = true
  }

  function backToCapture() {
    bitId.value = null
    view.value = 'capture'
  }

  function close() {
    open.value = false
    resetSeries()
    ghost.value = null
  }

  return {
    open,
    view,
    bitId,
    origin,
    flowId,
    series,
    revealed,
    ghost,
    lastRect,
    seriesColor,
    materializeId,
    openCapture,
    openDetail,
    backToCapture,
    close,
  }
})
