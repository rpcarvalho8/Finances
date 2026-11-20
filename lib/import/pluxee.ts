/**
 * Pluxee meal-card export (CSV). Structure in docs/IMPORT_FORMATS.md:
 * a few title lines, then `Data, Descrição, Valor, Saldo`; Portuguese decimal
 * comma; "Carregamento de …" rows have the description split over extra cells.
 * Rule: first cell = date, last two = value and balance, everything between = description.
 */
import { decodeText, dmyToIso, normHeader, parseCsv } from './csv'
import { parseAmountToCents } from '../money'
import type { ImportSource, ParseResult, ParsedRow } from './types'

/** "1.234,56 €", "-12,34", "12.5" → cents, exact (no float maths). */
export function parsePtAmountToCents(raw: string): number | null {
  let s = raw.replace(/€/g, '').replace(/[\s ]/g, '')
  if (s.includes(',')) s = s.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
  if (!/^[+-]?\d+(\.\d{1,2})?$/.test(s)) return null
  return parseAmountToCents(s)
}

const isTopUp = (description: string) => /^carregamento/.test(normHeader(description))

function headerOf(cells: string[]): boolean {
  const h = cells.map(normHeader)
  return h[0] === 'data' && h.includes('descricao') && h.includes('valor') && h.includes('saldo')
}

/**
 * Splits a data row into date / description / value / balance. Handles two
 * shapes: amounts in their own cells ("12,34") and, when the export did not
 * quote them, amounts broken at the decimal comma ("-12","34").
 */
function splitRow(cells: string[]): { date: string; description: string; value: string; balance: string } | null {
  const c = cells.map((x) => x.trim())
  while (c.length && c[c.length - 1] === '') c.pop()
  if (c.length < 4) return null
  const frac = (x: string) => /^\d{2}( ?€)?$/.test(x)
  const whole = (x: string) => /^[+-]?(\d{1,3}(\.\d{3})+|\d+)$/.test(x)
  const n = c.length
  if (n >= 6 && frac(c[n - 1]) && frac(c[n - 3]) && whole(c[n - 2]) && whole(c[n - 4])) {
    return { date: c[0], description: c.slice(1, n - 4).join(', '), value: `${c[n - 4]},${c[n - 3]}`, balance: `${c[n - 2]},${c[n - 1]}` }
  }
  return { date: c[0], description: c.slice(1, n - 2).join(', '), value: c[n - 2], balance: c[n - 1] }
}

export function parsePluxeeCsv(bytes: Uint8Array): ParseResult {
  const text = decodeText(bytes)
  let table = parseCsv(text, ';')
  let headerIdx = table.findIndex((r) => headerOf(r.cells))
  if (headerIdx < 0) {
    table = parseCsv(text, ',')
    headerIdx = table.findIndex((r) => headerOf(r.cells))
  }
  if (headerIdx < 0) {
    return { rows: [], errors: [], warnings: ['Não encontrei o cabeçalho do cartão refeição (Data, Descrição, Valor, Saldo). É o ficheiro certo?'] }
  }

  const raw: Array<{ line: number; bookedOn: string; description: string; value: number; balance: number | null; explicitSign: boolean }> = []
  const errors: ParseResult['errors'] = []
  const warnings: string[] = []
  for (const { line, cells } of table.slice(headerIdx + 1)) {
    const parts = splitRow(cells)
    if (!parts) {
      errors.push({ line, error: 'Linha com colunas a menos' })
      continue
    }
    const bookedOn = dmyToIso(parts.date) ?? (/^\d{4}-\d{2}-\d{2}$/.test(parts.date) ? parts.date : null)
    if (!bookedOn) {
      errors.push({ line, error: `Data inválida: "${parts.date}"` })
      continue
    }
    const value = parsePtAmountToCents(parts.value)
    if (value === null) {
      errors.push({ line, error: `Valor inválido: "${parts.value}"` })
      continue
    }
    const description = parts.description.replace(/\s+/g, ' ').replace(/(,\s*)+$/, '').trim()
    if (!description) {
      errors.push({ line, error: 'Descrição vazia' })
      continue
    }
    if (value === 0) {
      warnings.push(`Linha ${line}: valor 0,00 € ignorado`)
      continue
    }
    raw.push({ line, bookedOn, description: description.slice(0, 500), value, balance: parsePtAmountToCents(parts.balance), explicitSign: /^\s*[+-]/.test(parts.value) })
  }

  // Some exports show every value without a sign. Then top-ups are credits and the rest debits.
  const signed = raw.some((r) => r.value < 0 || r.explicitSign)
  if (!signed && raw.length) warnings.push('O ficheiro não tem sinais nos valores: carregamentos contam como entradas e o resto como gastos.')
  const rows: ParsedRow[] = raw.map((r) => {
    const amountCents = signed ? r.value : isTopUp(r.description) ? Math.abs(r.value) : -Math.abs(r.value)
    const topUp = amountCents > 0 && isTopUp(r.description)
    return {
      line: r.line,
      bookedOn: r.bookedOn,
      valueOn: null,
      description: r.description,
      amountCents,
      balanceCents: r.balance,
      kind: amountCents < 0 ? 'expense' : topUp ? 'in_kind_income' : 'refund',
      category: amountCents < 0 ? 'Alimentação' : undefined,
    }
  })
  return { rows, errors, warnings }
}

export const pluxeeCsv: ImportSource = {
  id: 'pluxee_csv',
  label: 'Pluxee — cartão refeição (CSV)',
  accept: '.csv',
  accountKind: 'meal_card',
  parse: parsePluxeeCsv,
}
