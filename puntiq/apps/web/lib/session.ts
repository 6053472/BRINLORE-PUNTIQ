import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { dataDirectory } from './paths'

export const SESSION_COOKIE = 'puntiq_session'
export const SESSION_SECONDS = 60 * 60 * 8

type SessionPayload = { uid: number; v: number; exp: number }

let cachedSecret: string | null = null

function secret() {
  if (cachedSecret) return cachedSecret
  if (process.env.PUNTIQ_SESSION_SECRET) return (cachedSecret = process.env.PUNTIQ_SESSION_SECRET)
  const file = path.join(dataDirectory, '.session-secret')
  if (existsSync(file)) {
    cachedSecret = readFileSync(file, 'utf8').trim()
  } else {
    cachedSecret = randomBytes(48).toString('hex')
    writeFileSync(file, cachedSecret, { encoding: 'utf8', mode: 0o600 })
  }
  return cachedSecret
}

function sign(body: string) {
  return createHmac('sha256', secret()).update(body).digest('base64url')
}

/** Creates a signed session token. `version` invalidates all older sessions when bumped. */
export function createSessionToken(userId: number, version: number) {
  const payload: SessionPayload = { uid: userId, v: version, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${sign(body)}`
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null
  const [body, signature] = token.split('.')
  if (!body || !signature) return null
  const expected = Buffer.from(sign(body))
  const actual = Buffer.from(signature)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload
    if (!Number.isInteger(payload.uid) || payload.exp * 1000 < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export function readCookie(request: Request, name: string) {
  const raw = request.headers.get('cookie')?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))?.[1]
  return raw ? decodeURIComponent(raw) : undefined
}

export function sessionCookie(token: string) {
  return `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}; Path=/${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
}

export const clearSessionCookie = `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/`
