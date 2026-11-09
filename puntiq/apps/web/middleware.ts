import { NextRequest, NextResponse } from 'next/server'
export function middleware(request: NextRequest) {
  if (!request.cookies.has('puntiq_session')) return NextResponse.redirect(new URL('/login', request.url))
  return NextResponse.next()
}
export const config = { matcher: ['/((?!login|register|api/auth/login|api/auth/register|api/auth/logout|_next/static|_next/image|favicon.ico|brinlore-puntiq-logo.png).*)'] }
