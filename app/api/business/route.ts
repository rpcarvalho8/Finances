// Disabled in A4b (2026-11-13): businesses are hidden (Q5) and the legacy table is not household-scoped.
// Previous implementation: git show 2d4c6f4:app/api/business/route.ts
import { disabledFeature } from '@/lib/disabled'

export const dynamic = 'force-dynamic'

export function GET() {
  return disabledFeature('negócios')
}
export function POST() {
  return disabledFeature('negócios')
}
