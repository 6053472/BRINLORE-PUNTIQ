import { authenticate } from '../../../../lib/db'

export const runtime = 'nodejs'

function json(body: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const username = typeof body?.username === 'string' ? body.username.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const user = authenticate(username, password)
  if (!user) return json({ error: 'Ongeldige gebruikersnaam of wachtwoord.' }, 401)
  return json({ user: { username: user.username, role: user.role } }, 200, {
    'Set-Cookie': `puntiq_session=${user.id}:${user.username}; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 8}; Path=/${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
  })
}
