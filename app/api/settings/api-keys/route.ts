// Disabled in A2 (2026-11-06). Previous implementation: git show 4880d7f:app/api/settings/api-keys/route.ts
import { disabledFeature } from '@/lib/disabled'

export const dynamic = 'force-dynamic'

// Secrets must not be stored in the database (SEC-A04).
export function GET() {
  return disabledFeature('armazenamento de chaves de API')
}

export function POST() {
  return disabledFeature('armazenamento de chaves de API')
}
