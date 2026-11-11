import { createUser } from '../../../../lib/db'
import { getSite, logAudit } from '../../../../lib/admin'
import { json } from '../../../../lib/auth'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!getSite().registrationOpen) return json({ error: 'Registreren is momenteel niet mogelijk. Neem contact op met de beheerder.' }, 403)
  const body = await request.json().catch(() => null)
  const result = createUser(
    typeof body?.username === 'string' ? body.username : '',
    typeof body?.email === 'string' ? body.email : '',
    typeof body?.password === 'string' ? body.password : '',
  )
  if (!result.user) return json({ error: result.error }, result.error?.includes('bestaat al') || result.error?.includes('in gebruik') ? 409 : 400)
  logAudit({ id: result.user.id, name: result.user.username }, 'user.register', result.user.username)
  return json({ message: 'Account aangemaakt. Log nu in.' }, 201)
}
