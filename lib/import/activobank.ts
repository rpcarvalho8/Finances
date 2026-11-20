/**
 * ActivoBank "Extrato combinado" (PDF). Structure in docs/IMPORT_FORMATS.md.
 *
 * - Each account section starts with "<TIPO> | N. <número> | MOEDA: EUR" and a
 *   period line "EXTRATO DE AAAA/MM/DD A AAAA/MM/DD".
 * - Debit and credit are separate unsigned columns: an amount is assigned to the
 *   column whose header right edge is nearest (numbers are right-aligned).
 * - Dates are D.MM; the year comes from the period (a Dec→Jan statement spans two years).
 * - A line without dates or amounts right after a movement continues its description.
 * - The account number is never kept: only a hash (section key / account ref).
 */
import crypto from 'crypto'
import { pdfLines, rightEdgeOf, type TextItem, type TextLine } from './pdf-text'
import type { ImportSource, ParseOptions, ParseResult, ParsedRow, StatementSection } from './types'

const SECTION_RE = /^(.+?)\s*\|\s*N\.?\s*º?\s*([\d][\d\s]*\d)\s*\|\s*MOEDA:\s*([A-Z]{3})/i
const PERIOD_RE = /EXTRATO\s+DE\s+(\d{4})\/(\d{2})\/(\d{2})\s+A\s+(\d{4})\/(\d{2})\/(\d{2})/i
const AMOUNT_RE = /\d{1,3}(?: \d{3})*\.\d{2}(?!\d)/g
const DATES_RE = /^(\d{1,2})\.(\d{2})\s+(\d{1,2})\.(\d{2})\s*(.*)$/

type Columns = { debit: number; credit: number; balance: number }
type Section = { key: string; label: string; currency: string; period: { y1: number; m1: number; y2: number; m2: number } | null; rows: ParsedRow[]; errors: ParseResult['errors']; opening: number | null }

export function amountToCents(s: string): number {
  const [int, dec] = s.replace(/ /g, '').split('.')
  return Number(int) * 100 + Number(dec)
}

function sectionKey(number: string): string {
  return crypto.createHash('sha256').update(`activobank:${number.replace(/\s/g, '')}`).digest('hex').slice(0, 16)
}

/** Year for a D.MM date inside the statement period (handles Dec→Jan). */
export function yearFor(month: number, period: Section['period']): number | null {
  if (!period) return null
  if (period.y1 === period.y2) return period.y1
  return month > period.m2 ? period.y1 : period.y2
}

function isoDate(d: string, m: string, period: Section['period']): string | null {
  const month = Number(m)
  const year = yearFor(month, period)
  if (!year || month < 1 || month > 12) return null
  const iso = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  const dt = new Date(`${iso}T00:00:00Z`)
  return !Number.isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === iso ? iso : null
}

function headerColumns(line: TextLine): Columns | null {
  const find = (word: string): number | null => {
    for (const it of line.items) {
      const i = it.str.toUpperCase().indexOf(word)
      if (i >= 0) return rightEdgeOf(it, i + word.length)
    }
    return null
  }
  const debit = find('DEBITO') ?? find('DÉBITO')
  const credit = find('CREDITO') ?? find('CRÉDITO')
  const balance = find('SALDO')
  return debit !== null && credit !== null && balance !== null && debit < credit && credit < balance ? { debit, credit, balance } : null
}

/** Splits a line into its left text and the amounts sitting in the debit/credit/balance columns. */
function splitAmounts(items: TextItem[], cols: Columns): { text: string; debit: number | null; credit: number | null; balance: number | null } {
  const tolerance = Math.max(20, (cols.balance - cols.credit) / 2)
  const out = { debit: null as number | null, credit: null as number | null, balance: null as number | null }
  const textParts: string[] = []
  for (const it of items) {
    let rest = it.str
    for (const m of Array.from(it.str.matchAll(AMOUNT_RE))) {
      const right = rightEdgeOf(it, (m.index ?? 0) + m[0].length)
      const dist = (['debit', 'credit', 'balance'] as const).map((k) => [k, Math.abs(cols[k] - right)] as const).sort((a, b) => a[1] - b[1])[0]
      if (dist[1] > tolerance) continue
      out[dist[0]] = amountToCents(m[0])
      rest = rest.replace(m[0], ' ')
    }
    textParts.push(rest)
  }
  return { text: textParts.join(' ').replace(/\s+/g, ' ').trim(), ...out }
}

function isTransferLine(description: string, sectionLabel: string): boolean {
  if (/poupe ?up/i.test(description) && /^TRF/i.test(description)) return true
  return /poupe ?up/i.test(sectionLabel) && /^TRF/i.test(description)
}

