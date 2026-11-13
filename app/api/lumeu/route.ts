// Disabled in A4b (2026-11-13): business expenses are hidden (Q5) and the legacy table is not household-scoped.
// Previous implementation: git show 2d4c6f4:app/api/lumeu/route.ts
import { disabledFeature } from '@/lib/disabled'

export const dynamic = 'force-dynamic'

export function GET() {
  return disabledFeature('despesas de negócio')
}
export function POST() {
  return disabledFeature('despesas de negócio')
}
