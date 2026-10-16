import { describe, expect, it } from 'vitest'
import { parseQuickEntry, stripToken, type QuickEntry } from './quickEntry'

// Freitag, 16.10.2026
const now = new Date(2026, 9, 16, 10)

type Fields = Partial<Omit<QuickEntry, 'title' | 'tokens'>>

describe('parseQuickEntry', () => {
  describe('erkennt Tokens', () => {
    it.each<[string, string, Fields]>([
      [
        'Steuer abgeben morgen !! #rot',
        'Steuer abgeben',
        { dueDate: '2026-10-17', priority: 2, color: '#ef4444' },
      ],
      [
        'Ship release fri !!! #blue',
        'Ship release',
        { dueDate: '2026-10-23', priority: 3, color: '#3b82f6' },
      ],
      ['Bericht nächste woche ~l', 'Bericht', { dueDate: '2026-10-19', size: 3 }],
      ['Report next week', 'Report', { dueDate: '2026-10-19' }],
      ['Report in 3 days', 'Report', { dueDate: '2026-10-19' }],
      ['Report in 2 wochen', 'Report', { dueDate: '2026-10-30' }],
      ['Report in 1 tag', 'Report', { dueDate: '2026-10-17' }],
      ['Party 20.10.', 'Party', { dueDate: '2026-10-20' }],
      ['Party 1.2.', 'Party', { dueDate: '2027-02-01' }],
      ['Party 1.2.2028', 'Party', { dueDate: '2028-02-01' }],
      ['Party 16.10.', 'Party', { dueDate: '2026-10-16' }],
      ['Party 2026-12-24', 'Party', { dueDate: '2026-12-24' }],
      ['Müll jeden montag', 'Müll', { recurrence: 'weekly', dueDate: '2026-10-19' }],
      ['Müll every friday', 'Müll', { recurrence: 'weekly', dueDate: '2026-10-16' }],
      ['Standup täglich', 'Standup', { recurrence: 'daily', dueDate: '2026-10-16' }],
      ['Standup every day', 'Standup', { recurrence: 'daily', dueDate: '2026-10-16' }],
      ['Standup jeden Tag', 'Standup', { recurrence: 'daily', dueDate: '2026-10-16' }],
      ['Gym werktags', 'Gym', { recurrence: 'weekdays', dueDate: '2026-10-16' }],
      ['Review wöchentlich', 'Review', { recurrence: 'weekly', dueDate: '2026-10-16' }],
      ['Miete monthly', 'Miete', { recurrence: 'monthly', dueDate: '2026-10-16' }],
      ['Termin fr.', 'Termin', { dueDate: '2026-10-23' }],
      ['Termin Fr.', 'Termin', { dueDate: '2026-10-23' }],
      ['Termin montag', 'Termin', { dueDate: '2026-10-19' }],
      ['Termin nächsten freitag', 'Termin', { dueDate: '2026-10-23' }],
      ['Termin next monday', 'Termin', { dueDate: '2026-10-19' }],
      ['Termin heute', 'Termin', { dueDate: '2026-10-16' }],
      ['Termin today', 'Termin', { dueDate: '2026-10-16' }],
      ['Termin tomorrow', 'Termin', { dueDate: '2026-10-17' }],
      ['Termin übermorgen', 'Termin', { dueDate: '2026-10-18' }],
      ['Termin MORGEN', 'Termin', { dueDate: '2026-10-17' }],
      ['Ticket ~s', 'Ticket', { size: 1 }],
      ['Ticket ~m', 'Ticket', { size: 2 }],
      ['Ticket ~xl', 'Ticket', { size: 4 }],
      ['Ticket !', 'Ticket', { priority: 1 }],
      ['Ticket #grün', 'Ticket', { color: '#22c55e' }],
    ])('%s', (input, title, fields) => {
      const result = parseQuickEntry(input, now)
      expect(result.title).toBe(title)
      expect(result).toMatchObject(fields)
    })

    it('setzt für werktags am Samstag den Montag als Fälligkeit', () => {
      const saturday = new Date(2026, 9, 17, 10)
      expect(parseQuickEntry('Gym werktags', saturday).dueDate).toBe('2026-10-19')
    })

    it('sucht für 29.2. das nächste Schaltjahr', () => {
      const lateFebruary = new Date(2028, 2, 5, 10)
      expect(parseQuickEntry('Party 29.2.', lateFebruary).dueDate).toBe('2032-02-29')
    })
  })

  describe('lässt Text unverändert', () => {
    it.each([
      'Mail an Fr. Müller',
      'Morgen-Routine planen',
      'Meeting heute vorbereiten',
      'Things to do',
      'And so',
      'Prio #1 klären',
      'Party 31.2.',
      'Wandern in 3 Bergen',
      'Zeit !!!!',
      'Ticket ~xxl',
      'Ticket #unbekannt',
    ])('%s', (input) => {
      const result = parseQuickEntry(input, now)
      expect(result.title).toBe(input)
      expect(result.tokens).toEqual([])
      expect(result.dueDate).toBeUndefined()
      expect(result.priority).toBeUndefined()
      expect(result.color).toBeUndefined()
      expect(result.size).toBeUndefined()
      expect(result.recurrence).toBeUndefined()
    })
  })

  describe('Sonderfälle', () => {
    it('nimmt bei mehreren Tokens derselben Art das rechte', () => {
      const result = parseQuickEntry('A !! B !', now)
      expect(result.priority).toBe(1)
      expect(result.title).toBe('A B')
      expect(parseQuickEntry('A ~s B ~xl', now).size).toBe(4)
    })

    it('liest Sigils mitten im Text und Wörter am Ende', () => {
      const result = parseQuickEntry('Bericht !! schreiben morgen', now)
      expect(result.title).toBe('Bericht schreiben')
      expect(result.priority).toBe(2)
      expect(result.dueDate).toBe('2026-10-17')
    })

    it('bevorzugt ein explizites Datum vor dem Datum der Serie', () => {
      const result = parseQuickEntry('Müll jeden montag morgen', now)
      expect(result.recurrence).toBe('weekly')
      expect(result.dueDate).toBe('2026-10-17')
    })

    it('überspringt ein Token, dessen Start in literal steht', () => {
      const result = parseQuickEntry('Steuer morgen', now, new Set([7]))
      expect(result.title).toBe('Steuer morgen')
      expect(result.dueDate).toBeUndefined()
      expect(result.tokens).toEqual([])
    })

    it.each([
      ['Müll jeden montag', 5],
      ['Meeting next friday', 8],
      ['Meeting every friday', 8],
      ['Termin nächsten freitag', 7],
    ])('hält das mehrwortige Token in %s als Text', (input, start) => {
      const result = parseQuickEntry(input, now, new Set([start]))
      expect(result.title).toBe(input)
      expect(result.dueDate).toBeUndefined()
      expect(result.recurrence).toBeUndefined()
      expect(result.tokens).toEqual([])
    })

    it('beendet den Endbereich an einem als Text behaltenen Token', () => {
      const result = parseQuickEntry('Steuer morgen !!', now, new Set([14]))
      expect(result.title).toBe('Steuer morgen !!')
      expect(result.dueDate).toBeUndefined()
      expect(result.priority).toBeUndefined()
    })

    it('überspringt auch ein Sigil-Token in literal', () => {
      const result = parseQuickEntry('Steuer !!', now, new Set([7]))
      expect(result.title).toBe('Steuer !!')
      expect(result.priority).toBeUndefined()
    })

    it('liefert einen leeren Titel, wenn nur Tokens übrig sind', () => {
      const result = parseQuickEntry('!! #rot', now)
      expect(result.title).toBe('')
      expect(result.priority).toBe(2)
      expect(result.color).toBe('#ef4444')
    })

    it('liefert Token-Positionen im Originaltext', () => {
      expect(parseQuickEntry('X morgen', now).tokens).toEqual([{ start: 2, end: 8, kind: 'due' }])
      expect(parseQuickEntry('Bericht nächste woche ~l', now).tokens).toEqual([
        { start: 8, end: 21, kind: 'due' },
        { start: 22, end: 24, kind: 'size' },
      ])
    })

    it('ordnet Tokens nach Position und benennt ihre Art', () => {
      const kinds = parseQuickEntry('A !! b #rot ~m täglich', now).tokens.map((t) => t.kind)
      expect(kinds).toEqual(['priority', 'color', 'size', 'recurrence'])
    })

    it('kommt mit mehrfachen Leerzeichen zurecht', () => {
      const result = parseQuickEntry('Steuer   in  3   days', now)
      expect(result.title).toBe('Steuer')
      expect(result.dueDate).toBe('2026-10-19')
    })

    it('liefert für leere Eingabe einen leeren Titel', () => {
      expect(parseQuickEntry('', now)).toEqual({ title: '', tokens: [] })
    })
  })
})

describe('stripToken', () => {
  it('entfernt das Token und die überzähligen Leerzeichen', () => {
    expect(stripToken('Steuer morgen !!', { start: 7, end: 13 })).toBe('Steuer !!')
  })

  it('entfernt ein Token am Anfang und am Ende', () => {
    expect(stripToken('!! Steuer', { start: 0, end: 2 })).toBe('Steuer')
    expect(stripToken('Steuer !!', { start: 7, end: 9 })).toBe('Steuer')
  })

  it('lässt nur das Token übrig als leeren Text', () => {
    expect(stripToken('!!', { start: 0, end: 2 })).toBe('')
  })
})
