import { describe, it, expect } from 'vitest'
import detailSource from './LBitDetailView.vue?raw'
import segmentedSource from './LSegmented.vue?raw'

// jsdom has no layout, so these pin the CSS contracts that a real browser check found missing.
describe('sheet CSS contracts', () => {
  it('lets the detail body scroll instead of shrinking its children', () => {
    const body = /\.detail__body\s*\{[^}]*overflow-y:\s*auto/.test(detailSource)
    const noShrink = /\.detail__body\s*>\s*:deep\(\*\)\s*\{[^}]*flex-shrink:\s*0/.test(detailSource)
    expect(body).toBe(true)
    expect(noShrink).toBe(true)
  })

  it('keeps the notes cap at 12 lines', () => {
    expect(detailSource).toMatch(/\.detail__notes\s*\{[^}]*max-height:\s*calc\(12 \* 1\.5em/)
  })

  it('lifts the selected segmented pill in dark mode', () => {
    expect(segmentedSource).toMatch(/\.theme-dark\s+\.segmented__pill\s*\{[^}]*color-mix/)
    expect(segmentedSource).toMatch(
      /\.theme-dark\s+\.segmented__item--active\s*\{[^}]*font-weight:\s*600/,
    )
  })
})
