import crypto from 'crypto'

// scrypt parameters (OWASP baseline for scrypt: N=2^17 is ideal; 2^15 keeps login < ~100ms on a home PC).
const N = 1 << 15
const R = 8
const P = 1
const KEYLEN = 64
const MAXMEM = 128 * N * R * 2

function scrypt(password: string, salt: Buffer, n: number, r: number, p: number, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    crypto.scrypt(password.normalize('NFKC'), salt, keylen, { N: n, r, p, maxmem: Math.max(MAXMEM, 128 * n * r * 2) }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  )
}

export const MIN_PASSWORD_LENGTH = 12

/** Format: scrypt$N$r$p$<salt base64>$<hash base64> */
export async function hashPassword(password: string): Promise<string> {
  if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`A password tem de ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres`)
  const salt = crypto.randomBytes(16)
  const key = await scrypt(password, salt, N, R, P, KEYLEN)
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$')
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [n, r, p] = parts.slice(1, 4).map(Number)
  if (![n, r, p].every((x) => Number.isInteger(x) && x > 0)) return false
  const salt = Buffer.from(parts[4], 'base64')
  const expected = Buffer.from(parts[5], 'base64')
  if (expected.length === 0) return false
  const key = await scrypt(password, salt, n, r, p, expected.length)
  return crypto.timingSafeEqual(key, expected)
}

/** Burns comparable CPU when the user does not exist, so timing does not reveal valid emails. */
let dummyHash: Promise<string> | null = null
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword('dummy-password-for-timing')
  await verifyPassword(password, await dummyHash)
  return false
}
