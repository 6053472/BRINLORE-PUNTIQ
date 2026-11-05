import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

// Node 22.5+ includes SQLite through node:sqlite (this project uses Node 26).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as {
  DatabaseSync: new (filename: string) => {
    exec(sql: string): void
    prepare(sql: string): { get(...args: unknown[]): Record<string, unknown> | undefined; run(...args: unknown[]): void }
  }
}

const workingDirectory = process.cwd()
const appDirectory = [path.join(workingDirectory, 'apps', 'web'), path.join(workingDirectory, 'puntiq', 'apps', 'web'), workingDirectory].find(directory => existsSync(path.join(directory, 'package.json'))) ?? workingDirectory
const dataDirectory = path.join(appDirectory, 'data')
mkdirSync(dataDirectory, { recursive: true })
const database = new DatabaseSync(path.join(dataDirectory, 'puntiq.sqlite'))
database.exec(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`)
try { database.exec('ALTER TABLE users ADD COLUMN email TEXT') } catch { /* column already exists */ }
try { database.exec('ALTER TABLE users ADD COLUMN avatar TEXT') } catch { /* column already exists */ }

function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
}
function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const expected = Buffer.from(hash, 'hex')
  const actual = scryptSync(password, salt, expected.length)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

if (!database.prepare('SELECT id FROM users WHERE username = ?').get('admin')) {
  database.prepare('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)').run('admin', 'admin@brinlore.nl', hashPassword(process.env.PUNTIQ_ADMIN_PASSWORD ?? 'admin12345'), 'admin')
} else {
  database.prepare('UPDATE users SET email = COALESCE(email, ?) WHERE username = ?').run('admin@brinlore.nl', 'admin')
}

export function authenticate(username: string, password: string) {
  const user = database.prepare('SELECT id, username, email, avatar, password_hash, role FROM users WHERE username = ?').get(username.trim())
  if (!user || typeof user.password_hash !== 'string' || !verifyPassword(password, user.password_hash)) return null
  return { id: Number(user.id), username: String(user.username), email: String(user.email ?? ''), avatar: String(user.avatar ?? ''), role: String(user.role) }
}

export function createUser(username: string, email: string, password: string) {
  const normalized = username.trim()
  const normalizedEmail = email.trim()
  if (!normalized || !normalizedEmail || password.length < 8) return null
  try {
    database.prepare('INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)').run(normalized, normalizedEmail, hashPassword(password), 'user')
    const created = authenticate(normalized, password)
    if (!created) console.error('[PUNTIQ] Account inserted but could not be read back:', normalized)
    return created
  } catch (error) {
    console.error('[PUNTIQ] Account creation failed:', error)
    return null
  }
}

export function usernameExists(username: string) {
  return Boolean(database.prepare('SELECT id FROM users WHERE username = ?').get(username.trim()))
}

export function getUser(id: number) {
  const user = database.prepare('SELECT id, username, email, avatar, role FROM users WHERE id = ?').get(id)
  return user ? { id: Number(user.id), username: String(user.username), email: String(user.email ?? ''), avatar: String(user.avatar ?? ''), role: String(user.role) } : null
}

export function updateUser(id: number, username: string, email: string, password?: string, avatar?: string) {
  const normalized = username.trim()
  const normalizedEmail = email.trim()
  if (!normalized || !normalizedEmail || (password && password.length < 8)) return null
  try {
    const current = getUser(id)
    const nextAvatar = avatar === undefined ? current?.avatar ?? '' : avatar
    if (password) database.prepare('UPDATE users SET username = ?, email = ?, password_hash = ?, avatar = ? WHERE id = ?').run(normalized, normalizedEmail, hashPassword(password), nextAvatar, id)
    else database.prepare('UPDATE users SET username = ?, email = ?, avatar = ? WHERE id = ?').run(normalized, normalizedEmail, nextAvatar, id)
    return getUser(id)
  } catch {
    return null
  }
}
