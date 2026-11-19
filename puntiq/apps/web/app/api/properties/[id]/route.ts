import { currentUser, json, unauthorized } from '../../../../lib/auth'
import { deleteProperty, getProperty, parsePropertyInput, updateProperty } from '../../../../lib/properties'

export const runtime = 'nodejs'
type Context = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: Context) {
  const user = currentUser(request)
  if (!user) return unauthorized()
  const id = Number((await context.params).id)
  const property = Number.isInteger(id) ? getProperty(user.id, id) : null
  return property ? json({ property }) : json({ error: 'Woning niet gevonden.' }, 404)
}

export async function PUT(request: Request, context: Context) {
  const user = currentUser(request)
  if (!user) return unauthorized()
  const id = Number((await context.params).id)
  const existing = Number.isInteger(id) ? getProperty(user.id, id) : null
  if (!existing) return json({ error: 'Woning niet gevonden.' }, 404)
  const body = await request.json().catch(() => null)
  const { data, error } = parsePropertyInput(body, existing.status, existing.type)
  if (!data) return json({ error }, 400)
  // Het overzicht laadt geen foto's. Ontbreekt `images` in het verzoek, dan blijven de bestaande foto's staan.
  if (body && typeof body === 'object' && !('images' in body)) {
    data.images = existing.images
    data.image = existing.image
  }
  const property = updateProperty(user.id, id, data)
  return property ? json({ property }) : json({ error: 'Woning niet gevonden.' }, 404)
}

export async function DELETE(request: Request, context: Context) {
  const user = currentUser(request)
  if (!user) return unauthorized()
  const id = Number((await context.params).id)
  if (!Number.isInteger(id) || !deleteProperty(user.id, id)) return json({ error: 'Woning niet gevonden.' }, 404)
  return json({ ok: true })
}
