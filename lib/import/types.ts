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

/** One account inside a multi-account statement (e.g. ActivoBank "Extrato combinado"). */
export type StatementSection = {
  /** Stable id: hash of the account number, never the number itself. */
  key: string
  /** Display label, e.g. "CONTA SIMPLES ···4567". */
  label: string
  rows: number
}

export type ParseResult = {
  rows: ParsedRow[]
  errors: RowError[]
  warnings: string[]
  /** Present when the file holds several accounts; rows/errors are those of the chosen one. */
  sections?: StatementSection[]
  /** Key of the section returned (also used to check the destination account). */
  section?: string
  /** Hash identifying the source account, compared with ledger_accounts.external_ref_hash. */
  accountRef?: string
}

export type ParseOptions = { section?: string | null }

export type ImportSource = {
  id: string
  label: string
  /** File extensions accepted by the file picker. */
  accept: string
  /** Preferred destination account kind (the UI preselects one of this kind). */
  accountKind?: string
  parse(bytes: Uint8Array, opts?: ParseOptions): ParseResult | Promise<ParseResult>
}
