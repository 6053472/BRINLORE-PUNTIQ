import { createHash } from 'node:crypto'
import { currentUser, unauthorized } from '../../../../../../lib/auth'
import { getPropertyImage } from '../../../../../../lib/properties'

export const runtime = 'nodejs'
type Context = { params: Promise<{ id: string; index: string }> }

// Alleen rasterafbeeldingen: een SVG vanaf onze eigen oorsprong zou scripts kunnen bevatten.
const SERVEABLE = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/

/** Serveert één woningfoto als echt plaatje, zodat de browser het kan cachen en lui kan laden. */
export async function GET(request: Request, context: Context) {
  const user = currentUser(request)
  if (!user) return unauthorized()
  const { id, index } = await context.params
  const dataUrl = Number.isInteger(Number(id)) && Number.isInteger(Number(index)) ? getPropertyImage(user.id, Number(id), Number(index)) : null
  if (!dataUrl) return new Response('Niet gevonden', { status: 404 })
  const match = SERVEABLE.exec(dataUrl)
  if (!match) return new Response('Niet ondersteund', { status: 415 })
  const bytes = Buffer.from(match[2], 'base64')
  const etag = `"${createHash('sha1').update(bytes).digest('hex').slice(0, 20)}"`
  const headers = { ETag: etag, 'Cache-Control': 'private, no-cache', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'" }
  if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers })
  return new Response(new Uint8Array(bytes), { headers: { ...headers, 'Content-Type': match[1], 'Content-Length': String(bytes.length) } })
}
