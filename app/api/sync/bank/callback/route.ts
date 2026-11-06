// Disabled in A2 (2026-11-06). Previous implementation: git show 4880d7f:app/api/sync/bank/callback/route.ts
import { disabledFeature } from '@/lib/disabled'

export const dynamic = 'force-dynamic'

export function GET() {
  return disabledFeature('ligação bancária')
}
