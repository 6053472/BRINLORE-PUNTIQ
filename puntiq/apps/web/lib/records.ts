import path from 'node:path'
import { dataDirectory } from './paths'
import { convertLegacyPayment, nextInvoiceNumber } from './finance'

type SqliteStatement = {
  all: (...params: unknown[]) => Record<string, unknown>[]
  get: (...params: unknown[]) => Record<string, unknown> | undefined
  run: (...params: unknown[]) => { changes: number; lastInsertRowid: number | bigint }
}
type SqliteDatabase = { exec: (sql: string) => void; prepare: (sql: string) => SqliteStatement; close: () => void }

export function openDatabase(): SqliteDatabase {
  const getBuiltinModule = (process as unknown as { getBuiltinModule?: (name: string) => { DatabaseSync: new (file: string) => SqliteDatabase } }).getBuiltinModule
  if (!getBuiltinModule) throw new Error('Deze server vereist Node.js met ingebouwde SQLite-ondersteuning.')
  const database = new (getBuiltinModule('node:sqlite').DatabaseSync)(path.join(dataDirectory, 'puntiq.sqlite'))
  database.exec(`
    CREATE TABLE IF NOT EXISTS records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      kind TEXT NOT NULL,
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS records_user_kind ON records (user_id, kind);
  `)
  return database
}

export type RecordKind = 'tenants' | 'contracts' | 'maintenance' | 'documents' | 'invoices' | 'payments' | 'wws' | 'wwso'
type FieldSpec = { type: 'string' | 'number' | 'date' | 'enum' | 'file'; required?: boolean; options?: string[]; max?: number; min?: number }

export const schemas: Record<RecordKind, Record<string, FieldSpec>> = {
  tenants: {
    name: { type: 'string', required: true, max: 120 },
    email: { type: 'string', max: 160 },
    phone: { type: 'string', max: 40 },
    property: { type: 'string', max: 160 },
    status: { type: 'enum', options: ['Nieuw', 'Actief', 'Vertrokken'] },
    notes: { type: 'string', max: 2000 },
  },
  contracts: {
    property: { type: 'string', required: true, max: 160 },
    tenant: { type: 'string', required: true, max: 120 },
    propertyId: { type: 'number', min: 0 },
    tenantId: { type: 'number', min: 0 },
    term: { type: 'enum', options: ['Onbepaalde tijd', 'Bepaalde tijd'] },
    start: { type: 'date', required: true },
    end: { type: 'date' },
    terminatedOn: { type: 'date' },
    rent: { type: 'number', min: 0 },
    deposit: { type: 'number', min: 0 },
    status: { type: 'enum', options: ['Concept', 'Actief', 'Beëindigd'] },
    notes: { type: 'string', max: 2000 },
  },
  maintenance: {
    title: { type: 'string', required: true, max: 160 },
    property: { type: 'string', required: true, max: 160 },
    priority: { type: 'enum', options: ['Hoog', 'Gemiddeld', 'Laag'] },
    status: { type: 'enum', options: ['Open', 'In behandeling', 'Afgerond'] },
    date: { type: 'date' },
    cost: { type: 'number', min: 0 },
    contractor: { type: 'string', max: 120 },
    description: { type: 'string', max: 2000 },
  },
  documents: {
    name: { type: 'string', required: true, max: 200 },
    category: { type: 'enum', options: ['Contracten', 'WWS / WWSO', 'Onderhoud', 'Financieel', 'Overig'] },
    property: { type: 'string', max: 160 },
    contractId: { type: 'number', min: 0 },
    date: { type: 'date' },
    size: { type: 'number', min: 0 },
    mime: { type: 'string', max: 100 },
    file: { type: 'file' },
  },
  invoices: {
    number: { type: 'string', max: 40 },
    description: { type: 'string', required: true, max: 200 },
    type: { type: 'enum', options: ['Huur', 'Servicekosten', 'Borg', 'Onderhoud', 'Overig'] },
    tenant: { type: 'string', max: 120 },
    tenantId: { type: 'number', min: 0 },
    property: { type: 'string', max: 160 },
    propertyId: { type: 'number', min: 0 },
    contractId: { type: 'number', min: 0 },
    period: { type: 'string', max: 7 },
    amount: { type: 'number', required: true, min: 0 },
    issueDate: { type: 'date', required: true },
    dueDate: { type: 'date', required: true },
    status: { type: 'enum', options: ['Open', 'Geannuleerd'] },
    notes: { type: 'string', max: 2000 },
  },
  payments: {
    amount: { type: 'number', required: true, min: 0 },
    receivedOn: { type: 'date', required: true },
    method: { type: 'enum', options: ['Overboeking', 'Automatische incasso', 'iDEAL', 'Contant', 'Overig'] },
    reference: { type: 'string', max: 140 },
    invoiceId: { type: 'number', min: 0 },
    tenant: { type: 'string', max: 120 },
    tenantId: { type: 'number', min: 0 },
    property: { type: 'string', max: 160 },
    propertyId: { type: 'number', min: 0 },
    note: { type: 'string', max: 500 },
  },
  wws: {
    label: { type: 'string', required: true, max: 160 },
    property: { type: 'string', max: 160 },
    date: { type: 'date' },
    points: { type: 'number', min: 0 },
    rent: { type: 'number', min: 0 },
    segment: { type: 'string', max: 200 },
    regelset: { type: 'string', max: 80 },
    betrouwbaarheid: { type: 'enum', options: ['officieel', 'indicatief', 'onvolledig'] },
    /** Volledige invoer als JSON, zodat een berekening later opnieuw kan worden geopend. */
    invoer: { type: 'string', max: 50000 },
  },
  // WWSO-berekeningen (onzelfstandige woonruimte) staan bewust los van WWS.
  wwso: {
    label: { type: 'string', required: true, max: 160 },
    property: { type: 'string', max: 160 },
    date: { type: 'date' },
    points: { type: 'number' },
    rent: { type: 'number', min: 0 },
    regelset: { type: 'string', max: 80 },
    betrouwbaarheid: { type: 'enum', options: ['officieel', 'indicatief', 'onvolledig'] },
    invoer: { type: 'string', max: 50000 },
  },
}

