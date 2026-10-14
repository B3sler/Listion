import { getRandomValues } from 'node:crypto'

/**
 * RFC 9562 UUID version 7: a 48-bit Unix millisecond timestamp followed by random bits.
 * Later IDs sort after earlier ones (also as plain strings), which keeps index inserts local.
 * Kept in sync with frontend/src/helpers/uuid.ts.
 */
export function uuidv7(now: number = Date.now()): string {
  const bytes = getRandomValues(new Uint8Array(16))
  let ts = now
  for (let i = 5; i >= 0; i--) {
    bytes[i] = ts % 256
    ts = Math.floor(ts / 256)
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x70 // version 7
  bytes[8] = (bytes[8]! & 0x3f) | 0x80 // variant 10xx
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
