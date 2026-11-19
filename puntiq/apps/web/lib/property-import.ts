import { parseCsv, parseNumber } from './csv'

/** Kolommen van het importbestand; de sleutel is wat naar de API gaat. */
export const importColumns = [
  { key: 'name', label: 'Naam', aliases: ['naam', 'object', 'woning'] },
  { key: 'address', label: 'Adres', aliases: ['adres', 'straat'] },
  { key: 'type', label: 'Type', aliases: ['type', 'soort'] },
  { key: 'status', label: 'Status', aliases: ['status'] },
  { key: 'area', label: 'Oppervlakte (m²)', aliases: ['oppervlakte', 'oppervlaktem2', 'm2', 'gebruiksoppervlakte'] },
  { key: 'rooms', label: 'Kamers', aliases: ['kamers', 'aantalkamers'] },
  { key: 'bedrooms', label: 'Slaapkamers', aliases: ['slaapkamers'] },
  { key: 'yearBuilt', label: 'Bouwjaar', aliases: ['bouwjaar'] },
  { key: 'energyLabel', label: 'Energielabel', aliases: ['energielabel', 'label'] },
  { key: 'floor', label: 'Verdieping', aliases: ['verdieping', 'etage'] },
  { key: 'points', label: 'WWS-punten', aliases: ['wwspunten', 'punten'] },
  { key: 'rent', label: 'Huur (€)', aliases: ['huur', 'huurprijs'] },
  { key: 'price', label: 'Waarde (€)', aliases: ['waarde', 'marktwaarde'] },
  { key: 'description', label: 'Omschrijving', aliases: ['omschrijving', 'beschrijving', 'opmerking'] },
] as const

export const importTemplate: string[][] = [
  importColumns.map(column => column.label),
  ['Singel 229 – 2', 'Singel 229-2, 1012 Amsterdam', 'Zelfstandig', 'Verhuurd', '52,5', '3', '2', '2005', 'B', '2', '142', '925,50', '', ''],
]

const normalize = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '')
const properCase = (value: string, options: string[]) => options.find(option => option.toLowerCase() === value.trim().toLowerCase()) ?? ''

export type ImportRow = Record<string, string | number>
export type ParsedImport = {
  rows: ImportRow[]
  /** 1-gebaseerde regelnummers (incl. kopregel) die niet bruikbaar zijn. */
  errors: { line: number; message: string }[]
  recognized: string[]
  ignored: string[]
}

export const MAX_IMPORT_ROWS = 5000

export function parsePropertyCsv(text: string, types: string[], statuses: string[]): ParsedImport {
  const table = parseCsv(text)
  if (table.length < 2) return { rows: [], errors: [{ line: 1, message: 'Het bestand bevat geen gegevens onder de kopregel.' }], recognized: [], ignored: [] }
  const header = table[0].map(normalize)
  const columnIndex = new Map<string, number>()
  const ignored: string[] = []
  header.forEach((name, index) => {
    const column = importColumns.find(item => (item.aliases as readonly string[]).includes(name) || normalize(item.label) === name)
    if (column && !columnIndex.has(column.key)) columnIndex.set(column.key, index)
    else if (name) ignored.push(table[0][index].trim())
  })
  const recognized = importColumns.filter(column => columnIndex.has(column.key)).map(column => column.label)
  const errors: ParsedImport['errors'] = []
  if (!columnIndex.has('name') || !columnIndex.has('address')) {
    return { rows: [], errors: [{ line: 1, message: 'De kolommen "Naam" en "Adres" zijn verplicht.' }], recognized, ignored }
  }
  const rows: ImportRow[] = []
  table.slice(1).forEach((cells, offset) => {
    const line = offset + 2
    const get = (key: string) => (columnIndex.has(key) ? (cells[columnIndex.get(key)!] ?? '').trim() : '')
    const name = get('name')
    const address = get('address')
    if (!name || !address) return void errors.push({ line, message: 'Naam of adres ontbreekt.' })
    const row: ImportRow = { name, address }
    const type = properCase(get('type'), types)
    if (get('type') && !type) return void errors.push({ line, message: `Onbekend type "${get('type')}" (kies: ${types.join(', ')}).` })
    if (type) row.type = type
    const status = properCase(get('status'), statuses)
    if (get('status') && !status) return void errors.push({ line, message: `Onbekende status "${get('status')}" (kies: ${statuses.join(', ')}).` })
    if (status) row.status = status
    for (const key of ['area', 'rooms', 'bedrooms', 'yearBuilt', 'points', 'rent', 'price']) {
      const raw = get(key)
      if (!raw) continue
      const value = parseNumber(raw)
      if (value === undefined || value < 0) return void errors.push({ line, message: `"${raw}" is geen geldig getal.` })
      row[key] = value
    }
    for (const key of ['energyLabel', 'floor', 'description']) if (get(key)) row[key] = get(key)
    rows.push(row)
  })
  return { rows, errors, recognized, ignored }
}
