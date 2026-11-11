import path from 'node:path'
import { dataDirectory } from './paths'

type SqliteStatement = {
  all: (...params: unknown[]) => Record<string, unknown>[]
  get: (...params: unknown[]) => Record<string, unknown> | undefined
  run: (...params: unknown[]) => { changes: number; lastInsertRowid: number | bigint }
}

type SqliteDatabase = {
  exec: (sql: string) => void
  prepare: (sql: string) => SqliteStatement
  close: () => void
}

type SqliteRuntime = {
  DatabaseSync: new (filename: string) => SqliteDatabase
}

function getDatabaseClass() {
  const getBuiltinModule = (process as typeof process & {
    getBuiltinModule?: (name: string) => SqliteRuntime
  }).getBuiltinModule
  if (!getBuiltinModule) {
    throw new Error('Deze server vereist Node.js met ingebouwde SQLite-ondersteuning.')
  }
  return (getBuiltinModule('node:sqlite') as SqliteRuntime).DatabaseSync
}

export type StoredProperty = {
  id: number
  userId: number
  name: string
  address: string
  type: string
  status: string
  points: number
  rent: number
  image?: string
  images?: string[]
  area?: number
  rooms?: number
  bedrooms?: number
  yearBuilt?: number
  energyLabel?: string
  floor?: string
  price?: number
  description?: string
}

const databaseFile = path.join(dataDirectory, 'puntiq.sqlite')

function openDatabase() {
  const database = new (getDatabaseClass())(databaseFile)
  database.exec(`
    CREATE TABLE IF NOT EXISTS properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 0,
      rent REAL NOT NULL DEFAULT 0,
      image TEXT,
      images_json TEXT NOT NULL DEFAULT '[]',
      area REAL,
      rooms INTEGER,
      bedrooms INTEGER,
      year_built INTEGER,
      energy_label TEXT,
      floor TEXT,
      price REAL,
      description TEXT
    )
  `)
  return database
}

function mapProperty(row: Record<string, unknown>): StoredProperty {
  let images: string[] = []
  try {
    const parsed = JSON.parse(String(row.images_json ?? '[]'))
    images = Array.isArray(parsed) ? parsed.filter((image): image is string => typeof image === 'string') : []
  } catch {
    images = []
  }
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    name: String(row.name),
    address: String(row.address),
    type: String(row.type),
    status: String(row.status),
    points: Number(row.points),
    rent: Number(row.rent),
    image: row.image ? String(row.image) : undefined,
    images,
    area: row.area == null ? undefined : Number(row.area),
    rooms: row.rooms == null ? undefined : Number(row.rooms),
    bedrooms: row.bedrooms == null ? undefined : Number(row.bedrooms),
    yearBuilt: row.year_built == null ? undefined : Number(row.year_built),
    energyLabel: row.energy_label ? String(row.energy_label) : undefined,
    floor: row.floor ? String(row.floor) : undefined,
    price: row.price == null ? undefined : Number(row.price),
    description: row.description ? String(row.description) : undefined,
  }
}

export function listProperties(userId: number) {
  const database = openDatabase()
  try {
    return database.prepare('SELECT * FROM properties WHERE user_id = ? ORDER BY id DESC').all(userId).map(mapProperty)
  } finally {
    database.close()
  }
}