const defaults: Partial<Record<RecordKind, Record<string, unknown>>> = {
  tenants: { status: 'Nieuw' },
  contracts: { status: 'Concept' },
  maintenance: { status: 'Open', priority: 'Gemiddeld' },
  documents: { category: 'Overig' },
  invoices: { status: 'Open', type: 'Huur' },
  payments: { method: 'Overboeking' },
}

export const isKind = (value: string): value is RecordKind => value in schemas
export const MAX_FILE_CHARS = 7_000_000

const isoDate = /^\d{4}-\d{2}-\d{2}$/

/** Validates and normalizes untrusted input against the schema. Unknown keys are dropped. */
export function validate(kind: RecordKind, body: unknown, partial = false): { data?: Record<string, unknown>; error?: string } {
  if (!body || typeof body !== 'object') return { error: 'Ongeldige invoer.' }
  const input = body as Record<string, unknown>
  const data: Record<string, unknown> = {}
  for (const [key, spec] of Object.entries(schemas[kind])) {
    const raw = input[key]
    if (raw === undefined || raw === null || raw === '') {
      if (spec.required && !partial) return { error: `Veld '${key}' is verplicht.` }
      if (partial && key in input && !spec.required) data[key] = spec.type === 'number' ? null : ''
      continue
    }
    if (spec.type === 'number') {
      const value = Number(raw)
      if (!Number.isFinite(value) || (spec.min !== undefined && value < spec.min)) return { error: `Veld '${key}' bevat een ongeldig getal.` }
      data[key] = Math.round(value * 100) / 100
    } else if (spec.type === 'date') {
      if (typeof raw !== 'string' || !isoDate.test(raw) || Number.isNaN(Date.parse(raw))) return { error: `Veld '${key}' bevat een ongeldige datum.` }
      data[key] = raw
    } else if (spec.type === 'enum') {
      if (typeof raw !== 'string' || !spec.options?.includes(raw)) return { error: `Veld '${key}' bevat een ongeldige waarde.` }
      data[key] = raw
    } else if (spec.type === 'file') {
      if (typeof raw !== 'string' || !/^data:[\w/+.-]+;base64,/.test(raw) || raw.length > MAX_FILE_CHARS) return { error: 'Bestand is ongeldig of groter dan 5 MB.' }
      data[key] = raw
    } else {
      if (typeof raw !== 'string') return { error: `Veld '${key}' moet tekst zijn.` }
      data[key] = raw.trim().slice(0, spec.max ?? 200)
    }
  }
  if (kind === 'contracts' && data.start && data.end && String(data.end) <= String(data.start)) return { error: 'De einddatum moet na de startdatum liggen.' }
  if (kind === 'contracts' && !partial && data.term === 'Bepaalde tijd' && !data.end) return { error: 'Vul een einddatum in voor een contract voor bepaalde tijd.' }
  if (kind === 'contracts' && data.status === 'Beëindigd' && !data.terminatedOn && !partial) data.terminatedOn = new Date().toISOString().slice(0, 10)
  if (!partial) for (const [key, value] of Object.entries(defaults[kind] ?? {})) if (data[key] === undefined) data[key] = value
  if (kind === 'payments' && data.amount !== undefined && data.amount !== null && Number(data.amount) <= 0) return { error: 'Het bedrag van een betaling moet groter zijn dan 0.' }
  if (kind === 'invoices' && data.issueDate && data.dueDate && String(data.dueDate) < String(data.issueDate)) return { error: 'De vervaldatum ligt vóór de factuurdatum.' }
  if (kind === 'invoices' && data.period !== undefined && data.period !== null && !/^\d{4}-\d{2}$/.test(String(data.period))) return { error: 'Ongeldige periode.' }
  return { data }
}

