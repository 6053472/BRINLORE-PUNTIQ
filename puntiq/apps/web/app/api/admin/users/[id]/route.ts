import { adminDeleteUser, adminResetPassword, adminUpdateUser, revokeSessions } from '../../../../../lib/db'
import { logAudit } from '../../../../../lib/admin'
import { json, requireAdmin } from '../../../../../lib/auth'
import { deleteAllProperties } from '../../../../../lib/properties'
import { deleteAllRecords } from '../../../../../lib/records'
import { getUser } from '../../../../../lib/db'

export const runtime = 'nodejs'
type Context = { params: Promise<{ id: string }> }

/** Acties: { role }, { disabled }, { resetPassword: true }, { revokeSessions: true } */
export async function PATCH(request: Request, context: Context) {
  const admin = requireAdmin(request)
  if (!admin.user) return admin.response
  const id = Number((await context.params).id)
  const target = Number.isInteger(id) ? getUser(id) : null
  if (!target) return json({ error: 'Gebruiker niet gevonden.' }, 404)
  const body = await request.json().catch(() => null)
  const actor = { id: admin.user.id, name: admin.user.username }

  if (body?.resetPassword === true) {
    const result = adminResetPassword(id)
    if (!result.password) return json({ error: result.error }, 400)
    logAudit(actor, 'admin.user.reset-password', target.username)
    return json({ ok: true, password: result.password })
  }
  if (body?.revokeSessions === true) {
    revokeSessions(id)
    logAudit(actor, 'admin.user.logout', target.username)
    return json({ ok: true })
  }
  const patch: { role?: string; disabled?: boolean } = {}
  if (typeof body?.role === 'string') patch.role = body.role
  if (typeof body?.disabled === 'boolean') patch.disabled = body.disabled
  const result = adminUpdateUser(admin.user.id, id, patch)
  if (!result.user) return json({ error: result.error }, 400)
  if (patch.role !== undefined) logAudit(actor, 'admin.user.role', target.username, `Rol: ${patch.role}`)
  if (patch.disabled !== undefined) logAudit(actor, patch.disabled ? 'admin.user.block' : 'admin.user.unblock', target.username)
  return json({ ok: true })
}

export async function DELETE(request: Request, context: Context) {
  const admin = requireAdmin(request)
  if (!admin.user) return admin.response
  const id = Number((await context.params).id)
  const result = Number.isInteger(id) ? adminDeleteUser(admin.user.id, id) : { error: 'Gebruiker niet gevonden.' }
  if (!('user' in result) || !result.user) return json({ error: result.error }, 400)
  deleteAllProperties(id)
  deleteAllRecords(id)
  logAudit({ id: admin.user.id, name: admin.user.username }, 'admin.user.delete', result.user.username)
  return json({ ok: true })
}
