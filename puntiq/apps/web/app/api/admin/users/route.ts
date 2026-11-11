import { adminCreateUser, listUsers } from '../../../../lib/db'
import { logAudit } from '../../../../lib/admin'
import { json, requireAdmin } from '../../../../lib/auth'
import { countPropertiesByUser } from '../../../../lib/properties'
import { countRecordsByUser } from '../../../../lib/records'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const admin = requireAdmin(request)
  if (!admin.user) return admin.response
  const properties = countPropertiesByUser()
  const records = countRecordsByUser()
  const users = listUsers().map(user => ({ id: user.id, username: user.username, email: user.email, role: user.role, disabled: Boolean(user.disabled), createdAt: user.createdAt, lastLoginAt: user.lastLoginAt, company: user.profile.company, properties: properties.get(user.id) ?? 0, records: records.get(user.id) ?? 0 }))
  return json({ users })
}

export async function POST(request: Request) {
  const admin = requireAdmin(request)
  if (!admin.user) return admin.response
  const body = await request.json().catch(() => null)
  const result = adminCreateUser(
    typeof body?.username === 'string' ? body.username : '',
    typeof body?.email === 'string' ? body.email : '',
    typeof body?.password === 'string' ? body.password : '',
    body?.role === 'admin' ? 'admin' : 'user',
  )
  if (!result.user) return json({ error: result.error }, 400)
  logAudit({ id: admin.user.id, name: admin.user.username }, 'admin.user.create', result.user.username, `Rol: ${result.user.role}`)
  return json({ ok: true }, 201)
}
