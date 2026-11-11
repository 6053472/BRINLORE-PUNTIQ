import { listAudit } from '../../../../lib/admin'
import { json, requireAdmin } from '../../../../lib/auth'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const admin = requireAdmin(request)
  if (!admin.user) return admin.response
  return json({ entries: listAudit(300) })
}
