import { clearFailures, currentUser, isRateLimited, json, recordFailure, unauthorized } from '../../../../lib/auth'
import { changePassword } from '../../../../lib/db'
import { logAudit } from '../../../../lib/admin'
import { createSessionToken, sessionCookie } from '../../../../lib/session'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const user = currentUser(request)
  if (!user) return unauthorized()
  const key = `pw:${user.id}`
  if (isRateLimited(key)) return json({ error: 'Te veel mislukte pogingen. Probeer het over een paar minuten opnieuw.' }, 429)
  const body = await request.json().catch(() => null)
  const result = changePassword(user.id, typeof body?.currentPassword === 'string' ? body.currentPassword : '', typeof body?.newPassword === 'string' ? body.newPassword : '')
  if (result.sessionVersion === undefined) {
    recordFailure(key)
    logAudit({ id: user.id, name: user.username }, 'user.password-failed')
    return json({ error: result.error }, 400)
  }
  clearFailures(key)
  logAudit({ id: user.id, name: user.username }, 'user.password')
  // Alle andere sessies worden ongeldig; deze sessie blijft actief.
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(createSessionToken(user.id, result.sessionVersion)) })
}
