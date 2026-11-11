import { getSite, logAudit, updateSite } from '../../../../lib/admin'
import { json, requireAdmin } from '../../../../lib/auth'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const admin = requireAdmin(request)
  if (!admin.user) return admin.response
  return json({ site: getSite() })
}

export async function PUT(request: Request) {
  const admin = requireAdmin(request)
  if (!admin.user) return admin.response
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return json({ error: 'Ongeldige invoer.' }, 400)
  const before = getSite()
  const site = updateSite(body)
  const changes = (Object.keys(site) as (keyof typeof site)[]).filter(key => site[key] !== before[key]).join(', ')
  if (changes) logAudit({ id: admin.user.id, name: admin.user.username }, 'admin.site', '', `Gewijzigd: ${changes}`)
  return json({ site })
}
