import { NextRequest, NextResponse } from 'next/server'
import { LedgerError } from './ledger'

/** Parses a JSON object body; returns null for anything else (array, invalid JSON, empty). */
export async function readJsonObject(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const b = await req.json()
    return b && typeof b === 'object' && !Array.isArray(b) ? (b as Record<string, unknown>) : null
  } catch {
    return null
  }
}

export function badRequest(error: string, status = 400): NextResponse {
  return NextResponse.json({ error }, { status })
}

export const notFound = () => badRequest('Não encontrado', 404)

export function ledgerErrorResponse(err: unknown): NextResponse {
  if (err instanceof LedgerError) return badRequest(err.message, err.status)
  throw err
}

export function optionalString(v: unknown, max = 200): string | undefined | null {
  if (v === undefined || v === null) return undefined
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s.length > 0 && s.length <= max ? s : null
}
