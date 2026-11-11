import { currentUser, json, unauthorized } from '../../../../lib/auth'
import { deleteUser } from '../../../../lib/db'
import { logAudit } from '../../../../lib/admin'
import { deleteAllProperties } from '../../../../lib/properties'
import { deleteAllRecords } from '../../../../lib/records'
import { clearSessionCookie } from '../../../../lib/session'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const user = currentUser(request)
  if (!user) return unauthorized()
  const body = await request.json().catch(() => null)
  const result = deleteUser(user.id, typeof body?.password === 'string' ? body.password : '')
  if (!result.ok) return json({ error: result.error }, 400)
  deleteAllProperties(user.id)
  deleteAllRecords(user.id)
  logAudit({ id: null, name: user.username }, 'user.self-delete', user.username)
  return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie })
}
