/** Decodes bank exports: UTF-8 (with or without BOM), falling back to Windows-1252. */
export function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder('utf-8').decode(bytes.subarray(3))
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

/**
 * RFC 4180 CSV: quoted fields may contain the delimiter, doubled quotes and newlines.
 * Returns rows with the 1-based line where each row starts.
 */
export function parseCsv(text: string, delimiter = ','): Array<{ line: number; cells: string[] }> {
  const out: Array<{ line: number; cells: string[] }> = []
  let cells: string[] = []
  let field = ''
  let quoted = false
  let line = 1
  let rowLine = 1
  let i = 0
  const pushRow = () => {
    cells.push(field)
    if (!(cells.length === 1 && cells[0].trim() === '')) out.push({ line: rowLine, cells })
    cells = []
    field = ''
  }
  while (i < text.length) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        quoted = false
      } else {
        if (ch === '\n') line++
        field += ch
      }
      i++
      continue
    }
    if (ch === '"' && field === '') quoted = true
    else if (ch === delimiter) {
      cells.push(field)
      field = ''
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      pushRow()
      line++
      rowLine = line
    } else field += ch
    i++
  }
  if (field !== '' || cells.length) pushRow()
  return out
}

/** Lowercase, no accents, single spaces: for matching column headers. */
export function normHeader(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** DD-MM-AAAA or DD/MM/AAAA → AAAA-MM-DD, or null if not a real date. */
export function dmyToIso(s: string): string | null {
  const m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s.trim())
  if (!m) return null
  const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  const d = new Date(`${iso}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null
}

/**
 * Amounts exported with float noise, e.g. "-12.340000000000002 €" or "1234.5 €".
 * Rounds to the cent only when the extra digits are noise (< 0.001 cent away);
 * a real sub-cent value is rejected. Never drops the sign.
 */
export function parseNoisyAmountToCents(raw: string): number | null {
  let s = raw.replace(/€/g, '').replace(/[\s ]/g, '')
  if (!s.includes('.') && /,\d+$/.test(s)) s = s.replace(',', '.')
  if (!/^[+-]?\d+(\.\d+)?$/.test(s)) return null
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  const scaled = n * 100
  const cents = Math.round(scaled)
  if (Math.abs(scaled - cents) > 0.001 || !Number.isSafeInteger(cents)) return null
  return cents === 0 ? 0 : cents
}
