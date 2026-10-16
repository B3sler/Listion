import { describe, it, expect } from 'vitest'
import taskbarSource from './LTaskbar.vue?raw'
import pillSource from '@/components/LFocusPill.vue?raw'

// jsdom has no layout, so these pin the CSS contracts that keep the focus pill off the logo.
describe('focus pill CSS contracts', () => {
  it('makes the taskbar end column a size container the pill can query', () => {
    expect(taskbarSource).toMatch(
      /\.taskbar__end\s*\{[^}]*container:\s*taskbar-end\s*\/\s*inline-size/,
    )
    expect(taskbarSource).toMatch(/class="taskbar__end[^"]*"/)
  })

  it('shows only the dot and the time when the column gets narrow', () => {
    const narrow = /@container taskbar-end \(max-width: 200px\)\s*\{([\s\S]*?)\n\}/.exec(pillSource)
    expect(narrow).not.toBeNull()
    expect(narrow![1]).toMatch(/\.focus-pill__label[^{]*\{[^}]*clip/)
    expect(narrow![1]).toMatch(/\.focus-pill__stop\s*\{[^}]*display:\s*none/)
  })

  it('clips the pill instead of letting it spill onto the logo', () => {
    expect(pillSource).toMatch(/\.focus-pill\s*\{[^}]*overflow:\s*hidden/)
  })

  it('lets the whole pill open the bit, with stop on top', () => {
    expect(pillSource).toMatch(/\.focus-pill__title::after\s*\{[^}]*inset:\s*0/)
    expect(pillSource).toMatch(/\.focus-pill__stop\s*\{[^}]*z-index:\s*1/)
  })
})
