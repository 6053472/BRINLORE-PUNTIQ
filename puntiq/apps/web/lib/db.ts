import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { dataDirectory } from './paths'
import { checkProfileField } from './validation'

export type UserProfile = {
  firstName: string
  lastName: string
  phone: string
  jobTitle: string
  company: string
  kvk: string
  btw: string
  iban: string
  address: string
  postcode: string
  city: string
}

export type UserSettings = {
  theme: 'light' | 'dark' | 'system'
  compact: boolean
  reducedMotion: boolean
  emailNotifications: boolean
  emailFrequency: 'daily' | 'weekly'
  notifyContracts: boolean
  notifyMaintenance: boolean
  notifyPayments: boolean
  notifyIndexation: boolean
  contractReminderDays: number
  paymentReminderDays: number
  rentIndexation: number
  defaultPaymentTermDays: number
  landingPage: string
}

type StoredUser = {
  id: number
  username: string
  email: string
  passwordHash: string
  role: string
  avatar: string
  sessionVersion: number
  createdAt: string
  lastLoginAt?: string
  disabled?: boolean
  profile: UserProfile
  settings: UserSettings
}

export type PublicUser = Omit<StoredUser, 'passwordHash' | 'sessionVersion'>

export const defaultProfile: UserProfile = {
  firstName: '', lastName: '', phone: '', jobTitle: '', company: '', kvk: '', btw: '', iban: '', address: '', postcode: '', city: '',
}

export const defaultSettings: UserSettings = {
  theme: 'light',
  compact: false,
  reducedMotion: false,
  emailNotifications: true,
  emailFrequency: 'weekly',
  notifyContracts: true,
  notifyMaintenance: true,
  notifyPayments: true,
  notifyIndexation: true,
  contractReminderDays: 90,
  paymentReminderDays: 7,
  rentIndexation: 3.5,
  defaultPaymentTermDays: 14,
  landingPage: 'dashboard',
}

const dataFile = path.join(dataDirectory, 'users.json')

function normalize(user: Partial<StoredUser>): StoredUser {
  return {
    id: Number(user.id),
    username: String(user.username ?? ''),
    email: String(user.email ?? ''),
    passwordHash: String(user.passwordHash ?? ''),
    role: user.role ?? 'user',
    avatar: user.avatar ?? '',
    sessionVersion: user.sessionVersion ?? 1,
    createdAt: user.createdAt ?? new Date().toISOString(),
    lastLoginAt: user.lastLoginAt,
    disabled: Boolean(user.disabled),
    profile: { ...defaultProfile, ...(user.profile ?? {}) },
    settings: { ...defaultSettings, ...(user.settings ?? {}) },
  }
}

function readUsers(): StoredUser[] {
  try {
    const parsed = JSON.parse(readFileSync(dataFile, 'utf8')) as Partial<StoredUser>[]
    return Array.isArray(parsed) ? parsed.map(normalize) : []
  } catch {
    return []
  }
}

function writeUsers(users: StoredUser[]) {
  const temporary = `${dataFile}.tmp`
  writeFileSync(temporary, `${JSON.stringify(users, null, 2)}\n`, 'utf8')
  renameSync(temporary, dataFile)
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

function publicUser(user: StoredUser): PublicUser {
  const { passwordHash, sessionVersion, ...rest } = user
  void passwordHash
  void sessionVersion
  return rest
}

const nextId = (users: StoredUser[]) => users.reduce((highest, current) => Math.max(highest, current.id), 0) + 1
const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())

function seedUsers() {
  if (!existsSync(dataFile)) writeUsers([])
  const users = readUsers()
  let changed = false
  // Beheerder alleen aanmaken via PUNTIQ_ADMIN_PASSWORD; er bestaat geen standaardwachtwoord meer.
  if (process.env.PUNTIQ_ADMIN_PASSWORD && !users.some(user => user.username === 'admin')) {
    users.push(normalize({ id: nextId(users), username: 'admin', email: 'admin@brinlore.nl', passwordHash: hashPassword(process.env.PUNTIQ_ADMIN_PASSWORD), role: 'admin' }))
    changed = true
  }
  // Demo-account alleen buiten productie; het wachtwoord wordt niet meer bij elke start overschreven.
  if (process.env.NODE_ENV !== 'production' && !users.some(user => user.username === 'demo')) {
    users.push(normalize({ id: nextId(users), username: 'demo', email: 'demo@brinlore.nl', passwordHash: hashPassword('Test12345!') }))
    changed = true
  }
  if (changed) writeUsers(users)
}

seedUsers()

export function authenticate(username: string, password: string) {
  const users = readUsers()
  const user = users.find(candidate => sameText(candidate.username, username))
  if (!user || !verifyPassword(password, user.passwordHash)) return null
  if (user.disabled) return { disabled: true as const }
  user.lastLoginAt = new Date().toISOString()
  writeUsers(users)
  return { disabled: false as const, user: publicUser(user), sessionVersion: user.sessionVersion }
}

