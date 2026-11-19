import { currentUser, unauthorized } from '../../../../lib/auth'
import { createBackup } from '../../../../lib/backup'
import { logAudit } from '../../../../lib/admin'

export const runtime = 'nodejs'

/** Volledige back-up (JSON) om later terug te zetten. */
export async function GET(request: Request) {
  const user = currentUser(request)
  if (!user) return unauthorized()
  logAudit({ id: user.id, name: user.username }, 'account.backup', user.username)
  const stamp = new Date().toISOString().slice(0, 10)
  return new Response(JSON.stringify(createBackup(user.id)), {
    headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="puntiq-backup-${stamp}.json"`, 'Cache-Control': 'no-store' },
  })
}