export type StoredRecord = { id: number; createdAt: string; [key: string]: unknown }

function map(row: Record<string, unknown>, withFile: boolean): StoredRecord {
  const data = JSON.parse(String(row.data_json)) as Record<string, unknown>
  if (!withFile && 'file' in data) {
    data.hasFile = Boolean(data.file)
    delete data.file
  }
  return { ...data, id: Number(row.id), createdAt: String(row.created_at) }
}

export function listRecords(userId: number, kind: RecordKind) {
  const database = openDatabase()
  try {
    return database.prepare('SELECT * FROM records WHERE user_id = ? AND kind = ? ORDER BY id DESC').all(userId, kind).map(row => map(row, false))
  } finally {
    database.close()
  }
}

export function getRecord(userId: number, kind: RecordKind, id: number, withFile = false) {
  const database = openDatabase()
  try {
    const row = database.prepare('SELECT * FROM records WHERE id = ? AND user_id = ? AND kind = ?').get(id, userId, kind)
    return row ? map(row, withFile) : null
  } finally {
    database.close()
  }
}

function invoiceNumbers(database: SqliteDatabase, userId: number, exceptId?: number) {
  return database.prepare("SELECT id, data_json FROM records WHERE user_id = ? AND kind = 'invoices'").all(userId)
    .filter(row => Number(row.id) !== exceptId)
    .map(row => String((JSON.parse(String(row.data_json)) as { number?: string }).number ?? ''))
}

/** Factuurnummers zijn uniek per gebruiker. Geeft een foutmelding of null. */
export function invoiceNumberError(userId: number, number: unknown, exceptId?: number) {
  if (typeof number !== 'string' || !number.trim()) return null
  const database = openDatabase()
  try {
    return invoiceNumbers(database, userId, exceptId).includes(number.trim()) ? `Factuurnummer ${number} bestaat al.` : null
  } finally {
    database.close()
  }
}

/** Voert de migratie uit zonder dat een fout het laden van de app blokkeert. */
export function migrateLegacyPaymentsSafely(userId: number) {
  try {
    migrateLegacyPayments(userId)
  } catch (error) {
    console.error('Migratie van oude betalingen mislukt; gegevens zijn ongewijzigd gebleven.', error)
  }
}

/**
 * Eenmalige migratie: betalingen uit het oude model (vordering met vervaldatum en status) worden
 * omgezet naar een factuur plus, als ze betaald waren, een ontvangen betaling. Idempotent en per
 * gebruiker in één transactie: lukt het niet, dan blijft alles zoals het was.
 */
