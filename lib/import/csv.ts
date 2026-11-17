// Windows-1252 differs from Latin-1 only in 0x80–0x9F. Decoded by hand so it does
// not depend on the Node build's ICU/TextDecoder support, which differed between Node 20 (CI) and 22.
const CP1252_HIGH = '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008DŽ\u008F\u0090‘’“”•–—˜™š›œ\u009DžŸ'

function decodeCp1252(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]
    out += b >= 0x80 && b <= 0x9f ? CP1252_HIGH[b - 0x80] : String.fromCharCode(b)
  }
  return out
}

/** Strict UTF-8 check (no overlongs, no surrogates, nothing above U+10FFFF). */
export function isValidUtf8(bytes: Uint8Array): boolean {
  let i = 0
  while (i < bytes.length) {
    const b = bytes[i]
    let n = 0
    let min = 0
    if (b < 0x80) { i++; continue }
    else if (b >= 0xc2 && b <= 0xdf) { n = 1; min = 0x80 }
    else if (b >= 0xe0 && b <= 0xef) { n = 2; min = 0x800 }
    else if (b >= 0xf0 && b <= 0xf4) { n = 3; min = 0x10000 }
    else return false
    let cp = b & (0x3f >> n)
    for (let k = 1; k <= n; k++) {
      const c = bytes[i + k]
      if (c === undefined || (c & 0xc0) !== 0x80) return false
      cp = (cp << 6) | (c & 0x3f)
    }
    if (cp < min || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return false
    i += n + 1
  }
  return true
}

/** Decodes bank exports: UTF-8 (with or without BOM), falling back to Windows-1252. */
export function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder('utf-8').decode(bytes.subarray(3))
  return isValidUtf8(bytes) ? new TextDecoder('utf-8').decode(bytes) : decodeCp1252(bytes)
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
