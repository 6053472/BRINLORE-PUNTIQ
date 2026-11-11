import { getSite } from './admin'
import { getSessionUser } from './db'
import { SESSION_COOKIE, readCookie, verifySessionToken } from './session'

export function json(body: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } })
}

/** Resolves the signed-in user from the signed session cookie, or null. */
export function currentUser(request: Request) {
  const payload = verifySessionToken(readCookie(request, SESSION_COOKIE))
  const user = payload ? getSessionUser(payload.uid, payload.v) : null
  // Onderhoudsmodus: alleen beheerders mogen nog werken.
  return user && getSite().maintenance && user.role !== 'admin' ? null : user
}

/** Ingelogde gebruiker mét beheerdersrechten, of een kant-en-klare foutresponse. */
export function requireAdmin(request: Request) {
  const user = currentUser(request)
  if (!user) return { response: unauthorized() }
  if (user.role !== 'admin') return { response: json({ error: 'Geen toegang.' }, 403) }
  return { user }
}

export const unauthorized = () => json({ error: 'Niet ingelogd.' }, 401)

// Eenvoudige in-memory rate limiter tegen wachtwoord raden.
const attempts = new Map<string, { count: number; first: number }>()
const WINDOW_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 8

export function clientKey(request: Request, name: string) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return `${forwarded || 'local'}:${name.toLowerCase()}`
}

export function isRateLimited(key: string) {
  const entry = attempts.get(key)
  if (!entry) return false
  if (Date.now() - entry.first > WINDOW_MS) {
    attempts.delete(key)
    return false
  }
  return entry.count >= MAX_ATTEMPTS
}

export function recordFailure(key: string) {
  const entry = attempts.get(key)
  if (!entry || Date.now() - entry.first > WINDOW_MS) attempts.set(key, { count: 1, first: Date.now() })
  else entry.count += 1
}

export function clearFailures(key: string) {
  attempts.delete(key)
}

/** Zelfde controle als currentUser, maar vanuit een kale cookiewaarde (server components). */
export function userFromToken(token: string | undefined) {
  const payload = verifySessionToken(token)
  const user = payload ? getSessionUser(payload.uid, payload.v) : null
  return user && getSite().maintenance && user.role !== 'admin' ? null : user
}
