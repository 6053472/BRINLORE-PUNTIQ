import { currentUser, json, unauthorized } from '../../../../lib/auth'
import { MAX_IMPORT, importProperties } from '../../../../lib/properties'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const user = currentUser(request)
  if (!user) return unauthorized()
  const body = (await request.json().catch(() => null)) as { rows?: unknown } | null
  if (!body || !Array.isArray(body.rows) || body.rows.length === 0) return json({ error: 'Geen woningen om te importeren.' }, 400)
  if (body.rows.length > MAX_IMPORT) return json({ error: `Maximaal ${MAX_IMPORT} woningen per import.` }, 400)
  try {
    return json(importProperties(user.id, body.rows), 201)
  } catch {
    return json({ error: 'Importeren is mislukt. Er is niets opgeslagen.' }, 500)
  }
}
