/**
 * Gestão local de utilizadores (corre no PC onde está a BD; nunca pela web).
 *
 *   npm run user -- add "<Nome>" <email>     cria utilizador (pede a password)
 *   npm run user -- passwd <email>           muda a password e termina todas as sessões
 *   npm run user -- list                     lista utilizadores
 *
 * A password é pedida no terminal sem eco. Mínimo 12 caracteres.
 */
import readline from 'readline'
import { addUser, listUsers, setPassword } from '../lib/auth/users'
import { closeDb } from '../lib/db'
import { migrate } from '../lib/migrate'

function askHidden(question: string): Promise<string> {
  if (process.env.FOS_PASSWORD) return Promise.resolve(process.env.FOS_PASSWORD)
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream }
    process.stdout.write(question)
    out._writeToOutput = () => {}
    rl.question('', (answer) => {
      rl.close()
      process.stdout.write('\n')
      resolve(answer)
    })
  })
}

async function askNewPassword(): Promise<string> {
  const a = await askHidden('Nova password: ')
  const b = process.env.FOS_PASSWORD ? a : await askHidden('Repete a password: ')
  if (a !== b) throw new Error('As passwords não coincidem')
  return a
}

async function main() {
  await migrate({ log: (m) => console.log(m) })
  const [cmd, ...args] = process.argv.slice(2)
  if (cmd === 'add' && args.length === 2) {
    await addUser(args[0], args[1], await askNewPassword())
    console.log(`✅ Utilizador criado: ${args[1]}`)
  } else if (cmd === 'passwd' && args.length === 1) {
    await setPassword(args[0], await askNewPassword())
    console.log('✅ Password alterada; sessões terminadas')
  } else if (cmd === 'list') {
    for (const u of await listUsers()) console.log(`${u.role.padEnd(7)} ${u.email}  ${u.name}`)
  } else {
    console.error('Uso: npm run user -- add "<Nome>" <email> | passwd <email> | list')
    process.exit(1)
  }
}

main()
  .then(() => closeDb())
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
