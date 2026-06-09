import { NextRequest, NextResponse } from 'next/server'
import { createSign, randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const ENABLE_BANKING_AUTH_URL = 'https://api.enablebanking.com/auth'
const CLIENT_ID =
  process.env.ENABLE_BANKING_APPLICATION_KEY ||
  process.env.NEXT_PUBLIC_ENABLE_BANKING_APPLICATION_KEY ||
  'e05443a5-b2a3-454d-9f7a-703fb7e9a0ad'
const REDIRECT_URI =
  process.env.ENABLE_BANKING_REDIRECT_URI ||
  process.env.NEXT_PUBLIC_ENABLE_BANKING_REDIRECT_URI ||
  'https://small-bats-appear.loca.lt/api/sync/bank/callback'
const ASPSP_COUNTRY = process.env.ENABLE_BANKING_ASPSP_COUNTRY
const ASPSP_NAME = process.env.ENABLE_BANKING_ASPSP_NAME

if (!CLIENT_ID || !REDIRECT_URI) {
  throw new Error('Missing Enable Banking environment variables')
}

let PRIVATE_KEY: string | null = null

function getPrivateKey(): string {
  if (PRIVATE_KEY) return PRIVATE_KEY

  try {
    console.log('CLIENT_ID:', CLIENT_ID)

    // Prefer explicit env secret if provided
    const envSecret = process.env.ENABLE_BANKING_APPLICATION_SECRET
    if (envSecret && envSecret.trim()) {
      const privateKeyCandidate = normalizePrivateKey(envSecret)
      if (isValidPrivateKey(privateKeyCandidate)) {
        PRIVATE_KEY = privateKeyCandidate
        console.log('✅ Private key loaded and normalized from environment variable ENABLE_BANKING_APPLICATION_SECRET')
        return PRIVATE_KEY
      }
      console.warn('⚠️ ENABLE_BANKING_APPLICATION_SECRET could not be parsed as a valid PEM key; falling back to file lookup')
    }

    // Build candidate paths: <CLIENT_ID>.pem, then any .pem in project root
    const candidatePaths: string[] = []
    const keyPathFromClient = path.join(process.cwd(), `${CLIENT_ID}.pem`)
    candidatePaths.push(keyPathFromClient)

    const files = fs.readdirSync(process.cwd()).filter((f) => f.endsWith('.pem'))
    for (const f of files) {
      const p = path.join(process.cwd(), f)
      if (!candidatePaths.includes(p)) candidatePaths.push(p)
    }

    console.log('Trying private key paths:', candidatePaths)

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        const rawKey = fs.readFileSync(p, 'utf8')
        const privateKey = rawKey.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
        PRIVATE_KEY = privateKey
        console.log('✅ Private key loaded and normalized from file:', p)
        if (!p.includes(CLIENT_ID)) {
          console.warn('⚠️ Warning: Private key filename does not include CLIENT_ID; ensure this key matches the application key (kid).')
        }
        return PRIVATE_KEY
      }
    }

    throw new Error(`No private key found. Tried: ${candidatePaths.join(', ')}. Available .pem files: ${files.join(', ')}`)
  } catch (err) {
    console.error('❌ Failed to read private key file:', err)
    throw new Error('Cannot read private key file')
  }
}

function normalizePrivateKey(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
}

function isValidPrivateKey(key: string): boolean {
  return key.startsWith('-----BEGIN PRIVATE KEY-----') && key.endsWith('-----END PRIVATE KEY-----')
}

function generateJWT(clientId: string, privateKey: string, audience = 'api.enablebanking.com'): string {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: clientId
  }

  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iss: 'enablebanking.com',
    sub: clientId,
    aud: audience,
    iat: now - 30,
    exp: now + 900
  }

  console.log('JWT Header:', JSON.stringify(header))
  console.log('JWT Payload:', JSON.stringify(payload))

  const headerEncoded = Buffer.from(JSON.stringify(header)).toString('base64url')
  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  console.log('JWT Payload (base64url):', payloadEncoded)
  const signatureInput = `${headerEncoded}.${payloadEncoded}`

  console.log('Signature Input:', signatureInput.substring(0, 50) + '...')

  const signer = createSign('RSA-SHA256')
  signer.update(signatureInput)
  signer.end()

  const signatureBase64 = signer.sign(privateKey.trim(), 'base64url')
  console.log('✅ JWT signed with RS256')

  return `${signatureInput}.${signatureBase64}`
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔐 Initializing Enable Banking auth flow...')

    const privateKey = getPrivateKey()

    const audiences = [
      'api.enablebanking.com',
      'https://api.enablebanking.com'
    ]

    if (!ASPSP_COUNTRY || !ASPSP_NAME) {
      throw new Error(
        'Missing Enable Banking ASPSP configuration. Set ENABLE_BANKING_ASPSP_COUNTRY and ENABLE_BANKING_ASPSP_NAME.'
      )
    }

    const body = {
      access: {
        valid_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      },
      aspsp: {
        country: ASPSP_COUNTRY,
        name: ASPSP_NAME
      },
      state: randomUUID(),
      redirect_url: REDIRECT_URI
    }

    let lastError: { status: number; text: string } | null = null
    let response: Response | null = null

    for (const aud of audiences) {
      const jwt = generateJWT(CLIENT_ID, privateKey, aud)
      console.log('Attempting audience:', aud)

      // eslint-disable-next-line no-await-in-loop
      response = await fetch(ENABLE_BANKING_AUTH_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })

      if (response.ok) {
        console.log('✅ Enable Banking init succeeded with audience:', aud)
        break
      }

      // eslint-disable-next-line no-await-in-loop
      const text = await response.text()
      console.error('❌ Enable Banking init failed for audience', aud, response.status, text)
      lastError = { status: response.status, text }
    }

    if (!response || !response.ok) {
      return NextResponse.json(
        { error: `Enable Banking init failed: ${lastError?.status} - ${lastError?.text}` },
        { status: lastError?.status || 500 }
      )
    }

    const data = await response.json()
    console.log('✅ Auth URL generated:', data.url?.substring(0, 50) + '...')

    return NextResponse.json({ url: data.url }, { status: 200 })
  } catch (error: any) {
    console.error('❌ Bank init error:', error.message)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