export async function parseActivoBankPdf(bytes: Uint8Array, opts: ParseOptions = {}): Promise<ParseResult> {
  let lines: TextLine[]
  try {
    lines = await pdfLines(bytes)
  } catch {
    return { rows: [], errors: [], warnings: ['Não consegui ler o PDF (protegido ou danificado?).'] }
  }
  const sections: Section[] = []
  let cur: Section | null = null
  let cols: Columns | null = null
  let last: { row: ParsedRow; page: number; y: number } | null = null
  let lineNo = 0

  for (const line of lines) {
    lineNo++
    const joined = line.items.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim()
    const sec = SECTION_RE.exec(joined)
    if (sec) {
      const number = sec[2].replace(/\s/g, '')
      cur = { key: sectionKey(number), label: `${sec[1].trim().toUpperCase()} ···${number.slice(-4)}`, currency: sec[3].toUpperCase(), period: null, rows: [], errors: [], opening: null }
      sections.push(cur)
      last = null
      continue
    }
    const per = PERIOD_RE.exec(joined)
    if (per && cur) {
      cur.period = { y1: Number(per[1]), m1: Number(per[2]), y2: Number(per[4]), m2: Number(per[5]) }
      continue
    }
    const hdr = headerColumns(line)
    if (hdr) {
      cols = hdr
      last = null
      continue
    }
    if (!cur || !cols) continue

    const { text, debit, credit, balance } = splitAmounts(line.items, cols)
    const upper = text.toUpperCase()
    if (/^SALDO INICIAL/.test(upper)) {
      cur.opening = balance
      last = null
      continue
    }
    if (/^(SALDO FINAL|SALDO A TRANSPORTAR|A TRANSPORTAR|TRANSPORTE|TOTAL)/.test(upper)) {
      last = null
      continue
    }
    const d = DATES_RE.exec(text)
    if (d) {
      const bookedOn = isoDate(d[1], d[2], cur.period)
      const valueOn = isoDate(d[3], d[4], cur.period)
      const description = d[5].trim()
      if (!bookedOn) {
        cur.errors.push({ line: lineNo, error: cur.period ? `Data inválida: "${d[1]}.${d[2]}"` : 'Falta o período do extrato (EXTRATO DE … A …)' })
        last = null
        continue
      }
      if ((debit === null) === (credit === null)) {
        cur.errors.push({ line: lineNo, error: `Não consegui separar débito e crédito em "${description || text}"` })
        last = null
        continue
      }
      if (!description) {
        cur.errors.push({ line: lineNo, error: 'Descrição vazia' })
        last = null
        continue
      }
      const amountCents = debit !== null ? -debit : (credit as number)
      const row: ParsedRow = { line: lineNo, bookedOn, valueOn, description: description.slice(0, 500), amountCents, balanceCents: balance }
      if (isTransferLine(description, cur.label)) {
        row.kind = 'transfer'
        row.category = 'Transferências'
      }
      cur.rows.push(row)
      last = { row, page: line.page, y: line.y }
      continue
    }
    // Wrapped description: no amounts, same page, just below the previous movement.
    if (last && debit === null && credit === null && balance === null && line.page === last.page && last.y - line.y < 16 && text) {
      last.row.description = `${last.row.description} ${text}`.slice(0, 500)
      last.y = line.y
      continue
    }
    last = null
  }

  if (!sections.length) {
    return { rows: [], errors: [], warnings: ['Não encontrei nenhuma conta no PDF ("<TIPO> | N. … | MOEDA: EUR"). É o extrato combinado do ActivoBank?'] }
  }
  const list: StatementSection[] = sections.map((s) => ({ key: s.key, label: s.label, rows: s.rows.length }))
  const chosen = (opts.section && sections.find((s) => s.key === opts.section)) || sections.find((s) => s.rows.length) || sections[0]
  const warnings: string[] = []
  if (sections.length > 1 && !opts.section) warnings.push(`Este PDF tem ${sections.length} contas. Estás a ver "${chosen.label}"; escolhe outra na lista para a importar noutra conta.`)
  if (chosen.currency !== 'EUR') warnings.push(`A conta está em ${chosen.currency}; por agora a app só trata EUR.`)
  // Balance chain must start at SALDO INICIAL: include it as a virtual predecessor.
  if (chosen.opening !== null && chosen.rows.length) {
    const first = chosen.rows[0]
    if (first.balanceCents !== null && chosen.opening + first.amountCents !== first.balanceCents) {
      warnings.push('O primeiro movimento não bate certo com o SALDO INICIAL: confirma o extrato.')
    }
  }
  return { rows: chosen.rows, errors: chosen.errors, warnings, sections: list, section: chosen.key, accountRef: chosen.key }
}

export const activoBankPdf: ImportSource = {
  id: 'activobank_pdf',
  label: 'ActivoBank — extrato combinado (PDF)',
  accept: '.pdf',
  parse: parseActivoBankPdf,
}
