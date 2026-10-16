export interface PaletteColor {
  hex: string
  en: string
  de: string
}

export const PALETTE: readonly PaletteColor[] = [
  { hex: '#ef4444', en: 'red', de: 'rot' },
  { hex: '#f97316', en: 'orange', de: 'orange' },
  { hex: '#eab308', en: 'yellow', de: 'gelb' },
  { hex: '#84cc16', en: 'lime', de: 'limette' },
  { hex: '#22c55e', en: 'green', de: 'grün' },
  { hex: '#14b8a6', en: 'teal', de: 'türkis' },
  { hex: '#06b6d4', en: 'cyan', de: 'cyan' },
  { hex: '#3b82f6', en: 'blue', de: 'blau' },
  { hex: '#6366f1', en: 'indigo', de: 'indigo' },
  { hex: '#8b5cf6', en: 'violet', de: 'violett' },
  { hex: '#ec4899', en: 'pink', de: 'pink' },
  { hex: '#64748b', en: 'gray', de: 'grau' },
]

export const DEFAULT_COLOR = '#6366f1'

/** Hex for an English or German palette name, case-insensitive. */
export function colorByName(name: string): string | undefined {
  const n = name.trim().toLowerCase()
  return PALETTE.find((c) => c.en === n || c.de === n)?.hex
}
