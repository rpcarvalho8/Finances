import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createHmac } from 'crypto'

export const dynamic = 'force-dynamic'

const ENABLE_BANKING_TOKEN_URL = 'https://api.enablebanking.com/content/v1/oauth/token'
const ENABLE_BANKING_API_URL = 'https://api.enablebanking.com/content/v1'

function signRequest(message: string, secret: string): string {
  return createHmac('sha256', secret).update(message).digest('base64')
}

async function exchangeCodeForToken(code: string): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_ENABLE_BANKING_APPLICATION_KEY
  const privateKey = process.env.ENABLE_BANKING_APPLICATION_SECRET

  if (!clientId || !privateKey) {
    throw new Error('Missing Enable Banking credentials')
  }

  const body = {
    code,
    grant_type: 'authorization_code',
    client_id: clientId,
  }

  const bodyString = JSON.stringify(body)
  const signature = signRequest(bodyString, privateKey)

  const response = await fetch(ENABLE_BANKING_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': signature,
    },
    body: bodyString,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data.access_token
}

async function fetchAccountsAndBalances(accessToken: string): Promise<any[]> {
  const response = await fetch(`${ENABLE_BANKING_API_URL}/accounts`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch accounts: ${response.status}`)
  }

  const data = await response.json()
  const accounts = data.accounts || []

  const accountsWithBalances = await Promise.all(
    accounts.map(async (account: any) => {
      try {
        const balanceRes = await fetch(
          `${ENABLE_BANKING_API_URL}/accounts/${account.resourceId}/balances`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
            },
          }
        )

        let balance = 0
        if (balanceRes.ok) {
          const balanceData = await balanceRes.json()
          const balances = balanceData.balances || []
          balance = balances.length > 0 ? balances[0].balanceAmount?.amount || 0 : 0
        }

        return {
          id: account.resourceId,
          iban: account.iban || '',
          bank: account.name || 'Unknown Bank',
          name: account.name || 'Unnamed Account',
          balance,
          currency: account.currency || 'EUR',
        }
      } catch (err) {
        console.error(`Error fetching balance for account ${account.resourceId}:`, err)
        return {
          id: account.resourceId,
          iban: account.iban || '',
          bank: account.name || 'Unknown Bank',
          name: account.name || 'Unnamed Account',
          balance: 0,
          currency: account.currency || 'EUR',
        }
      }
    })
  )

  return accountsWithBalances
}

async function fetchTransactions(
  accessToken: string,
  accountId: string,
  limit: number = 50
): Promise<any[]> {
  try {
    const response = await fetch(
      `${ENABLE_BANKING_API_URL}/accounts/${accountId}/transactions?limit=${limit}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      }
    )

    if (!response.ok) {
      console.warn(`Failed to fetch transactions for ${accountId}: ${response.status}`)
      return []
    }

    const data = await response.json()
    return data.transactions || []
  } catch (err) {
    console.error(`Error fetching transactions for account ${accountId}:`, err)
    return []
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')

    if (!code) {
      return NextResponse.json({ error: 'Missing code parameter' }, { status: 400 })
    }

    console.log('🔄 Starting Enable Banking OAuth flow with code:', code.substring(0, 10) + '...')

    // Step 1: Exchange code for access token
    const accessToken = await exchangeCodeForToken(code)
    console.log('✅ Token obtained successfully')

    // Step 2: Fetch accounts and balances
    const accounts = await fetchAccountsAndBalances(accessToken)
    console.log(`✅ Retrieved ${accounts.length} accounts`)

    // Step 3: Ensure bank_accounts table exists
    await db.execute(`
      CREATE TABLE IF NOT EXISTS bank_accounts (
        id TEXT PRIMARY KEY,
        iban TEXT,
        bank TEXT NOT NULL,
        name TEXT NOT NULL,
        balance REAL NOT NULL,
        currency TEXT DEFAULT 'EUR',
        access_token TEXT,
        last_sync TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `)

    // Step 4: Clear old data and insert real accounts
    await db.execute(`DELETE FROM bank_accounts`)
    for (const acc of accounts) {
      await db.execute({
        sql: `
          INSERT INTO bank_accounts (id, iban, bank, name, balance, currency, access_token, last_sync)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `,
        args: [acc.id, acc.iban, acc.bank, acc.name, acc.balance, acc.currency, accessToken],
      })
    }
    console.log('✅ Bank accounts saved to database')

    // Step 5: Fetch and store transactions for each account
    for (const account of accounts) {
      const transactions = await fetchTransactions(accessToken, account.id)
      console.log(`📥 Retrieved ${transactions.length} transactions for account ${account.id}`)

      for (const txn of transactions) {
        const date = txn.bookingDate || txn.valueDate || new Date().toISOString()
        const amount = txn.transactionAmount?.amount || 0
        const description = txn.remittanceInformationUnstructured || txn.additionalInformation || 'Bank Transaction'
        const type = amount >= 0 ? 'income' : 'expense'

        try {
          await db.execute({
            sql: `
              INSERT INTO transactions (
                account_id, date, description, amount, category_id, type, owner, import_id, created_at
              ) VALUES (1, ?, ?, ?, NULL, ?, 'rui', ?, datetime('now'))
            `,
            args: [date, description, Math.abs(amount), type, `enable_${account.id}_${txn.transactionId}`],
          })
        } catch (err) {
          console.warn(`Could not insert transaction for ${account.id}:`, err)
        }
      }
    }

    // Step 6: Redirect to settings with success
    const successUrl = new URL('/settings', request.url)
    successUrl.searchParams.set('bankSync', 'success')
    console.log('✅ Enable Banking sync completed successfully')
    return NextResponse.redirect(successUrl)
  } catch (error: any) {
    console.error('❌ Enable Banking callback error:', error.message)
    const errorUrl = new URL('/settings', request.url)
    errorUrl.searchParams.set('bankSync', 'error')
    errorUrl.searchParams.set('message', encodeURIComponent(error.message))
    return NextResponse.redirect(errorUrl)
  }
}
