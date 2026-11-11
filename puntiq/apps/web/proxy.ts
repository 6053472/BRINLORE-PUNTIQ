import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, verifySessionToken } from './lib/session'

// Optimistische controle: alleen een geldig ondertekend, niet-verlopen cookie komt door.
// De API-routes controleren daarnaast of de sessieversie nog actueel is.
export function proxy(request: NextRequest) {
  if (verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next()
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Niet ingelogd.' }, { status: 401 })
  }
  const response = NextResponse.redirect(new URL('/login', request.url))
  if (request.cookies.has(SESSION_COOKIE)) response.cookies.delete(SESSION_COOKIE)
  return response
}

export const config = {
  matcher: ['/((?!login|register|api/auth/login|api/auth/register|api/auth/logout|api/site|_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)'],
}
