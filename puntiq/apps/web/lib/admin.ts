import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { dataDirectory } from './paths'
import { openDatabase } from './records'

// ---------- Auditlog ----------

function auditDatabase() {
  const database = openDatabase()
  database.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at TEXT NOT NULL,
      actor_id INTEGER,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      target TEXT NOT NULL DEFAULT '',
      detail TEXT NOT NULL DEFAULT ''
    )
  `)
  return database
}

export type AuditEntry = { id: number; at: string; actorId: number | null; actor: string; action: string; target: string; detail: string }

/** Schrijft een regel in het auditlog. Faalt stil: loggen mag een actie nooit blokkeren. */
export function logAudit(actor: { id: number | null; name: string }, action: string, target = '', detail = '') {
  try {
    const database = auditDatabase()
    try {
      database.prepare('INSERT INTO audit_log (at, actor_id, actor, action, target, detail) VALUES (?, ?, ?, ?, ?, ?)')
        .run(new Date().toISOString(), actor.id, actor.name.slice(0, 80), action, target.slice(0, 120), detail.slice(0, 300))
      database.prepare('DELETE FROM audit_log WHERE id <= (SELECT MAX(id) FROM audit_log) - 5000').run()
    } finally {
      database.close()
    }
  } catch {
    // Negeren.
  }
}

export function listAudit(limit = 200, action?: string): AuditEntry[] {
  const database = auditDatabase()
  try {
    const rows = action
      ? database.prepare('SELECT * FROM audit_log WHERE action = ? ORDER BY id DESC LIMIT ?').all(action, limit)
      : database.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?').all(limit)
    return rows.map(row => ({ id: Number(row.id), at: String(row.at), actorId: row.actor_id == null ? null : Number(row.actor_id), actor: String(row.actor), action: String(row.action), target: String(row.target), detail: String(row.detail) }))
  } finally {
    database.close()
  }
}

// ---------- Site-instellingen ----------

export type SiteSettings = {
  registrationOpen: boolean
  maintenance: boolean
  maintenanceMessage: string
  announcement: string
  announcementTone: 'info' | 'warning'
}

const defaultSite: SiteSettings = { registrationOpen: true, maintenance: false, maintenanceMessage: '', announcement: '', announcementTone: 'info' }
const siteFile = path.join(dataDirectory, 'site.json')

export function getSite(): SiteSettings {
  try {
    if (!existsSync(siteFile)) return defaultSite
    return { ...defaultSite, ...(JSON.parse(readFileSync(siteFile, 'utf8')) as Partial<SiteSettings>) }
  } catch {
    return defaultSite
  }
}

export function updateSite(patch: Partial<SiteSettings>): SiteSettings {
  const current = getSite()
  const next: SiteSettings = {
    registrationOpen: typeof patch.registrationOpen === 'boolean' ? patch.registrationOpen : current.registrationOpen,
    maintenance: typeof patch.maintenance === 'boolean' ? patch.maintenance : current.maintenance,
    maintenanceMessage: typeof patch.maintenanceMessage === 'string' ? patch.maintenanceMessage.trim().slice(0, 300) : current.maintenanceMessage,
    announcement: typeof patch.announcement === 'string' ? patch.announcement.trim().slice(0, 300) : current.announcement,
    announcementTone: patch.announcementTone === 'warning' || patch.announcementTone === 'info' ? patch.announcementTone : current.announcementTone,
  }
  const temporary = `${siteFile}.tmp`
  writeFileSync(temporary, JSON.stringify(next, null, 2), 'utf8')
  renameSync(temporary, siteFile)
  return next
}
