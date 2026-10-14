import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import type { PacketCard } from '@/types/flow'
import LPacketsHud from './LPacketsHud.vue'

const card = (key: string): PacketCard => ({
  key,
  name: `Packet ${key}`,
  bitIds: [`${key}0`],
  total: 2,
  done: 1,
  inProgress: 0,
  blocked: 0,
  ready: 1,
  cycles: 0,
  percent: 50,
})

describe('LPacketsHud', () => {
  it('meldet Hervorheben mit der Packet-ID', async () => {
    const w = mount(LPacketsHud, { props: { cards: [card('7')] } })
    await w.find('.packet-name').trigger('click')
    expect(w.emitted('highlight')).toEqual([['7']])
    expect(w.find('.packet-card').classes()).toContain('packet-card--highlighted')
  })

  it('verwirft die Hervorhebung, wenn das Packet verschwindet und wieder auftaucht', async () => {
    const w = mount(LPacketsHud, { props: { cards: [card('7')] } })
    await w.find('.packet-name').trigger('click')
    await w.setProps({ cards: [] })
    await w.setProps({ cards: [card('7')] })
    expect(w.find('.packet-card').classes()).not.toContain('packet-card--highlighted')
    await w.find('.packet-name').trigger('click')
    expect(w.emitted('highlight')).toEqual([['7'], ['7']])
    expect(w.emitted('unhighlight')).toBeUndefined()
  })
})
