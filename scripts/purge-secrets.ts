/**
 * Removes secrets that older versions stored in plaintext in the database
 * (SEC-A04 broker/API keys, SEC-A05 bank access tokens).
 *
 * Only secret columns are cleared; no financial rows are touched. Budget
 * settings (`api_keys.platform = '__budgets__'`) are kept.
 * No backup is taken on purpose: a backup would keep a copy of the secrets.
 *
 * Usage: `npm run db:purge-secrets -- --yes`
 */
import { closeDb, db } from '../lib/db'

export async function purgeSecrets(): Promise<{ apiKeys: number; bankTokens: number }> {
  const tables = await db.execute(`SELECT name FROM sqlite_master WHERE type='table'`)
  const names = new Set(tables.rows.map((r) => String(r.name)))
  let apiKeys = 0
  let bankTokens = 0
  if (names.has('api_keys')) {
    const r = await db.execute(
      `UPDATE api_keys SET api_key=NULL, api_secret=NULL, extra=NULL, active=0
       WHERE platform != '__budgets__' AND (api_key IS NOT NULL OR api_secret IS NOT NULL OR extra IS NOT NULL)`,
    )
    apiKeys = r.rowsAffected
  }
  if (names.has('bank_accounts')) {
    const r = await db.execute(`UPDATE bank_accounts SET access_token=NULL WHERE access_token IS NOT NULL`)
    bankTokens = r.rowsAffected
  }
  return { apiKeys, bankTokens }
}

if (require.main === module) {
  if (!process.argv.includes('--yes')) {
    console.error('Isto apaga chaves e tokens guardados na BD. Confirma com: npm run db:purge-secrets -- --yes')
    process.exit(1)
  }
  purgeSecrets()
    .then(({ apiKeys, bankTokens }) => {
      console.log(`✅ Chaves limpas: ${apiKeys}; tokens bancários limpos: ${bankTokens}`)
      closeDb()
    })
    .catch((err) => {
      console.error('db:purge-secrets falhou:', err instanceof Error ? err.message : err)
      process.exit(1)
    })
}
