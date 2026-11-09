import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'

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

const workingDirectory = process.cwd()
const appDirectory = [
  path.join(workingDirectory, 'apps', 'web'),
  path.join(workingDirectory, 'puntiq', 'apps', 'web'),
  workingDirectory,
].find(directory => existsSync(path.join(directory, 'package.json'))) ?? workingDirectory
const dataDirectory = path.join(appDirectory, 'data')
const databaseFile = path.join(dataDirectory, 'puntiq.sqlite')
mkdirSync(dataDirectory, { recursive: true })

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
