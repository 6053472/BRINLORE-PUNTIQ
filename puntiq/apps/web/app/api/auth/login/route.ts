import { authenticate } from '../../../../lib/db'
import { getSite, logAudit } from '../../../../lib/admin'
import { clearFailures, clientKey, isRateLimited, json, recordFailure } from '../../../../lib/auth'
import { createSessionToken, sessionCookie } from '../../../../lib/session'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const username = typeof body?.username === 'string' ? body.username.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const asAdmin = body?.admin === true
  const key = clientKey(request, username)
  if (isRateLimited(key)) return json({ error: 'Te veel mislukte pogingen. Probeer het over een paar minuten opnieuw.' }, 429)
  const result = authenticate(username, password)
  if (!result) {
    recordFailure(key)
    logAudit({ id: null, name: username || '(leeg)' }, 'login.failed', '', asAdmin ? 'Beheerderslogin' : '')
    return json({ error: 'Ongeldige gebruikersnaam of wachtwoord.' }, 401)
  }
  if (result.disabled) {
    logAudit({ id: null, name: username }, 'login.blocked', '', 'Geblokkeerd account')
    return json({ error: 'Dit account is geblokkeerd. Neem contact op met de beheerder.' }, 403)
  }
  if (asAdmin && result.user.role !== 'admin') {
    logAudit({ id: result.user.id, name: result.user.username }, 'login.denied', '', 'Beheerderslogin zonder rechten')
    return json({ error: 'Dit account heeft geen beheerdersrechten.' }, 403)
  }
  const site = getSite()
  if (site.maintenance && result.user.role !== 'admin') {
    return json({ error: site.maintenanceMessage || 'PUNTIQ is tijdelijk in onderhoud. Probeer het later opnieuw.' }, 503)
  }
  clearFailures(key)
  logAudit({ id: result.user.id, name: result.user.username }, asAdmin ? 'login.admin' : 'login')
  return json({ user: { username: result.user.username, role: result.user.role } }, 200, {
    'Set-Cookie': sessionCookie(createSessionToken(result.user.id, result.sessionVersion)),
  })
}
