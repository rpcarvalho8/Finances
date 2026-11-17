/**
 * ABANCA account export (CSV, comma-separated). Structure in docs/IMPORT_FORMATS.md.
 * Columns are matched by name, so their order and leading junk lines do not matter.
 */
import { decodeText, dmyToIso, normHeader, parseCsv, parseNoisyAmountToCents } from './csv'
import type { ImportSource, ParseResult, ParsedRow } from './types'

const COLS = {
  booked: 'data',
  description: 'descritivo',
  balance: 'saldo',
  amount: 'montante',
  operation: 'data da operacao',
  value: 'data valor',
} as const

export function parseAbancaCsv(bytes: Uint8Array): ParseResult {
  const text = decodeText(bytes)
  const delimiter = text.split(/\r?\n/, 1)[0].includes(';') && !text.split(/\r?\n/, 1)[0].includes(',') ? ';' : ','
  const table = parseCsv(text, delimiter)
  const headerIdx = table.findIndex((r) => {
    const h = r.cells.map(normHeader)
    return h.includes(COLS.description) && h.includes(COLS.amount) && h.includes(COLS.operation)
  })
  if (headerIdx < 0) {
    return { rows: [], errors: [], warnings: ['Não encontrei o cabeçalho do ABANCA (Descritivo, Montante, Data da operação). É o ficheiro certo?'] }
  }
  const header = table[headerIdx].cells.map(normHeader)
  const col = (name: string) => header.indexOf(name)
  const iDesc = col(COLS.description)
  const iAmount = col(COLS.amount)
  const iOp = col(COLS.operation)
  const iBooked = col(COLS.booked)
  const iValue = col(COLS.value)
  const iBalance = col(COLS.balance)

  const rows: ParsedRow[] = []
  const errors: ParseResult['errors'] = []
  const warnings: string[] = []
  for (const { line, cells } of table.slice(headerIdx + 1)) {
    const get = (i: number) => (i >= 0 && i < cells.length ? cells[i].trim() : '')
    const description = get(iDesc).replace(/\s+/g, ' ')
    const bookedOn = dmyToIso(get(iOp)) ?? (iBooked >= 0 ? dmyToIso(get(iBooked)) : null)
    const amountCents = parseNoisyAmountToCents(get(iAmount))
    if (!bookedOn) {
      errors.push({ line, error: `Data inválida: "${get(iOp)}"` })
      continue
    }
    if (amountCents === null) {
      errors.push({ line, error: `Montante inválido: "${get(iAmount)}"` })
      continue
    }
    if (!description) {
      errors.push({ line, error: 'Descrição vazia' })
      continue
    }
    if (amountCents === 0) {
      warnings.push(`Linha ${line}: montante 0,00 € ignorado`)
      continue
    }
    const balanceRaw = get(iBalance)
    const balanceCents = balanceRaw ? parseNoisyAmountToCents(balanceRaw) : null
    rows.push({
      line,
      bookedOn,
      valueOn: iValue >= 0 ? dmyToIso(get(iValue)) : null,
      description: description.slice(0, 500),
      amountCents,
      balanceCents,
    })
  }
  return { rows, errors, warnings }
}

export const abancaCsv: ImportSource = {
  id: 'abanca_csv',
  label: 'ABANCA — extrato CSV',
  accept: '.csv',
  parse: parseAbancaCsv,
}
