import { createUser, usernameExists } from '../../../../lib/db'

export const runtime = 'nodejs'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const username = typeof body?.username === 'string' ? body.username : ''
  const email = typeof body?.email === 'string' ? body.email : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (usernameExists(username)) return json({ error: 'Dit account bestaat al. Gebruik de loginpagina om in te loggen, of kies een andere gebruikersnaam.' }, 409)
  const user = createUser(username, email, password)
  if (!user) return json({ error: 'Vul een gebruikersnaam en e-mail in. Het wachtwoord moet minimaal 8 tekens bevatten.' }, 400)
  return json({ message: 'Account aangemaakt. Log nu in.' }, 201)
}
