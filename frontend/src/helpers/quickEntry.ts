/**
 * Smart entry: pulls due date, priority, colour, size and repeat rule out of a bit title such as
 * "Steuer abgeben morgen !! #rot" (German and English). Pure functions, local dates only.
 *
 * - Sigil tokens (`!`, `#colour`, `~size`) count anywhere in the text.
 * - Word tokens (dates, repeat rules) count only in the trailing run of the text: they are read
 *   from the end, longest pattern first, and the first word that is no token stops the search.
 *   That keeps "Mail an Fr. Müller" and "Morgen-Routine planen" plain text.
 * - When a kind occurs more than once, the rightmost token wins.
 */
import { addDays, todayKey, weekdayOf } from './localDate'
import { colorByName } from './palette'
import { firstDue, type Recurrence } from './recurrence'

export type TokenKind = 'due' | 'priority' | 'color' | 'size' | 'recurrence'

export interface QuickEntryToken {
  start: number
  end: number
  kind: TokenKind
}

export interface QuickEntry {
  title: string
  dueDate?: string
  priority?: 1 | 2 | 3
  color?: string
  size?: 1 | 2 | 3 | 4
  recurrence?: Recurrence
  tokens: QuickEntryToken[]
}

/** What a token means. `impliedDue` is the first day of a "every <weekday>" rule. */
type Hit =
  | { kind: 'due'; value: string }
  | { kind: 'priority'; value: 1 | 2 | 3 }
  | { kind: 'color'; value: string }
  | { kind: 'size'; value: 1 | 2 | 3 | 4 }
  | { kind: 'recurrence'; value: Recurrence; impliedDue?: string }

interface Word {
  text: string
  start: number
  end: number
}

interface Found {
  token: QuickEntryToken
  hit: Hit
}

const MAX_WORDS_PER_TOKEN = 3

// ---------------------------------------------------------------------------------------------
// Calendar helpers

