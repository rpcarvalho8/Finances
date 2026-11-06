// Disabled in A2 (2026-11-06). Previous implementation: git show 4880d7f:app/api/ai-advisor/route.ts
import { disabledFeature } from '@/lib/disabled'

export const dynamic = 'force-dynamic'

export function POST() {
  return disabledFeature('AI Advisor')
}
