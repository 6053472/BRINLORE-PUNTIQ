import { clearSessionCookie } from '../../../../lib/session'
import { json } from '../../../../lib/auth'

export async function POST() {
  return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie })
}