function validDayKey(year: number, month: number, day: number): string | undefined {
  const date = new Date(year, month - 1, day, 12)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return undefined
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** The next `weekday` (0 = Mon) strictly after `today`. */
function nextWeekday(today: string, weekday: number): string {
  return addDays(today, ((weekday - weekdayOf(today) + 6) % 7) + 1)
}

/** The next `weekday` (0 = Mon), today included. */
function upcomingWeekday(today: string, weekday: number): string {
  return addDays(today, (weekday - weekdayOf(today) + 7) % 7)
}

/** Day of a year-less `D.M.`: this year, or the next year it exists in once it has passed. */
function dayWithoutYear(day: number, month: number, today: string): string | undefined {
  const thisYear = Number(today.slice(0, 4))
  for (let year = thisYear; year <= thisYear + 8; year++) {
    const key = validDayKey(year, month, day)
    if (key && key >= today) return key
  }
  return undefined
}

// ---------------------------------------------------------------------------------------------
// Word tokens. Each matcher gets the lower-cased phrase (words joined by one space) and must
// match all of it.

const WEEKDAY_NAMES: readonly (readonly string[])[] = [
  ['montag', 'monday', 'mon', 'mo.'],
  ['dienstag', 'tuesday', 'tue', 'di.'],
  ['mittwoch', 'wednesday', 'wed', 'mi.'],
  ['donnerstag', 'thursday', 'thu', 'do.'],
  ['freitag', 'friday', 'fri', 'fr.'],
  ['samstag', 'saturday', 'sat', 'sa.'],
  ['sonntag', 'sunday', 'sun', 'so.'],
]

/** 0 = Monday … 6 = Sunday. German two-letter forms need their dot ("fr."). */
function weekdayIndex(name: string): number | undefined {
  const index = WEEKDAY_NAMES.findIndex((names) => names.includes(name))
  return index === -1 ? undefined : index
}

const NEXT_PREFIX = /^(?:(?:n(?:ä|ae)chste[nrm]?|next) )/
const NEXT_WEEK = /^(?:n(?:ä|ae)chste woche|next week)$/
const IN_N_UNITS = /^in (\d{1,3}) (tage[n]?|tag|days?|woche[n]?|weeks?)$/
const DAY_MONTH_YEAR = /^(\d{1,2})\.(\d{1,2})\.(\d{4})?$/
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/
const EVERY_WEEKDAY = /^(?:jeden|every) (\S+)$/

const FIXED_RECURRENCES: Record<string, Recurrence> = {
  täglich: 'daily',
  taeglich: 'daily',
  daily: 'daily',
  'jeden tag': 'daily',
  'every day': 'daily',
  werktags: 'weekdays',
  weekdays: 'weekdays',
  wöchentlich: 'weekly',
  woechentlich: 'weekly',
  weekly: 'weekly',
  monatlich: 'monthly',
  monthly: 'monthly',
}

type Matcher = (phrase: string, today: string) => Hit | undefined

function due(value: string | undefined): Hit | undefined {
  return value === undefined ? undefined : { kind: 'due', value }
}

const matchRelativeDay: Matcher = (phrase, today) => {
  if (phrase === 'heute' || phrase === 'today') return due(today)
  if (phrase === 'morgen' || phrase === 'tomorrow') return due(addDays(today, 1))
  if (phrase === 'übermorgen' || phrase === 'uebermorgen') return due(addDays(today, 2))
  return undefined
}

const matchWeekday: Matcher = (phrase, today) => {
  const weekday = weekdayIndex(phrase.replace(NEXT_PREFIX, ''))
  return weekday === undefined ? undefined : due(nextWeekday(today, weekday))
}

const matchNextWeek: Matcher = (phrase, today) =>
  NEXT_WEEK.test(phrase) ? due(nextWeekday(today, 0)) : undefined

const matchInNUnits: Matcher = (phrase, today) => {
  const m = IN_N_UNITS.exec(phrase)
  if (!m) return undefined
  const perUnit = m[2].startsWith('w') ? 7 : 1
  return due(addDays(today, Number(m[1]) * perUnit))
}

const matchDayMonth: Matcher = (phrase, today) => {
  const m = DAY_MONTH_YEAR.exec(phrase)
  if (!m) return undefined
  const day = Number(m[1])
  const month = Number(m[2])
  if (m[3]) return due(validDayKey(Number(m[3]), month, day))
  return due(dayWithoutYear(day, month, today))
}

const matchIsoDay: Matcher = (phrase) => {
  const m = ISO_DAY.exec(phrase)
  return m ? due(validDayKey(Number(m[1]), Number(m[2]), Number(m[3]))) : undefined
}

const matchFixedRecurrence: Matcher = (phrase) => {
  const rule = FIXED_RECURRENCES[phrase]
  return rule ? { kind: 'recurrence', value: rule } : undefined
}

const matchEveryWeekday: Matcher = (phrase, today) => {
  const m = EVERY_WEEKDAY.exec(phrase)
  const weekday = m ? weekdayIndex(m[1]) : undefined
  if (weekday === undefined) return undefined
  return { kind: 'recurrence', value: 'weekly', impliedDue: upcomingWeekday(today, weekday) }
}

const WORD_MATCHERS: readonly Matcher[] = [
  matchRelativeDay,
  matchWeekday,
  matchNextWeek,
  matchInNUnits,
  matchDayMonth,
  matchIsoDay,
  matchFixedRecurrence,
  matchEveryWeekday,
]

function matchPhrase(phrase: string, today: string): Hit | undefined {
  for (const matcher of WORD_MATCHERS) {
    const hit = matcher(phrase, today)
    if (hit) return hit
  }
  return undefined
}

// ---------------------------------------------------------------------------------------------
// Sigil tokens: one word each, anywhere in the text.

const PRIORITY_SIGIL = /^(!{1,3})$/
const COLOR_SIGIL = /^#(\S+)$/
const SIZE_SIGIL = /^~(s|m|l|xl)$/i
const SIZES = { s: 1, m: 2, l: 3, xl: 4 } as const

function matchSigil(text: string): Hit | undefined {
  const priority = PRIORITY_SIGIL.exec(text)
  if (priority) return { kind: 'priority', value: priority[1].length as 1 | 2 | 3 }

  const color = COLOR_SIGIL.exec(text)
  if (color) {
    const hex = colorByName(color[1])
    return hex ? { kind: 'color', value: hex } : undefined
  }

  const size = SIZE_SIGIL.exec(text)
  if (size) return { kind: 'size', value: SIZES[size[1].toLowerCase() as keyof typeof SIZES] }

  return undefined
}

// ---------------------------------------------------------------------------------------------
// Scanning

function splitWords(text: string): Word[] {
  return Array.from(text.matchAll(/\S+/g), (m) => ({
    text: m[0],
    start: m.index,
    end: m.index + m[0].length,
  }))
}

function findSigils(words: Word[], literal: ReadonlySet<number>): Map<number, Found> {
  const found = new Map<number, Found>()
  words.forEach((word, index) => {
    if (literal.has(word.start)) return
    const hit = matchSigil(word.text)
    if (hit) {
      found.set(index, { hit, token: { start: word.start, end: word.end, kind: hit.kind } })
    }
  })
  return found
}

/** Reads word tokens backwards from the end, stepping over sigil words. */
function findWordTokens(
  words: Word[],
  sigils: Map<number, Found>,
  literal: ReadonlySet<number>,
  today: string,
): Found[] {
  const found: Found[] = []
  let end = words.length
  while (end > 0) {
    if (sigils.has(end - 1)) {
      end--
      continue
    }
    const match = matchEndingAt(words, end, sigils, literal, today)
    if (!match) break
    found.push(match.found)
    end -= match.length
  }
  return found
}

/** The longest word token (up to three words) that ends right before `words[end]`. */
function matchEndingAt(
  words: Word[],
  end: number,
  sigils: Map<number, Found>,
  literal: ReadonlySet<number>,
  today: string,
): { found: Found; length: number } | undefined {
  for (let length = Math.min(MAX_WORDS_PER_TOKEN, end); length >= 1; length--) {
    const slice = words.slice(end - length, end)
    if (slice.some((_, i) => sigils.has(end - length + i))) continue
    const hit = matchPhrase(slice.map((w) => w.text.toLowerCase()).join(' '), today)
    if (hit) {
      // A dismissed token is plain text as a whole: no shorter window may match inside it.
      if (literal.has(slice[0].start)) return undefined
      const token = { start: slice[0].start, end: slice[length - 1].end, kind: hit.kind }
      return { found: { hit, token }, length }
    }
  }
  return undefined
}

/** Applies the tokens left to right, so the rightmost one of a kind wins. */
function collectFields(found: Found[], today: string): Omit<QuickEntry, 'title' | 'tokens'> {
  const fields: Omit<QuickEntry, 'title' | 'tokens'> = {}
  let explicitDue: string | undefined
  let impliedDue: string | undefined

  for (const { hit } of found) {
    if (hit.kind === 'due') explicitDue = hit.value
    else if (hit.kind === 'priority') fields.priority = hit.value
    else if (hit.kind === 'color') fields.color = hit.value
    else if (hit.kind === 'size') fields.size = hit.value
    else {
      fields.recurrence = hit.value
      impliedDue = hit.impliedDue
    }
  }

  const dueDate =
    explicitDue ??
    impliedDue ??
    (fields.recurrence ? firstDue(fields.recurrence, today) : undefined)
  if (dueDate) fields.dueDate = dueDate
  return fields
}

function tidy(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * Parses a bit title. `literal` holds start indices of tokens the user chose to keep as text;
 * those are skipped.
 */
export function parseQuickEntry(
  text: string,
  now: Date,
  literal: ReadonlySet<number> = new Set(),
): QuickEntry {
  const today = todayKey(now)
  const words = splitWords(text)
  const sigils = findSigils(words, literal)
  const found = [...sigils.values(), ...findWordTokens(words, sigils, literal, today)].sort(
    (a, b) => a.token.start - b.token.start,
  )
  const tokens = found.map((f) => f.token)

  let title = ''
  let cursor = 0
  for (const token of tokens) {
    title += text.slice(cursor, token.start)
    cursor = token.end
  }
  title += text.slice(cursor)

  return { title: tidy(title), ...collectFields(found, today), tokens }
}

/**
 * Carries the start indices of tokens kept as text across an edit from `before` to `after`:
 * indices in front of the change stay, those behind it move with the text, those inside the
 * changed range are dropped (that text is gone or rewritten).
 */
export function shiftLiteral(
  literal: ReadonlySet<number>,
  before: string,
  after: string,
): Set<number> {
  const shortest = Math.min(before.length, after.length)
  let prefix = 0
  while (prefix < shortest && before[prefix] === after[prefix]) prefix++
  let suffix = 0
  while (
    suffix < shortest - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  )
    suffix++
  const tail = before.length - suffix
  const delta = after.length - before.length
  const out = new Set<number>()
  for (const index of literal) {
    if (index < prefix) out.add(index)
    else if (index >= tail) out.add(index + delta)
  }
  return out
}

/** Removes a token from the text together with the surplus whitespace around it. */
export function stripToken(text: string, token: { start: number; end: number }): string {
  const before = text.slice(0, token.start).trimEnd()
  const after = text.slice(token.end).trimStart()
  return before && after ? `${before} ${after}` : before + after
}
