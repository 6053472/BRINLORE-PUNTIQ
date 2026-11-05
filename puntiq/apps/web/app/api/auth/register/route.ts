import { NextResponse } from 'next/server'
import { createUser, usernameExists } from '../../../../lib/db'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const username = typeof body?.username === 'string' ? body.username : ''
  const email = typeof body?.email === 'string' ? body.email : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (usernameExists(username)) return NextResponse.json({ error: 'Dit account bestaat al. Gebruik de loginpagina om in te loggen, of kies een andere gebruikersnaam.' }, { status: 409 })
  const user = createUser(username, email, password)
  if (!user) return NextResponse.json({ error: 'Vul een gebruikersnaam en e-mail in. Het wachtwoord moet minimaal 8 tekens bevatten.' }, { status: 400 })
  return NextResponse.json({ message: 'Account aangemaakt. Log nu in.' }, { status: 201 })
}
