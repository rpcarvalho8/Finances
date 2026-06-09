import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const result = await db.execute(`SELECT id, name, slug FROM businesses ORDER BY name`)
  return NextResponse.json(result.rows)
}

export async function POST(req: NextRequest) {
  try {
    const { name } = await req.json()
    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    // Generate a slug from the name (lowercase, replace spaces with hyphens, remove special characters)
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    // Generate a unique id
    const id = crypto.randomUUID()
    // Insert the business
    await db.execute({
      sql: `INSERT INTO businesses (id, name, slug) VALUES (?, ?, ?)`,
      args: [id, name, slug]
    })
    // Return the created business
    const result = await db.execute({sql: `SELECT id, name, slug FROM businesses WHERE id = ?`, args: [id]})
    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error: any) {
    // Handle unique constraint error on slug
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return NextResponse.json({ error: 'A business with this slug already exists' }, { status: 409 })
    }
    console.error('Error creating business:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 }
    )
  }
}