/**
 * Money is stored as integer cents + ISO currency. Floats only appear at the
 * display edge (cents / 100) and are never stored or summed.
 */
export const MAX_ABS_CENTS = 1_000_000_000_00 // 1 000 000 000 € sanity bound

/**
 * Parses user/API input into integer cents without float arithmetic on strings.
 * Accepts numbers (rounded to the cent) and strings like "12", "-12.3", "12,34",
 * "1 234,56", "1234.56 €". Returns null when the input is not a clean amount.
 */
export function parseAmountToCents(input: unknown): number | null {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return null
    const cents = Math.round(input * 100)
    return Math.abs(cents) <= MAX_ABS_CENTS ? cents : null
  }
  if (typeof input !== 'string') return null
  const s = input.replace(/€/g, '').replace(/[\s ]/g, '')
  const m = /^([+-]?)(\d+)(?:[.,](\d{1,2}))?$/.exec(s)
  if (!m) return null
  const cents = Number(m[2]) * 100 + Number((m[3] ?? '').padEnd(2, '0') || '0')
  if (!Number.isSafeInteger(cents) || cents > MAX_ABS_CENTS) return null
  return m[1] === '-' ? -cents : cents
}

/** Display-only conversion. */
export function centsToEuros(cents: number): number {
  return cents / 100
}

export function sumCents(values: number[]): number {
  return values.reduce((a, b) => a + b, 0)
}