export function migrateLegacyPayments(userId: number) {
  const database = openDatabase()
  try {
    const legacy = database.prepare("SELECT * FROM records WHERE user_id = ? AND kind = 'payments'").all(userId)
      .flatMap(row => {
        try {
          const data = JSON.parse(String(row.data_json)) as Record<string, unknown>
          return 'dueDate' in data && !('receivedOn' in data) ? [{ row, data }] : []
        } catch {
          return [] // Onleesbaar record: overslaan, niet de hele migratie laten mislukken.
        }
      })
    if (!legacy.length) return 0
    database.exec('BEGIN')
    try {
      const numbers = invoiceNumbers(database, userId)
      const insert = database.prepare('INSERT INTO records (user_id, kind, data_json, created_at) VALUES (?, ?, ?, ?)')
      for (const { row, data } of legacy) {
        const { invoice, payment } = convertLegacyPayment(data)
        const number = nextInvoiceNumber(numbers, Number(String(invoice.issueDate).slice(0, 4)) || new Date().getFullYear())
        numbers.push(number)
        const created = insert.run(userId, 'invoices', JSON.stringify({ ...invoice, number, migratedFrom: Number(row.id) }), String(row.created_at))
        if (payment) insert.run(userId, 'payments', JSON.stringify({ ...payment, invoiceId: Number(created.lastInsertRowid) }), String(row.created_at))
        database.prepare('DELETE FROM records WHERE id = ?').run(Number(row.id))
      }
      database.exec('COMMIT')
    } catch (error) {
      database.exec('ROLLBACK')
      throw error
    }
    return legacy.length
  } finally {
    database.close()
  }
}

export function createRecord(userId: number, kind: RecordKind, data: Record<string, unknown>) {
  const database = openDatabase()
  try {
    if (kind === 'invoices' && !data.number) {
      const year = Number(String(data.issueDate ?? '').slice(0, 4)) || new Date().getFullYear()
      data = { ...data, number: nextInvoiceNumber(invoiceNumbers(database, userId), year) }
    }
    const result = database.prepare('INSERT INTO records (user_id, kind, data_json, created_at) VALUES (?, ?, ?, ?)').run(userId, kind, JSON.stringify(data), new Date().toISOString())
    const row = database.prepare('SELECT * FROM records WHERE id = ?').get(Number(result.lastInsertRowid)) as Record<string, unknown>
    return map(row, false)
  } finally {
    database.close()
  }
}

export function updateRecord(userId: number, kind: RecordKind, id: number, patch: Record<string, unknown>) {
  const database = openDatabase()
  try {
    const row = database.prepare('SELECT * FROM records WHERE id = ? AND user_id = ? AND kind = ?').get(id, userId, kind)
    if (!row) return null
    const merged = { ...(JSON.parse(String(row.data_json)) as Record<string, unknown>), ...patch }
    for (const key of Object.keys(merged)) if (merged[key] === null) delete merged[key]
    database.prepare('UPDATE records SET data_json = ? WHERE id = ?').run(JSON.stringify(merged), id)
    return map({ ...row, data_json: JSON.stringify(merged) }, false)
  } finally {
    database.close()
  }
}

export function deleteRecord(userId: number, kind: RecordKind, id: number) {
  const database = openDatabase()
  try {
    return database.prepare('DELETE FROM records WHERE id = ? AND user_id = ? AND kind = ?').run(id, userId, kind).changes > 0
  } finally {
    database.close()
  }
}

export function deleteAllRecords(userId: number) {
  const database = openDatabase()
  try {
    database.prepare('DELETE FROM records WHERE user_id = ?').run(userId)
  } finally {
    database.close()
  }
}

export function countRecordsByUser() {
  const database = openDatabase()
  try {
    const counts = new Map<number, number>()
    for (const row of database.prepare('SELECT user_id, COUNT(*) AS n FROM records GROUP BY user_id').all()) counts.set(Number(row.user_id), Number(row.n))
    return counts
  } finally {
    database.close()
  }
}
