// Disabled in A4b (2026-11-13): the old parser corrupted amounts and wrote to legacy tables.
// Import returns in B1 with per-bank parsers, preview and dedupe.
// Previous implementation: git show 2d4c6f4:app/api/import/route.ts
import { disabledFeature } from '@/lib/disabled'

export const dynamic = 'force-dynamic'

export function POST() {
  return disabledFeature('importação de extratos (volta na fase B)')
}