export function passwordPolicyError(password: string) {
  if (password.length < 8) return 'Het wachtwoord moet minimaal 8 tekens bevatten.'
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) return 'Gebruik minimaal één letter en één cijfer in het wachtwoord.'
  return null
}

export function createUser(username: string, email: string, password: string): { user?: PublicUser; error?: string } {
  const normalized = username.trim()
  const normalizedEmail = email.trim()
  if (normalized.length < 3 || !/^[\w.-]+$/.test(normalized)) return { error: 'Kies een gebruikersnaam van minimaal 3 tekens (letters, cijfers, punt, streepje).' }
  if (!isEmail(normalizedEmail)) return { error: 'Vul een geldig e-mailadres in.' }
  const policy = passwordPolicyError(password)
  if (policy) return { error: policy }
  const users = readUsers()
  if (users.some(user => sameText(user.username, normalized))) return { error: 'Dit account bestaat al. Log in of kies een andere gebruikersnaam.' }
  if (users.some(user => sameText(user.email, normalizedEmail))) return { error: 'Dit e-mailadres is al in gebruik.' }
  const user = normalize({ id: nextId(users), username: normalized, email: normalizedEmail, passwordHash: hashPassword(password) })
  users.push(user)
  writeUsers(users)
  return { user: publicUser(user) }
}

export function usernameExists(username: string) {
  return readUsers().some(user => sameText(user.username, username))
}

export function getUser(id: number) {
  const user = readUsers().find(candidate => candidate.id === id)
  return user ? publicUser(user) : null
}

/** Returns the user only when the session version in the token is still current. */
export function getSessionUser(id: number, version: number) {
  const user = readUsers().find(candidate => candidate.id === id)
  return user && !user.disabled && user.sessionVersion === version ? publicUser(user) : null
}

export function getSessionVersion(id: number) {
  return readUsers().find(candidate => candidate.id === id)?.sessionVersion ?? 1
}

export type ProfileUpdate = {
  username?: string
  email?: string
  avatar?: string
  profile?: Partial<UserProfile>
  settings?: Partial<UserSettings>
}

const trim = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : undefined)

export function updateUser(id: number, update: ProfileUpdate): { user?: PublicUser; error?: string } {
  const users = readUsers()
  const user = users.find(candidate => candidate.id === id)
  if (!user) return { error: 'Account niet gevonden.' }
  if (update.username !== undefined) {
    const username = update.username.trim()
    if (username.length < 3 || !/^[\w.-]+$/.test(username)) return { error: 'Kies een gebruikersnaam van minimaal 3 tekens (letters, cijfers, punt, streepje).' }
    if (users.some(other => other.id !== id && sameText(other.username, username))) return { error: 'Deze gebruikersnaam is al in gebruik.' }
    user.username = username
  }
  if (update.email !== undefined) {
    const email = update.email.trim()
    if (!isEmail(email)) return { error: 'Vul een geldig e-mailadres in.' }
    if (users.some(other => other.id !== id && sameText(other.email, email))) return { error: 'Dit e-mailadres is al in gebruik.' }
    user.email = email
  }
  if (update.avatar !== undefined) {
    if (update.avatar.length > 2_800_000) return { error: 'Profielfoto is te groot (maximaal 2 MB).' }
    if (update.avatar && !/^data:image\/(png|jpe?g|webp|gif);base64,/.test(update.avatar)) return { error: 'Ongeldige profielfoto.' }
    user.avatar = update.avatar
  }
  if (update.profile) {
    for (const key of Object.keys(defaultProfile) as (keyof UserProfile)[]) {
      const value = trim(update.profile[key], key === 'address' ? 200 : 100)
      if (value === undefined) continue
      const checked = checkProfileField(key, value)
      if (checked.error) return { error: checked.error }
      user.profile[key] = checked.value
    }
  }
  if (update.settings) {
    const s = update.settings
    const target = user.settings
    if (s.theme === 'light' || s.theme === 'dark' || s.theme === 'system') target.theme = s.theme
    for (const key of ['compact', 'reducedMotion', 'emailNotifications', 'notifyContracts', 'notifyMaintenance', 'notifyPayments', 'notifyIndexation'] as const) {
      if (typeof s[key] === 'boolean') target[key] = s[key]
    }
    if (Number.isFinite(s.contractReminderDays)) target.contractReminderDays = Math.min(365, Math.max(7, Math.round(Number(s.contractReminderDays))))
    if (s.emailFrequency === 'daily' || s.emailFrequency === 'weekly') target.emailFrequency = s.emailFrequency
    if (Number.isFinite(s.paymentReminderDays)) target.paymentReminderDays = Math.min(30, Math.max(1, Math.round(Number(s.paymentReminderDays))))
    if (Number.isFinite(s.rentIndexation)) target.rentIndexation = Math.min(25, Math.max(0, Number(s.rentIndexation)))
    if (Number.isFinite(s.defaultPaymentTermDays)) target.defaultPaymentTermDays = Math.min(90, Math.max(0, Math.round(Number(s.defaultPaymentTermDays))))
    if (typeof s.landingPage === 'string' && ['dashboard', 'properties', 'tenants', 'contracts', 'maintenance', 'finance'].includes(s.landingPage)) target.landingPage = s.landingPage
  }
  writeUsers(users)
  return { user: publicUser(user) }
}

