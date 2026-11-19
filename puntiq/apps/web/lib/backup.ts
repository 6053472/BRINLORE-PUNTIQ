import { openDatabase as openRecords, schemas, type RecordKind } from './records'
import { openDatabase as openProperties } from './properties'

/** Volledige back-up van één account: woningen (incl. foto's) en alle gegevens (incl. bestanden). */
export const BACKUP_VERSION = 1
export const MAX_BACKUP_BYTES = 120_000_000

export type Backup = {
  app: 'puntiq'
  version: number
  createdAt: string
  properties: Record<string, unknown>[]
  records: { id: number; kind: string; data: Record<string, unknown>; createdAt: string }[]
}

export function createBackup(userId: number): Backup {
  openProperties().close() // zorgt dat de tabel bestaat
  const database = openRecords()
  try {
    const properties = database.prepare('SELECT * FROM properties WHERE user_id = ? ORDER BY id').all(userId).map(row => {
      const copy = { ...row }
      delete copy.user_id
      return copy
    })
    const records = database.prepare('SELECT * FROM records WHERE user_id = ? ORDER BY id').all(userId).map(row => ({
      id: Number(row.id), kind: String(row.kind), data: JSON.parse(String(row.data_json)) as Record<string, unknown>, createdAt: String(row.created_at),
    }))
    return { app: 'puntiq', version: BACKUP_VERSION, createdAt: new Date().toISOString(), properties, records }
  } finally {
    database.close()
  }
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const REFERENCES = ['propertyId', 'tenantId', 'contractId', 'invoiceId'] as const
const REFERENCE_KIND: Record<(typeof REFERENCES)[number], RecordKind | 'properties'> = { propertyId: 'properties', tenantId: 'tenants', contractId: 'contracts', invoiceId: 'invoices' }
// Volgorde: eerst wat anderen nodig hebben (huurders, contracten, facturen), dan wat ernaar verwijst.
const ORDER: RecordKind[] = ['tenants', 'contracts', 'maintenance', 'invoices', 'payments', 'documents', 'wws', 'wwso']
const PROPERTY_COLUMNS = ['name', 'address', 'type', 'status', 'points', 'rent', 'image', 'images_json', 'area', 'rooms', 'bedrooms', 'year_built', 'energy_label', 'floor', 'price', 'description'] as const

const isNumberOrNull = (value: unknown) => value == null || (typeof value === 'number' && Number.isFinite(value))

/** Controleert de kolommen van een woning, zodat een beschadigde back-up de lijst niet onbruikbaar maakt. */
function propertyIsSane(property: Record<string, unknown>) {
  for (const column of ['points', 'rent', 'area', 'rooms', 'bedrooms', 'year_built', 'price']) if (!isNumberOrNull(property[column])) return false
  for (const column of ['type', 'status', 'image', 'energy_label', 'floor', 'description']) if (property[column] != null && typeof property[column] !== 'string') return false
  if (typeof property.image === 'string' && property.image && !property.image.startsWith('data:image/')) return false
  if (property.images_json !== undefined) {
    if (typeof property.images_json !== 'string') return false
    try {
      const images = JSON.parse(property.images_json)
      if (!Array.isArray(images) || !images.every(image => typeof image === 'string' && image.startsWith('data:image/'))) return false
    } catch {
      return false
    }
  }
  return true
}

/** Controleert dat bekende velden van een record het juiste type en een geldige waarde hebben. */
function recordIsSane(kind: RecordKind, data: Record<string, unknown>) {
  for (const [key, spec] of Object.entries(schemas[kind])) {
    const value = data[key]
    if (value == null) continue
    if (spec.type === 'number') { if (typeof value !== 'number' || !Number.isFinite(value)) return false }
    else if (spec.type === 'enum') { if (typeof value !== 'string' || !spec.options?.includes(value)) return false }
    else if (spec.type === 'file') { if (typeof value !== 'string' || !value.startsWith('data:')) return false }
    else if (typeof value !== 'string') return false
  }
  return true
}

export function parseBackup(input: unknown): { backup?: Backup; error?: string } {
  if (!isObject(input) || input.app !== 'puntiq') return { error: 'Dit is geen PUNTIQ-back-up.' }
  if (input.version !== BACKUP_VERSION) return { error: 'Deze back-up heeft een niet-ondersteunde versie.' }
  if (!Array.isArray(input.properties) || !Array.isArray(input.records)) return { error: 'De back-up is onvolledig.' }
  if (!input.properties.every(item => isObject(item) && typeof item.name === 'string' && typeof item.address === 'string')) return { error: 'De woningen in de back-up zijn ongeldig.' }
  if (!input.properties.every(item => isObject(item) && propertyIsSane(item))) return { error: 'De woningen in de back-up bevatten ongeldige waarden.' }
  for (const record of input.records) {
    if (!isObject(record) || typeof record.kind !== 'string' || !Object.hasOwn(schemas, record.kind) || !isObject(record.data)) return { error: 'De gegevens in de back-up zijn ongeldig.' }
    if (!recordIsSane(record.kind as RecordKind, record.data)) return { error: 'De gegevens in de back-up bevatten ongeldige waarden.' }
  }
  return { backup: input as unknown as Backup }
}

/**
 * Vervangt alle gegevens van het account door de back-up. Alles gebeurt in één transactie;
 * bij een fout blijft het bestaande account ongewijzigd. Koppelingen (woning, huurder, contract, factuur)
 * worden naar de nieuwe id's omgezet.
 */
export function restoreBackup(userId: number, backup: Backup) {
  openProperties().close()
  const database = openRecords()
  try {
    database.exec('BEGIN')
    try {
      database.prepare('DELETE FROM properties WHERE user_id = ?').run(userId)
      database.prepare('DELETE FROM records WHERE user_id = ?').run(userId)
      const maps: Record<string, Map<number, number>> = { properties: new Map() }
      for (const kind of ORDER) maps[kind] = new Map()

      const insertProperty = database.prepare(`INSERT INTO properties (user_id, ${PROPERTY_COLUMNS.join(', ')}) VALUES (?, ${PROPERTY_COLUMNS.map(() => '?').join(', ')})`)
      for (const property of backup.properties) {
        const values = PROPERTY_COLUMNS.map(column => {
          const value = property[column]
          return value === undefined ? (column === 'images_json' ? '[]' : null) : value
        })
        const result = insertProperty.run(userId, ...values)
        if (typeof property.id === 'number') maps.properties.set(property.id, Number(result.lastInsertRowid))
      }

      const insertRecord = database.prepare('INSERT INTO records (user_id, kind, data_json, created_at) VALUES (?, ?, ?, ?)')
      let restored = 0
      for (const kind of ORDER) {
        for (const record of backup.records.filter(item => item.kind === kind)) {
          const data = { ...record.data }
          for (const key of REFERENCES) {
            const old = data[key]
            if (typeof old !== 'number') continue
            const mapped = maps[REFERENCE_KIND[key]].get(old)
            if (mapped === undefined) delete data[key]
            else data[key] = mapped
          }
          const result = insertRecord.run(userId, kind, JSON.stringify(data), typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString())
          if (typeof record.id === 'number') maps[kind].set(record.id, Number(result.lastInsertRowid))
          restored += 1
        }
      }
      database.exec('COMMIT')
      return { properties: backup.properties.length, records: restored }
    } catch (error) {
      database.exec('ROLLBACK')
      throw error
    }
  } finally {
    database.close()
  }
}
