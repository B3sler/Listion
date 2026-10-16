import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CreateFields } from '@/composables/useBitCommands'

export type SheetView = 'capture' | 'detail'

/** One bit created in the open capture view; a failed create keeps its fields for a retry. */
export interface SeriesEntry {
  id: string
  failed: boolean
  fields?: CreateFields
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

  function openCapture(at: { x: number; y: number }, flow: string | null) {
    origin.value = { x: at.x, y: at.y }
    flowId.value = flow
    series.value = []
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
    series.value = []
  }

  return {
    open,
    view,
    bitId,
    origin,
    flowId,
    series,
    revealed,
    openCapture,
    openDetail,
    backToCapture,
    close,
  }
})
