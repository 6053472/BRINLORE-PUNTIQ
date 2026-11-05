import { NextResponse } from 'next/server'
import { authenticate } from '../../../../lib/db'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const username = typeof body?.username === 'string' ? body.username.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const user = authenticate(username, password)
  if (!user) return NextResponse.json({ error: 'Ongeldige gebruikersnaam of wachtwoord.' }, { status: 401 })
  const response = NextResponse.json({ user: { username: user.username, role: user.role } })
  response.cookies.set('puntiq_session', `${user.id}:${user.username}`, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 8, path: '/' })
  return response
}
