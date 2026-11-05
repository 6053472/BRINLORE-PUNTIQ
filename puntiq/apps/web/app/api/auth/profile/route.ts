import { NextResponse } from 'next/server'
import { getUser, updateUser } from '../../../../lib/db'

export const runtime = 'nodejs'

function userId(request: Request) {
  const cookie = request.headers.get('cookie')?.match(/(?:^|;\s*)puntiq_session=([^;]+)/)?.[1]
  const value = cookie ? decodeURIComponent(cookie).match(/^(\d+):/)?.[1] : undefined
  return value ? Number(value) : null
}

export async function GET(request: Request) {
  const id = userId(request)
  const user = id ? getUser(id) : null
  return user ? NextResponse.json({ user }) : NextResponse.json({ error: 'Niet ingelogd.' }, { status: 401 })
}

export async function PUT(request: Request) {
  const id = userId(request)
  if (!id) return NextResponse.json({ error: 'Niet ingelogd.' }, { status: 401 })
  const body = await request.json().catch(() => null)
  const user = updateUser(id, typeof body?.username === 'string' ? body.username : '', typeof body?.email === 'string' ? body.email : '', typeof body?.password === 'string' && body.password ? body.password : undefined, typeof body?.avatar === 'string' ? body.avatar : undefined)
  if (!user) return NextResponse.json({ error: 'Opslaan mislukt. Controleer gebruikersnaam en wachtwoord.' }, { status: 400 })
  const response = NextResponse.json({ user })
  response.cookies.set('puntiq_session', `${user.id}:${user.username}`, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 60 * 60 * 8, path: '/' })
  return response
}
