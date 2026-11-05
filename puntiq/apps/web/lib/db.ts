import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

type StoredUser = {
  id: number
  username: string
  email: string
  passwordHash: string
  role: string
  avatar: string
}

const workingDirectory = process.cwd()
const appDirectory = [path.join(workingDirectory, 'apps', 'web'), path.join(workingDirectory, 'puntiq', 'apps', 'web'), workingDirectory].find(directory => existsSync(path.join(directory, 'package.json'))) ?? workingDirectory
const dataDirectory = path.join(appDirectory, 'data')
const dataFile = path.join(dataDirectory, 'users.json')
mkdirSync(dataDirectory, { recursive: true })

function readUsers(): StoredUser[] {
  try { return JSON.parse(readFileSync(dataFile, 'utf8')) as StoredUser[] } catch { return [] }
}

function writeUsers(users: StoredUser[]) {
  writeFileSync(dataFile, `${JSON.stringify(users, null, 2)}\n`, 'utf8')
}

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

function publicUser(user: StoredUser) {
  return { id: user.id, username: user.username, email: user.email, role: user.role, avatar: user.avatar }
}

function ensureTestUser() {
  const users = readUsers()
  if (users.some(user => user.username === 'admin')) return
  users.push({ id: 1, username: 'admin', email: 'admin@brinlore.nl', passwordHash: hashPassword(process.env.PUNTIQ_ADMIN_PASSWORD ?? 'admin12345'), role: 'admin', avatar: '' })
  writeUsers(users)
}

ensureTestUser()

function ensureDemoUser() {
  const users = readUsers()
  const existing = users.find(user => user.username === 'demo')
  if (existing) {
    existing.passwordHash = hashPassword('Test12345!')
    writeUsers(users)
    return
  }
  users.push({ id: users.reduce((highest, current) => Math.max(highest, current.id), 0) + 1, username: 'demo', email: 'demo@brinlore.nl', passwordHash: hashPassword('Test12345!'), role: 'user', avatar: '' })
  writeUsers(users)
}

ensureDemoUser()

export function authenticate(username: string, password: string) {
  const user = readUsers().find(candidate => candidate.username === username.trim())
  return user && verifyPassword(password, user.passwordHash) ? publicUser(user) : null
}

export function createUser(username: string, email: string, password: string) {
  const normalized = username.trim()
  const normalizedEmail = email.trim()
  if (!normalized || !normalizedEmail || password.length < 8) return null
  const users = readUsers()
  if (users.some(user => user.username === normalized)) return null
  const user: StoredUser = { id: users.reduce((highest, current) => Math.max(highest, current.id), 0) + 1, username: normalized, email: normalizedEmail, passwordHash: hashPassword(password), role: 'user', avatar: '' }
  users.push(user)
  writeUsers(users)
  return publicUser(user)
}

export function usernameExists(username: string) {
  return readUsers().some(user => user.username === username.trim())
}

export function getUser(id: number) {
  const user = readUsers().find(candidate => candidate.id === id)
  return user ? publicUser(user) : null
}

export function updateUser(id: number, username: string, email: string, password?: string, avatar?: string) {
  const normalized = username.trim()
  const normalizedEmail = email.trim()
  if (!normalized || !normalizedEmail || (password && password.length < 8)) return null
  const users = readUsers()
  const user = users.find(candidate => candidate.id === id)
  if (!user) return null
  user.username = normalized
  user.email = normalizedEmail
  if (password) user.passwordHash = hashPassword(password)
  if (avatar !== undefined) user.avatar = avatar
  writeUsers(users)
  return publicUser(user)
}
