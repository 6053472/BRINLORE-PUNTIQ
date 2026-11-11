import { currentUser, json, unauthorized } from '../../../../lib/auth'
import { getSessionVersion, updateUser } from '../../../../lib/db'
import { createSessionToken, sessionCookie } from '../../../../lib/session'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const user = currentUser(request)
  return user ? json({ user }) : unauthorized()
}

export async function PUT(request: Request) {
  const user = currentUser(request)
  if (!user) return unauthorized()
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return json({ error: 'Ongeldige invoer.' }, 400)
  const result = updateUser(user.id, {
    username: typeof body.username === 'string' ? body.username : undefined,
    email: typeof body.email === 'string' ? body.email : undefined,
    avatar: typeof body.avatar === 'string' ? body.avatar : undefined,
    profile: body.profile && typeof body.profile === 'object' ? body.profile : undefined,
    settings: body.settings && typeof body.settings === 'object' ? body.settings : undefined,
  })
  if (!result.user) return json({ error: result.error ?? 'Opslaan mislukt.' }, 400)
  return json({ user: result.user }, 200, { 'Set-Cookie': sessionCookie(createSessionToken(result.user.id, getSessionVersion(result.user.id))) })
}
