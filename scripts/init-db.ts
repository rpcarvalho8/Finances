/**
 * Non-destructive database setup: applies pending migrations from
 * `migrations/` (backing up an existing database first). Never deletes rows.
 * Use `npm run db:seed` only for synthetic demo data.
 */
import { closeDb } from '../lib/db'
import { migrate } from '../lib/migrate'

migrate({ log: (m) => console.log(m) })
  .then(({ applied }) => {
    console.log(applied.length ? `✅ BD atualizada (${applied.length} migração/ões)` : '✅ BD já estava atualizada')
    closeDb()
  })
  .catch((err) => {
    console.error('db:init falhou:', err instanceof Error ? err.message : err)
    process.exit(1)
  })
