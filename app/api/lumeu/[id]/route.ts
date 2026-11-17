// Disabled in A4b (2026-11-13). Previous implementation: git show 2d4c6f4:"app/api/lumeu/[id]/route.ts"
import { disabledFeature } from '@/lib/disabled'

export const dynamic = 'force-dynamic'

export function DELETE() {
  return disabledFeature('despesas de negócio')
}