export function changePassword(id: number, currentPassword: string, newPassword: string): { sessionVersion?: number; error?: string } {
  const users = readUsers()
  const user = users.find(candidate => candidate.id === id)
  if (!user) return { error: 'Account niet gevonden.' }
  if (!verifyPassword(currentPassword, user.passwordHash)) return { error: 'Huidig wachtwoord is onjuist.' }
  const policy = passwordPolicyError(newPassword)
  if (policy) return { error: policy }
  user.passwordHash = hashPassword(newPassword)
  user.sessionVersion += 1
  writeUsers(users)
  return { sessionVersion: user.sessionVersion }
}

/** Invalidates every existing session of this user. */
export function revokeSessions(id: number) {
  const users = readUsers()
  const user = users.find(candidate => candidate.id === id)
  if (!user) return null
  user.sessionVersion += 1
  writeUsers(users)
  return user.sessionVersion
}

export function deleteUser(id: number, password: string): { ok?: true; error?: string } {
  const users = readUsers()
  const user = users.find(candidate => candidate.id === id)
  if (!user) return { error: 'Account niet gevonden.' }
  if (user.role === 'admin') return { error: 'Het beheerdersaccount kan niet worden verwijderd.' }
  if (!verifyPassword(password, user.passwordHash)) return { error: 'Wachtwoord is onjuist.' }
  writeUsers(users.filter(candidate => candidate.id !== id))
  return { ok: true }
}

// ---------- Beheer ----------

export function listUsers() {
  return readUsers().map(publicUser)
}

export function generatePassword(length = 14) {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = randomBytes(length)
  let value = Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('')
  if (!/\d/.test(value)) value = `${value.slice(0, -1)}7`
  if (!/[a-zA-Z]/.test(value)) value = `a${value.slice(1)}`
  return value
}

export function adminCreateUser(username: string, email: string, password: string, role: 'user' | 'admin') {
  const created = createUser(username, email, password)
  if (!created.user || role === 'user') return created
  const users = readUsers()
  const user = users.find(candidate => candidate.id === created.user!.id)
  if (user) {
    user.role = 'admin'
    writeUsers(users)
    return { user: publicUser(user) }
  }
  return created
}

export function adminUpdateUser(actorId: number, id: number, patch: { role?: string; disabled?: boolean }): { user?: PublicUser; error?: string } {
  const users = readUsers()
  const user = users.find(candidate => candidate.id === id)
  if (!user) return { error: 'Gebruiker niet gevonden.' }
  const admins = users.filter(candidate => candidate.role === 'admin' && !candidate.disabled)
  if (patch.role !== undefined) {
    if (patch.role !== 'user' && patch.role !== 'admin') return { error: 'Ongeldige rol.' }
    if (id === actorId && patch.role !== 'admin') return { error: 'U kunt uw eigen beheerdersrechten niet intrekken.' }
    user.role = patch.role
  }
  if (patch.disabled !== undefined) {
    if (id === actorId && patch.disabled) return { error: 'U kunt uw eigen account niet blokkeren.' }
    if (patch.disabled && user.role === 'admin' && admins.length <= 1) return { error: 'Er moet minimaal één actieve beheerder overblijven.' }
    user.disabled = patch.disabled
    if (patch.disabled) user.sessionVersion += 1
  }
  writeUsers(users)
  return { user: publicUser(user) }
}

export function adminResetPassword(id: number): { password?: string; error?: string } {
  const users = readUsers()
  const user = users.find(candidate => candidate.id === id)
  if (!user) return { error: 'Gebruiker niet gevonden.' }
  const password = generatePassword()
  user.passwordHash = hashPassword(password)
  user.sessionVersion += 1
  writeUsers(users)
  return { password }
}

export function adminDeleteUser(actorId: number, id: number): { user?: PublicUser; error?: string } {
  const users = readUsers()
  const user = users.find(candidate => candidate.id === id)
  if (!user) return { error: 'Gebruiker niet gevonden.' }
  if (id === actorId) return { error: 'U kunt uw eigen account hier niet verwijderen.' }
  if (user.role === 'admin' && users.filter(candidate => candidate.role === 'admin' && !candidate.disabled).length <= 1) return { error: 'Er moet minimaal één actieve beheerder overblijven.' }
  writeUsers(users.filter(candidate => candidate.id !== id))
  return { user: publicUser(user) }
}
