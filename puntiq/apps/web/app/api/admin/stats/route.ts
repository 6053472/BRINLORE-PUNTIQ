import { statSync } from 'node:fs'
import path from 'node:path'
import { listUsers } from '../../../../lib/db'
import { listAudit } from '../../../../lib/admin'
import { json, requireAdmin } from '../../../../lib/auth'
import { dataDirectory } from '../../../../lib/paths'
import { countPropertiesByUser } from '../../../../lib/properties'
import { countRecordsByUser } from '../../../../lib/records'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const admin = requireAdmin(request)
  if (!admin.user) return admin.response
  const users = listUsers()
  const sum = (map: Map<number, number>) => Array.from(map.values()).reduce((total, value) => total + value, 0)
  const weekAgo = Date.now() - 7 * 86_400_000
  let databaseBytes = 0
  try {
    databaseBytes = statSync(path.join(dataDirectory, 'puntiq.sqlite')).size
  } catch {
    // Database bestaat nog niet.
  }
  return json({
    users: users.length,
    admins: users.filter(user => user.role === 'admin').length,
    blocked: users.filter(user => user.disabled).length,
    newThisWeek: users.filter(user => Date.parse(user.createdAt) > weekAgo).length,
    activeThisWeek: users.filter(user => user.lastLoginAt && Date.parse(user.lastLoginAt) > weekAgo).length,
    properties: sum(countPropertiesByUser()),
    records: sum(countRecordsByUser()),
    databaseBytes,
    failedLogins24h: listAudit(500, 'login.failed').filter(entry => Date.parse(entry.at) > Date.now() - 86_400_000).length,
    recentUsers: users.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5).map(user => ({ id: user.id, username: user.username, email: user.email, createdAt: user.createdAt })),
  })
}
