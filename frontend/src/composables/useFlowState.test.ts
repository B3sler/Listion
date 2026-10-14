import { describe, it, expect } from 'vitest'
import type { Bit } from '@/stores/bitStore'
import type { Dependency, Packet } from '@/types/flow'
import { computeFlowState, isValidLink } from './useFlowState'

const bit = (id: string, status = 0, packetId: string | null = null, order = 0): Bit => ({
  id,
  title: `B${id}`,
  status,
  x: 0,
  y: 0,
  packetId,
  order,
  createdAt: '',
})
const packet = (id: string): Packet => ({ id, name: `P${id}`, x: 0, y: 0 })
let nextId = 1
const dep = (
  fromType: 'bit' | 'packet',
  fromId: string,
  toType: 'bit' | 'packet',
  toId: string,
): Dependency => ({
  id: `d${nextId++}`,
  fromType,
  fromId,
  toType,
  toId,
})

describe('computeFlowState', () => {
  it('Stapel: erster Schritt neutral, Nachfolger ready/blocked', () => {
    const s = computeFlowState(
      [bit('1', 2, 'p1', 0), bit('2', 0, 'p1', 1), bit('3', 0, 'p1', 2)],
      [packet('p1')],
      [],
    )
    expect(s.bitState.get('1')).toBeNull()
    expect(s.bitState.get('2')).toBe('ready')
    expect(s.bitState.get('3')).toBe('blocked')
  })

  it('erster offener Schritt ohne Abhängigkeiten ist neutral', () => {
    const s = computeFlowState([bit('1', 0, 'p1', 0), bit('2', 0, 'p1', 1)], [packet('p1')], [])
    expect(s.bitState.get('1')).toBeNull()
  })

  it('gleiche Reihenfolge: die früher erzeugte ID ist der erste Schritt', () => {
    const early = '0192f1a0-0000-7000-8000-000000000001'
    const late = '0192f1a1-0000-7000-8000-000000000001'
    const s = computeFlowState([bit(late, 0, 'p1', 0), bit(early, 0, 'p1', 0)], [packet('p1')], [])
    expect(s.bitState.get(early)).toBeNull()
    expect(s.bitState.get(late)).toBe('blocked')
  })

  it('Packet → Packet: Tor öffnet erst, wenn alle Schritte der Quelle fertig sind', () => {
    const bits = [
      bit('1', 2, 'p1', 0),
      bit('2', 0, 'p1', 1),
      bit('3', 0, 'p2', 0),
      bit('4', 0, 'p2', 1),
    ]
    const deps = [dep('packet', 'p1', 'packet', 'p2')]
    let s = computeFlowState(bits, [packet('p1'), packet('p2')], deps)
    expect(s.bitState.get('3')).toBe('blocked')
    expect(s.bitState.get('4')).toBe('blocked')
    bits[1] = bit('2', 2, 'p1', 1)
    s = computeFlowState(bits, [packet('p1'), packet('p2')], deps)
    expect(s.bitState.get('3')).toBe('ready')
  })

  it('Bit → Packet und Packet → Bit', () => {
    const bits = [bit('1', 0, 'p1', 0), bit('2', 0, 'p1', 1), bit('5', 0), bit('6', 0)]
    const deps = [dep('bit', '5', 'packet', 'p1'), dep('packet', 'p1', 'bit', '6')]
    const s = computeFlowState(bits, [packet('p1')], deps)
    expect(s.bitState.get('1')).toBe('blocked')
    expect(s.bitState.get('6')).toBe('blocked')
    expect(s.bitState.get('5')).toBeNull()
    const done = computeFlowState([bits[0]!, bits[1]!, bit('5', 2), bits[3]!], [packet('p1')], deps)
    expect(done.bitState.get('1')).toBe('ready')
  })

  it('Bit → Bit zwischen losen Kapseln', () => {
    const s = computeFlowState([bit('7', 1), bit('8', 0)], [], [dep('bit', '7', 'bit', '8')])
    expect(s.bitState.get('8')).toBe('blocked')
  })

  it('erkennt Zyklen über Stapel und Pfeile', () => {
    const a = dep('bit', '2', 'bit', '9')
    const b = dep('bit', '9', 'packet', 'p1')
    const c = dep('bit', '1', 'bit', '10')
    const s = computeFlowState(
      [bit('1', 0, 'p1', 0), bit('2', 0, 'p1', 1), bit('9'), bit('10')],
      [packet('p1')],
      [a, b, c],
    )
    expect([...s.cycleDependencyIds].sort()).toEqual([a.id, b.id].sort())
    expect([...s.cycleBitIds].sort()).toEqual(['1', '2', '9'])
    expect(s.packetSummary.get('p1')!.cycles).toBe(2)
  })

  it('fasst Packets zusammen', () => {
    const s = computeFlowState(
      [bit('1', 2, 'p1', 0), bit('2', 1, 'p1', 1), bit('3', 0, 'p1', 2)],
      [packet('p1')],
      [],
    )
    expect(s.packetSummary.get('p1')).toEqual({
      total: 3,
      done: 1,
      inProgress: 1,
      blocked: 1,
      ready: 1,
      cycles: 0,
      percent: 33,
    })
  })

  it('sourceDone prüft Bit- und Packet-Quellen', () => {
    const d1 = dep('bit', '1', 'bit', '3')
    const d2 = dep('packet', 'p1', 'bit', '3')
    const s = computeFlowState(
      [bit('1', 2, 'p1', 0), bit('2', 0, 'p1', 1), bit('3')],
      [packet('p1')],
      [d1, d2],
    )
    expect(s.sourceDone(d1)).toBe(true)
    expect(s.sourceDone(d2)).toBe(false)
  })
})

describe('isValidLink', () => {
  const bits = [bit('1', 0, 'p1', 0), bit('2', 0, 'p1', 1), bit('3')]
  const existing = [dep('bit', '3', 'bit', '1')]
  it.each([
    [{ type: 'bit', id: '3' }, { type: 'bit', id: '3' }, false],
    [{ type: 'bit', id: '1' }, { type: 'packet', id: 'p1' }, false],
    [{ type: 'packet', id: 'p1' }, { type: 'bit', id: '2' }, false],
    [{ type: 'bit', id: '3' }, { type: 'bit', id: '1' }, false],
    [{ type: 'bit', id: '3' }, { type: 'packet', id: 'p1' }, true],
    [{ type: 'bit', id: '1' }, { type: 'bit', id: '3' }, true],
  ] as const)('%o → %o = %s', (from, to, expected) => {
    expect(isValidLink(from, to, bits, existing)).toBe(expected)
  })
})