export function createProperty(userId: number, input: Omit<StoredProperty, 'id' | 'userId'>) {
  const database = openDatabase()
  try {
    const result = database.prepare(`
      INSERT INTO properties
        (user_id, name, address, type, status, points, rent, image, images_json, area, rooms, bedrooms, year_built, energy_label, floor, price, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      input.name,
      input.address,
      input.type,
      input.status,
      input.points,
      input.rent,
      input.image ?? null,
      JSON.stringify(input.images ?? []),
      input.area ?? null,
      input.rooms ?? null,
      input.bedrooms ?? null,
      input.yearBuilt ?? null,
      input.energyLabel ?? null,
      input.floor ?? null,
      input.price ?? null,
      input.description ?? null,
    )
    const id = Number(result.lastInsertRowid)
    return mapProperty(database.prepare('SELECT * FROM properties WHERE id = ?').get(id) as Record<string, unknown>)
  } finally {
    database.close()
  }
}

export function deleteProperty(userId: number, id: number) {
  const database = openDatabase()
  try {
    return database.prepare('DELETE FROM properties WHERE id = ? AND user_id = ?').run(id, userId).changes > 0
  } finally {
    database.close()
  }
}

export function updateProperty(userId: number, id: number, input: Omit<StoredProperty, 'id' | 'userId'>) {
  const database = openDatabase()
  try {
    const result = database.prepare(`
      UPDATE properties SET
        name = ?, address = ?, type = ?, status = ?, points = ?, rent = ?, image = ?, images_json = ?,
        area = ?, rooms = ?, bedrooms = ?, year_built = ?, energy_label = ?, floor = ?, price = ?, description = ?
      WHERE id = ? AND user_id = ?
    `).run(
      input.name, input.address, input.type, input.status, input.points, input.rent,
      input.image ?? null, JSON.stringify(input.images ?? []),
      input.area ?? null, input.rooms ?? null, input.bedrooms ?? null, input.yearBuilt ?? null,
      input.energyLabel ?? null, input.floor ?? null, input.price ?? null, input.description ?? null,
      id, userId,
    )
    if (!result.changes) return null
    return mapProperty(database.prepare('SELECT * FROM properties WHERE id = ?').get(id) as Record<string, unknown>)
  } finally {
    database.close()
  }
}

export function getProperty(userId: number, id: number) {
  const database = openDatabase()
  try {
    const row = database.prepare('SELECT * FROM properties WHERE id = ? AND user_id = ?').get(id, userId)
    return row ? mapProperty(row) : null
  } finally {
    database.close()
  }
}

export function deleteAllProperties(userId: number) {
  const database = openDatabase()
  try {
    database.prepare('DELETE FROM properties WHERE user_id = ?').run(userId)
  } finally {
    database.close()
  }
}

export const propertyStatuses = ['Beschikbaar', 'Verhuurd', 'In onderhoud']
export const propertyTypes = ['Zelfstandig', 'Onzelfstandig', 'Bedrijfsruimte']
const MAX_IMAGE_CHARS = 6_000_000

/** Validates untrusted JSON from the client into a StoredProperty payload. */
export function parsePropertyInput(body: unknown, fallbackStatus = 'Beschikbaar'): { data?: Omit<StoredProperty, 'id' | 'userId'>; error?: string } {
  if (!body || typeof body !== 'object') return { error: 'Ongeldige invoer.' }
  const b = body as Record<string, unknown>
  const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')
  const num = (value: unknown, min = 0, max = 1e9) => {
    const n = Number(value)
    return value !== '' && value != null && Number.isFinite(n) && n >= min && n <= max ? n : undefined
  }
  const name = text(b.name, 160)
  const address = text(b.address, 200)
  if (!name || !address) return { error: 'Naam en adres zijn verplicht.' }
  const type = typeof b.type === 'string' && propertyTypes.includes(b.type) ? b.type : 'Zelfstandig'
  const status = typeof b.status === 'string' && propertyStatuses.includes(b.status) ? b.status : fallbackStatus
  const images = Array.isArray(b.images) ? b.images.filter((image): image is string => typeof image === 'string' && image.startsWith('data:image/')).slice(0, 12) : []
  if (images.some(image => image.length > MAX_IMAGE_CHARS)) return { error: 'Een foto is te groot (maximaal 4 MB per foto).' }
  return {
    data: {
      name, address, type, status,
      points: Math.round(num(b.points, 0, 1000) ?? 0),
      rent: num(b.rent) ?? 0,
      image: images[0] ?? '',
      images,
      area: num(b.area, 1, 100000),
      rooms: num(b.rooms, 1, 200),
      bedrooms: num(b.bedrooms, 0, 100),
      yearBuilt: num(b.yearBuilt, 1000, 2100),
      energyLabel: text(b.energyLabel, 8),
      floor: text(b.floor, 60),
      price: num(b.price),
      description: text(b.description, 4000),
    },
  }
}

export function countPropertiesByUser() {
  const database = openDatabase()
  try {
    const counts = new Map<number, number>()
    for (const row of database.prepare('SELECT user_id, COUNT(*) AS n FROM properties GROUP BY user_id').all()) counts.set(Number(row.user_id), Number(row.n))
    return counts
  } finally {
    database.close()
  }
}
