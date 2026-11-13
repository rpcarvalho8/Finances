/**
 * npm run db:migrate            aplica as migrações pendentes (com backup antes)
 * npm run db:migrate -- status  lista versões aplicadas e pendentes
 * npm run db:rollback -- --yes  reverte a última versão (com backup antes)
 */
import { closeDb } from '../lib/db'
import { appliedVersions, loadMigrations, migrate, rollback } from '../lib/migrate'

async function main() {
  const cmd = process.argv[2] ?? 'up'
  const log = (m: string) => console.log(m)
  if (cmd === 'status') {
    const done = new Set((await appliedVersions()).map((a) => a.version))
    for (const m of loadMigrations()) {
      console.log(`${done.has(m.version) ? '✔' : '·'} ${String(m.version).padStart(4, '0')}_${m.name}${m.down ? '' : ' (irreversível)'}`)
    }
  } else if (cmd === 'up') {
    const { applied } = await migrate({ log })
    console.log(applied.length ? `✅ ${applied.length} migração/ões aplicada(s)` : '✅ Nada a aplicar')
  } else if (cmd === 'down') {
    if (!process.argv.includes('--yes')) {
      console.error('Isto reverte a última migração. Confirma com: npm run db:rollback -- --yes')
      process.exit(1)
    }
    await rollback({ log })
  } else {
    console.error(`Comando desconhecido: ${cmd}`)
    process.exit(1)
  }
}

main()
  .then(() => closeDb())
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
