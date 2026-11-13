import { NextResponse } from 'next/server'

/**
 * Response for endpoints switched off until authentication and secret storage
 * exist (A2, decided 2026-11-06). 410 Gone: the client should not retry.
 */
export function disabledFeature(feature: string): NextResponse {
  return NextResponse.json(
    { error: `Funcionalidade desligada nesta versão: ${feature}.`, code: 'FEATURE_DISABLED' },
    { status: 410 },
  )
}
