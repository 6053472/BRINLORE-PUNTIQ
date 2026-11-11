import { currentUser, json, unauthorized } from '../../../../../lib/auth'
import { deleteRecord, getRecord, isKind, updateRecord, validate } from '../../../../../lib/records'

export const runtime = 'nodejs'
type Context = { params: Promise<{ kind: string; id: string }> }

async function resolve(request: Request, context: Context) {
  const user = currentUser(request)
  if (!user) return { response: unauthorized() }
  const { kind, id } = await context.params
  if (!isKind(kind) || !Number.isInteger(Number(id))) return { response: json({ error: 'Niet gevonden.' }, 404) }
  return { user, kind, id: Number(id) }
}

/** Downloadt het bijgevoegde bestand van een document. */
export async function GET(request: Request, context: Context) {
  const r = await resolve(request, context)
  if (!r.user) return r.response
  const record = getRecord(r.user.id, r.kind, r.id, true)
  if (!record) return json({ error: 'Niet gevonden.' }, 404)
  const file = typeof record.file === 'string' ? record.file : ''
  const match = file.match(/^data:([\w/+.-]+);base64,([\s\S]*)$/)
  if (!match) return json({ error: 'Geen bestand bijgevoegd.' }, 404)
  const name = String(record.name ?? 'document').replace(/[^\w. -]/g, '_')
  return new Response(Buffer.from(match[2], 'base64'), {
    headers: { 'Content-Type': match[1], 'Content-Disposition': `attachment; filename="${name}"`, 'X-Content-Type-Options': 'nosniff' },
  })
}

export async function PUT(request: Request, context: Context) {
  const r = await resolve(request, context)
  if (!r.user) return r.response
  const { data, error } = validate(r.kind, await request.json().catch(() => null), true)
  if (!data) return json({ error }, 400)
  const record = updateRecord(r.user.id, r.kind, r.id, data)
  return record ? json({ record }) : json({ error: 'Niet gevonden.' }, 404)
}

export async function DELETE(request: Request, context: Context) {
  const r = await resolve(request, context)
  if (!r.user) return r.response
  return deleteRecord(r.user.id, r.kind, r.id) ? json({ ok: true }) : json({ error: 'Niet gevonden.' }, 404)
}
