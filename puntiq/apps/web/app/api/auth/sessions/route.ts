import { clearSessionCookie } from '../../../../lib/session'
import { currentUser, json, unauthorized } from '../../../../lib/auth'
import { revokeSessions } from '../../../../lib/db'

export const runtime = 'nodejs'

/** "Overal uitloggen": maakt alle sessies van dit account ongeldig. */
export async function DELETE(request: Request) {
  const user = currentUser(request)
  if (!user) return unauthorized()
  revokeSessions(user.id)
  return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie })
}
