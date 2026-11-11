import { currentUser, json, unauthorized } from '../../../lib/auth'
import { createProperty, listProperties, parsePropertyInput } from '../../../lib/properties'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const user = currentUser(request)
  if (!user) return unauthorized()
  return json({ properties: listProperties(user.id) })
}

export async function POST(request: Request) {
  const user = currentUser(request)
  if (!user) return unauthorized()
  const { data, error } = parsePropertyInput(await request.json().catch(() => null))
  if (!data) return json({ error }, 400)
  return json({ property: createProperty(user.id, data) }, 201)
}
