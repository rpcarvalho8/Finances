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
  parse(bytes: Uint8Array): ParseResult
}
