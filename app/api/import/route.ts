import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/guard'
import { badRequest, ledgerErrorResponse } from '@/lib/api'
import { parseId } from '@/lib/ledger'
import { commitImport, MAX_FILE_BYTES, previewImport } from '@/lib/import/pipeline'
import { getSource, IMPORT_SOURCES } from '@/lib/import/registry'

export const dynamic = 'force-dynamic'

/** Lists the formats the app can import. */
export const GET = withAuth(async () => NextResponse.json(IMPORT_SOURCES.map((s) => ({ id: s.id, label: s.label, accept: s.accept }))))

/**
 * multipart/form-data: file, source, account_id, mode=preview|commit, sha256 (commit only).
 * Preview writes nothing. Commit re-parses the same file and inserts only new rows.
 */
export const POST = withAuth(async (req: NextRequest, _ctx, user) => {
  const len = Number(req.headers.get('content-length') ?? 0)
  if (len > MAX_FILE_BYTES + 64 * 1024) return badRequest('Ficheiro demasiado grande (máx. 5 MB)', 413)
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return badRequest('Pedido inválido (esperado multipart/form-data)')
  }
  const file = form.get('file')
  if (!file || typeof file === 'string') return badRequest('Falta o ficheiro')
  if (file.size > MAX_FILE_BYTES) return badRequest('Ficheiro demasiado grande (máx. 5 MB)', 413)
  const source = getSource(form.get('source'))
  if (!source) return badRequest('Formato desconhecido')
  const accountId = parseId(String(form.get('account_id') ?? ''))
  if (accountId === null) return badRequest('Conta inválida')
  const mode = form.get('mode')
  const bytes = new Uint8Array(await file.arrayBuffer())
  try {
    if (mode === 'preview') return NextResponse.json(await previewImport(user.householdId, accountId, source, bytes))
    if (mode === 'commit') {
      const sha = form.get('sha256')
      if (typeof sha !== 'string' || !/^[0-9a-f]{64}$/.test(sha)) return badRequest('Falta a confirmação da pré-visualização')
      const fileName = (file as File).name?.split(/[\\/]/).pop() ?? null
      return NextResponse.json(await commitImport(user.householdId, user.userId, accountId, source, bytes, { expectedSha256: sha, fileName }))
    }
    return badRequest('Modo inválido')
  } catch (err) {
    return ledgerErrorResponse(err)
  }
})
