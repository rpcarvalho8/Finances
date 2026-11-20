import type { MovementKind } from '../ledger'

/** A movement read from a source file, before it touches the database. Money in integer cents. */
export type ParsedRow = {
  /** 1-based line in the file, for the error report. */
  line: number
  bookedOn: string
  valueOn: string | null
  description: string
  amountCents: number
  /** Balance after the movement, when the source gives it (validation only). */
  balanceCents: number | null
  /** Movement kind when the source knows it (e.g. meal-card top-up = in_kind_income); otherwise by sign. */
  kind?: MovementKind
  /** Default category name for the household, when the source implies one. */
  category?: string
}

export type RowError = { line: number; error: string }

export type ParseResult = {
  rows: ParsedRow[]
  errors: RowError[]
  warnings: string[]
}

export type ImportSource = {
  id: string
  label: string
  /** File extensions accepted by the file picker. */
  accept: string
  /** Preferred destination account kind (the UI preselects one of this kind). */
  accountKind?: string
  parse(bytes: Uint8Array): ParseResult
}
