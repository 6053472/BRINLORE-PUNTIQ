import { currentUser, json, unauthorized } from '../../../../../lib/auth'
import { deleteRecord, getRecord, invoiceNumberError, isKind, listRecords, updateRecord, validate } from '../../../../../lib/records'

export const runtime = 'nodejs'
type Context = { params: Promise<{ kind: string; id: string }> }

async function resolve(request: Request, context: Context) {
  const user = currentUser(request)
  if (!user) return { response: unauthorized() }
  const { kind, id } = await context.params
  if (!isKind(kind) || !Number.isInteger(Number(id))) return { response: json({ error: 'Niet gevonden.' }, 404) }
  return { user, kind, id: Number(id) }
}

// Alleen deze typen mogen in de browser worden getoond; al het andere wordt als download aangeboden
// (voorkomt dat geüploade HTML/SVG als pagina binnen de app wordt uitgevoerd).
const INLINE_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg'])

/** Downloadt het bijgevoegde bestand van een document. Met ?inline=1 wordt een PDF of afbeelding in de browser getoond. */
export async function GET(request: Request, context: Context) {
  const r = await resolve(request, context)
  if (!r.user) return r.response
  const record = getRecord(r.user.id, r.kind, r.id, true)
  if (!record) return json({ error: 'Niet gevonden.' }, 404)
  const file = typeof record.file === 'string' ? record.file : ''
  const match = file.match(/^data:([\w/+.-]+);base64,([\s\S]*)$/)
  if (!match) return json({ error: 'Geen bestand bijgevoegd.' }, 404)
  const name = String(record.name ?? 'document').replace(/[^\w. -]/g, '_')
  const inline = new URL(request.url).searchParams.get('inline') === '1' && INLINE_TYPES.has(match[1])
  return new Response(Buffer.from(match[2], 'base64'), {
    headers: {
      'Content-Type': inline ? match[1] : 'application/octet-stream',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${name}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  })
}

export async function PUT(request: Request, context: Context) {
  const r = await resolve(request, context)
  if (!r.user) return r.response
  const { data, error } = validate(r.kind, await request.json().catch(() => null), true)
  if (!data) return json({ error }, 400)
  const numberError = r.kind === 'invoices' ? invoiceNumberError(r.user.id, data.number, r.id) : null
  if (numberError) return json({ error: numberError }, 400)
  const record = updateRecord(r.user.id, r.kind, r.id, data)
  return record ? json({ record }) : json({ error: 'Niet gevonden.' }, 404)
}

export async function DELETE(request: Request, context: Context) {
  const r = await resolve(request, context)
  if (!r.user) return r.response
  // Een factuur met geregistreerde betalingen kan niet weg; annuleer hem in plaats daarvan.
  if (r.kind === 'invoices' && listRecords(r.user.id, 'payments').some(payment => payment.invoiceId === r.id)) {
    return json({ error: 'Deze factuur heeft betalingen. Annuleer de factuur of ontkoppel eerst de betalingen.' }, 409)
  }
  return deleteRecord(r.user.id, r.kind, r.id) ? json({ ok: true }) : json({ error: 'Niet gevonden.' }, 404)
}
