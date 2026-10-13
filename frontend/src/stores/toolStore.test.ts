import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { FILTER_STORAGE_KEY, useToolStore } from './toolStore'

function key(k: string, target: EventTarget = document.body, extra: KeyboardEventInit = {}) {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, ...extra })
  Object.defineProperty(e, 'target', { value: target })
  return e
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('toolStore', () => {
  it('V / F / Esc schalten Werkzeuge, Esc schließt den Filter', () => {
    const s = useToolStore()
    expect(s.handleShortcut(key('f'))).toBe(true)
    expect(s.activeTool).toBe('flow')
    s.filterOpen = true
    expect(s.handleShortcut(key('Escape'))).toBe(true)
    expect(s.activeTool).toBe('select')
    expect(s.filterOpen).toBe(false)
    s.setTool('flow')
    s.handleShortcut(key('V'))
    expect(s.activeTool).toBe('select')
  })

  it('ignoriert Kürzel in Eingabefeldern und mit Modifikatoren', () => {
    const s = useToolStore()
    const input = document.createElement('input')
    const textarea = document.createElement('textarea')
    const editable = document.createElement('div')
    editable.contentEditable = 'true'
    expect(s.handleShortcut(key('f', input))).toBe(false)
    expect(s.handleShortcut(key('f', textarea))).toBe(false)
    expect(s.handleShortcut(key('f', editable))).toBe(false)
    expect(s.handleShortcut(key('f', document.body, { ctrlKey: true }))).toBe(false)
    expect(s.activeTool).toBe('select')
  })

  it('zählt, speichert und setzt Filter zurück', () => {
    const s = useToolStore()
    s.toggleFilter('workflow', 'ready')
    s.toggleFilter('priority', 3)
    s.toggleFilter('due', 'today')
    s.toggleFilter('due', 'today')
    expect(s.activeFilterCount).toBe(2)
    expect(JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY)!)).toEqual({
      workflow: ['ready'],
      priority: [3],
      due: [],
    })
    setActivePinia(createPinia())
    expect(useToolStore().activeFilterCount).toBe(2)
    useToolStore().resetFilters()
    expect(useToolStore().activeFilterCount).toBe(0)
  })

  it('startet mit leeren Filtern bei kaputtem localStorage', () => {
    localStorage.setItem(FILTER_STORAGE_KEY, '{not json')
    expect(useToolStore().filters).toEqual({ workflow: [], priority: [], due: [] })
    setActivePinia(createPinia())
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({ workflow: 'x', priority: [9, 2] }))
    expect(useToolStore().filters).toEqual({ workflow: [], priority: [2], due: [] })
  })
})
