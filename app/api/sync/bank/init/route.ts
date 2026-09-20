import { NextRequest, NextResponse } from 'next/server'
import { createSign, randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const ENABLE_BANKING_AUTH_URL = 'https://api.enablebanking.com/auth'

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`)
  }
  return value
}

function getClientId(): string {
  return requireEnv('ENABLE_BANKING_APPLICATION_KEY')
}

function getRedirectUri(): string {
  return requireEnv('ENABLE_BANKING_REDIRECT_URI')
}

let PRIVATE_KEY: string | null = null

function getPrivateKey(): string {
  if (PRIVATE_KEY) return PRIVATE_KEY

  const envSecret = process.env.ENABLE_BANKING_APPLICATION_SECRET
  if (envSecret && envSecret.trim()) {
    const privateKeyCandidate = normalizePrivateKey(envSecret)
    if (!isValidPrivateKey(privateKeyCandidate)) {
      throw new Error(
        'ENABLE_BANKING_APPLICATION_SECRET is set but is not a valid PKCS#8 PEM private key'
      )
    }
    PRIVATE_KEY = privateKeyCandidate
    return PRIVATE_KEY
  }

  const keyPath = process.env.ENABLE_BANKING_PRIVATE_KEY_PATH?.trim()
  if (keyPath) {
    const resolved = path.resolve(keyPath)
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      throw new Error('ENABLE_BANKING_PRIVATE_KEY_PATH does not point to a readable file')
    }
    const privateKey = normalizePrivateKey(fs.readFileSync(resolved, 'utf8'))
    if (!isValidPrivateKey(privateKey)) {
      throw new Error(
        'File at ENABLE_BANKING_PRIVATE_KEY_PATH is not a valid PKCS#8 PEM private key'
      )
    }
    PRIVATE_KEY = privateKey
    return PRIVATE_KEY
  }

  throw new Error(
    'Missing Enable Banking private key. Set ENABLE_BANKING_APPLICATION_SECRET (PEM text) or ENABLE_BANKING_PRIVATE_KEY_PATH (out-of-repo file).'
  )
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

  const headerEncoded = Buffer.from(JSON.stringify(header)).toString('base64url')
  const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signatureInput = `${headerEncoded}.${payloadEncoded}`

  const signer = createSign('RSA-SHA256')
  signer.update(signatureInput)
  signer.end()

  const signatureBase64 = signer.sign(privateKey.trim(), 'base64url')

  return `${signatureInput}.${signatureBase64}`
}

export async function POST(_request: NextRequest) {
  try {
    const clientId = getClientId()
    const redirectUri = getRedirectUri()
    const aspspCountry = process.env.ENABLE_BANKING_ASPSP_COUNTRY?.trim()
    const aspspName = process.env.ENABLE_BANKING_ASPSP_NAME?.trim()

    if (!aspspCountry || !aspspName) {
      throw new Error(
        'Missing Enable Banking ASPSP configuration. Set ENABLE_BANKING_ASPSP_COUNTRY and ENABLE_BANKING_ASPSP_NAME.'
      )
    }

    const privateKey = getPrivateKey()

    const audiences = [
      'api.enablebanking.com',
      'https://api.enablebanking.com'
    ]

    const body = {
      access: {
        valid_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      },
      aspsp: {
        country: aspspCountry,
        name: aspspName
      },
      state: randomUUID(),
      redirect_url: redirectUri
    }

    let lastError: { status: number; text: string } | null = null
    let response: Response | null = null

    for (const aud of audiences) {
      const jwt = generateJWT(clientId, privateKey, aud)

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
        break
      }

      // eslint-disable-next-line no-await-in-loop
      const text = await response.text()
      console.error('Enable Banking init failed for audience', aud, response.status)
      lastError = { status: response.status, text }
    }

    if (!response || !response.ok) {
      return NextResponse.json(
        { error: `Enable Banking init failed: ${lastError?.status} - ${lastError?.text}` },
        { status: lastError?.status || 500 }
      )
    }

    const data = await response.json()

    return NextResponse.json({ url: data.url }, { status: 200 })
  } catch (error: any) {
    console.error('Bank init error:', error.message)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
