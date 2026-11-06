// Disabled in A2 (2026-11-06). Previous implementation: git show 4880d7f:app/api/backup/route.ts
import { disabledFeature } from '@/lib/disabled'

export const dynamic = 'force-dynamic'

// Use `npm run db:backup` on the machine that holds the database.
export function GET() {
  return disabledFeature('download do backup')
}
