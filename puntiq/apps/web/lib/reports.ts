/**
 * Rapportages. Elke rapportbouwer zet de gegevens om naar een neutraal `ReportDocument`
 * (secties met kerncijfers en tabellen met getypeerde kolommen). Voorbeeldweergave, PDF en Excel
 * renderen allemaal hetzelfde document, zodat de inhoud altijd overeenkomt.
 */
import { aging, groupBy, invoiceViews, propertyKey, tenantKey, totals } from './finance'
import { contractState } from './notifications'
import { monthKey } from './format'
import type { Contract, Invoice, Maintenance, Payment, Property, Tenant, WwsCalculation, WwsoCalculation } from './types'

export type ColumnType = 'text' | 'money' | 'number' | 'date' | 'percent'
export type Cell = string | number | null
export type ReportColumn = { key: string; label: string; type: ColumnType; width?: number }
export type ReportTable = { columns: ReportColumn[]; rows: Record<string, Cell>[]; totals?: Record<string, Cell> }
export type Kpi = { label: string; value: Cell; type: ColumnType }
export type ReportSection = { title: string; description?: string; kpis?: Kpi[]; table?: ReportTable; empty?: string }
export type ReportDocument = {
  id: ReportId
  title: string
  company: string
  generatedAt: string
  generatedBy: string
  period?: { from: string; to: string }
  filters: string[]
  sections: ReportSection[]
  disclaimer?: string
}

export type ReportId = 'vastgoed' | 'huurders' | 'inkomsten' | 'onderhoud' | 'wws'
export const reportTypes: { id: ReportId; title: string; description: string; icon: string; usesPeriod: boolean }[] = [
  { id: 'vastgoed', title: 'Vastgoedportefeuille', description: 'Objecten, bezetting, huurprijzen en WWS-punten.', icon: 'building', usesPeriod: false },
  { id: 'huurders', title: 'Huurders', description: 'Huurders met contract, huur en betaalstatus.', icon: 'users', usesPeriod: false },
  { id: 'inkomsten', title: 'Huurinkomsten', description: 'Gefactureerd, ontvangen, openstaand en achterstanden.', icon: 'euro', usesPeriod: true },
  { id: 'onderhoud', title: 'Onderhoud', description: 'Verzoeken, status, prioriteit en kosten per woning.', icon: 'wrench', usesPeriod: true },
  { id: 'wws', title: 'WWS- en WWSO-berekeningen', description: 'Puntentellingen, maximale huur en betrouwbaarheid.', icon: 'calc', usesPeriod: true },
]

export type ReportData = {
  properties: Property[]
  tenants: Tenant[]
  contracts: Contract[]
  invoices: Invoice[]
  payments: Payment[]
  maintenance: Maintenance[]
  wws: WwsCalculation[]
  wwso: WwsoCalculation[]
}

export type ReportOptions = {
  from: string
  to: string
  /** Filter op één woning (id); leeg = alle woningen. */
  propertyId?: number
  company: string
  generatedBy: string
  now: string
  contractReminderDays: number
}

const round2 = (value: number) => Math.round(value * 100) / 100
const sum = <T,>(items: T[], pick: (item: T) => number | undefined) => round2(items.reduce((total, item) => total + (pick(item) ?? 0), 0))
const share = (part: number, whole: number) => (whole ? round2(part / whole) : 0)
const inPeriod = (date: string | undefined, options: ReportOptions) => Boolean(date) && date! >= options.from && date! <= options.to

function scope(data: ReportData, options: ReportOptions) {
  const property = options.propertyId ? data.properties.find(item => item.id === options.propertyId) : undefined
  const onProperty = (item: { property?: string; propertyId?: number }) =>
    !property || item.propertyId === property.id || (!item.propertyId && item.property === property.name)
  return {
    property,
    properties: property ? [property] : data.properties,
    contracts: data.contracts.filter(onProperty),
    invoices: data.invoices.filter(onProperty),
    payments: data.payments.filter(onProperty),
    maintenance: data.maintenance.filter(onProperty),
    tenants: property ? data.tenants.filter(tenant => tenant.property === property.name || data.contracts.some(c => onProperty(c) && (c.tenantId === tenant.id || c.tenant === tenant.name))) : data.tenants,
    wws: data.wws.filter(onProperty),
    wwso: data.wwso.filter(onProperty),
  }
}

function header(id: ReportId, options: ReportOptions, scoped: ReturnType<typeof scope>, usesPeriod: boolean): Omit<ReportDocument, 'sections'> {
  const type = reportTypes.find(item => item.id === id)!
  return {
    id,
    title: type.title,
    company: options.company,
    generatedAt: options.now,
    generatedBy: options.generatedBy,
    period: usesPeriod ? { from: options.from, to: options.to } : undefined,
    filters: [scoped.property ? `Woning: ${scoped.property.name}` : 'Alle woningen', ...(usesPeriod ? [] : [`Stand per ${formatCell(options.now, 'date')}`])],
  }
}

/* ---------- Vastgoed ---------- */

function vastgoed(data: ReportData, options: ReportOptions): ReportDocument {
  const s = scope(data, options)
  const active = (property: Property) => s.contracts.find(c => c.status === 'Actief' && (c.propertyId === property.id || (!c.propertyId && c.property === property.name)))
  const statuses = [...new Set(s.properties.map(item => item.status))]
  const rented = s.properties.filter(item => item.status === 'Verhuurd').length
  const scored = s.properties.filter(item => item.points > 0)
  return {
    ...header('vastgoed', options, s, false),
    sections: [
      {
        title: 'Samenvatting',
        kpis: [
          { label: 'Objecten', value: s.properties.length, type: 'number' },
          { label: 'Verhuurd', value: rented, type: 'number' },
          { label: 'Bezettingsgraad', value: share(rented, s.properties.length), type: 'percent' },
          { label: 'Huur per maand (objecten)', value: sum(s.properties, item => item.rent), type: 'money' },
          { label: 'Gemiddeld WWS-punten', value: scored.length ? Math.round(sum(scored, item => item.points) / scored.length) : null, type: 'number' },
        ],
      },
      {
        title: 'Per status',
        table: {
          columns: [{ key: 'status', label: 'Status', type: 'text' }, { key: 'count', label: 'Aantal', type: 'number' }, { key: 'share', label: 'Aandeel', type: 'percent' }, { key: 'rent', label: 'Huur per maand', type: 'money' }],
          rows: statuses.map(status => {
            const items = s.properties.filter(item => item.status === status)
            return { status, count: items.length, share: share(items.length, s.properties.length), rent: sum(items, item => item.rent) }
          }),
        },
        empty: 'Geen objecten.',
      },
      {
        title: 'Objecten',
        table: {
          columns: [
            { key: 'name', label: 'Object', type: 'text', width: 24 }, { key: 'address', label: 'Adres', type: 'text', width: 28 },
            { key: 'type', label: 'Type', type: 'text' }, { key: 'status', label: 'Status', type: 'text' },
            { key: 'area', label: 'm²', type: 'number' }, { key: 'label', label: 'Energielabel', type: 'text' },
            { key: 'points', label: 'WWS-punten', type: 'number' }, { key: 'rent', label: 'Huur p/m', type: 'money' },
            { key: 'tenant', label: 'Huurder', type: 'text', width: 20 }, { key: 'end', label: 'Contract tot', type: 'date' },
          ],
          rows: s.properties.map(item => {
            const contract = active(item)
            return {
              name: item.name, address: item.address, type: item.type, status: item.status, area: item.area ?? null,
              label: item.energyLabel || null, points: item.points || null, rent: item.rent || null,
              tenant: contract?.tenant ?? null, end: contract?.end ?? null,
            }
          }),
          totals: { name: 'Totaal', area: sum(s.properties, item => item.area), rent: sum(s.properties, item => item.rent) },
        },
        empty: 'Geen objecten.',
      },
    ],
  }
}

/* ---------- Huurders ---------- */

function huurders(data: ReportData, options: ReportOptions): ReportDocument {
  const s = scope(data, options)
  const views = invoiceViews(s.invoices, s.payments, options.now)
  const finance = new Map(groupBy(views, s.payments, tenantKey).map(row => [row.key, row]))
  const rows = s.tenants.map(tenant => {
    const contract = s.contracts.find(c => (c.tenantId === tenant.id || (!c.tenantId && c.tenant === tenant.name)) && c.status !== 'Concept')
    const money = finance.get(`t${tenant.id}`) ?? finance.get(`n:${tenant.name}`)
    return {
      name: tenant.name, email: tenant.email ?? null, phone: tenant.phone ?? null, property: contract?.property ?? tenant.property ?? null,
      status: tenant.status, start: contract?.start ?? null, end: contract?.end ?? null,
      contractState: contract ? contractState(contract, options.contractReminderDays, options.now) : null,
      rent: contract?.rent ?? null, open: money?.open ?? 0, overdue: money?.overdue ?? 0,
    }
  })
  return {
    ...header('huurders', options, s, false),
    sections: [
      {
        title: 'Samenvatting',
        kpis: [
          { label: 'Huurders', value: rows.length, type: 'number' },
          { label: 'Actief', value: rows.filter(row => row.status === 'Actief').length, type: 'number' },
          { label: 'Met achterstand', value: rows.filter(row => row.overdue > 0).length, type: 'number' },
          { label: 'Totaal achterstallig', value: sum(rows, row => row.overdue), type: 'money' },
        ],
      },
      {
        title: 'Huurders',
        table: {
          columns: [
            { key: 'name', label: 'Huurder', type: 'text', width: 22 }, { key: 'email', label: 'E-mail', type: 'text', width: 26 },
            { key: 'phone', label: 'Telefoon', type: 'text', width: 14 }, { key: 'property', label: 'Woning', type: 'text', width: 22 },
            { key: 'status', label: 'Status', type: 'text' }, { key: 'start', label: 'Contract vanaf', type: 'date' },
            { key: 'end', label: 'Contract tot', type: 'date' }, { key: 'contractState', label: 'Contractstatus', type: 'text', width: 18 },
            { key: 'rent', label: 'Huur p/m', type: 'money' }, { key: 'open', label: 'Openstaand', type: 'money' }, { key: 'overdue', label: 'Achterstallig', type: 'money' },
          ],
          rows: rows.sort((a, b) => b.overdue - a.overdue || a.name.localeCompare(b.name)),
          totals: { name: 'Totaal', rent: sum(rows, row => row.rent ?? 0), open: sum(rows, row => row.open), overdue: sum(rows, row => row.overdue) },
        },
        empty: 'Geen huurders.',
      },
    ],
  }
}

/* ---------- Huurinkomsten ---------- */

function monthsBetween(from: string, to: string) {
  const months: string[] = []
  let [y, m] = [Number(from.slice(0, 4)), Number(from.slice(5, 7))]
  const end = monthKey(to)
  while (months.length < 60) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    if (key > end) break
    months.push(key)
    m += 1
    if (m > 12) { m = 1; y += 1 }
  }
  return months
}

function inkomsten(data: ReportData, options: ReportOptions): ReportDocument {
  const s = scope(data, options)
  const views = invoiceViews(s.invoices, s.payments, options.now)
  const period = { from: options.from, to: options.to }
  const t = totals(views, s.payments, period)
  const periodPayments = s.payments.filter(payment => inPeriod(payment.receivedOn, options))
  const periodViews = views.filter(view => inPeriod(view.issueDate, options))
  const groupColumns: ReportColumn[] = [
    { key: 'label', label: 'Naam', type: 'text', width: 26 }, { key: 'invoiced', label: 'Gefactureerd', type: 'money' }, { key: 'received', label: 'Ontvangen', type: 'money' },
    { key: 'open', label: 'Openstaand', type: 'money' }, { key: 'overdue', label: 'Achterstallig', type: 'money' }, { key: 'oldestDue', label: 'Oudste achterstand', type: 'date' },
  ]
  const groupRows = (key: typeof tenantKey | typeof propertyKey) => groupBy(periodViews, periodPayments, key).map(row => ({ label: row.label, invoiced: row.invoiced, received: row.received, open: row.open, overdue: row.overdue, oldestDue: row.oldestDue ?? null }))
  const months = monthsBetween(options.from, options.to).map(month => {
    const invoiced = sum(views.filter(view => view.state !== 'Geannuleerd' && monthKey(view.issueDate) === month), view => view.amount)
    const received = sum(s.payments.filter(payment => monthKey(payment.receivedOn) === month), payment => payment.amount)
    const label = new Intl.DateTimeFormat('nl-NL', { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T00:00:00`))
    return { month: label, invoiced, received, difference: round2(received - invoiced) }
  })
  const open = views.filter(view => view.balance > 0 && view.state !== 'Geannuleerd').sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  return {
    ...header('inkomsten', options, s, true),
    disclaimer: 'Gefactureerd en ontvangen hebben betrekking op de gekozen periode; openstaand en achterstallig zijn de stand op de datum van dit rapport.',
    sections: [
      {
        title: 'Samenvatting',
        kpis: [
          { label: 'Gefactureerd', value: t.invoiced, type: 'money' },
          { label: 'Ontvangen', value: t.received, type: 'money' },
          { label: 'Ontvangen / gefactureerd', value: share(t.received, t.invoiced), type: 'percent' },
          { label: 'Openstaand (nu)', value: t.open, type: 'money' },
          { label: 'Achterstallig (nu)', value: t.overdue, type: 'money' },
        ],
      },
      {
        title: 'Per maand',
        table: {
          columns: [{ key: 'month', label: 'Maand', type: 'text' }, { key: 'invoiced', label: 'Gefactureerd', type: 'money' }, { key: 'received', label: 'Ontvangen', type: 'money' }, { key: 'difference', label: 'Verschil', type: 'money' }],
          rows: months,
          totals: { month: 'Totaal', invoiced: sum(months, row => row.invoiced), received: sum(months, row => row.received), difference: sum(months, row => row.difference) },
        },
      },
      { title: 'Per woning', table: { columns: groupColumns, rows: groupRows(propertyKey) }, empty: 'Geen facturen of betalingen in deze periode.' },
      { title: 'Per huurder', table: { columns: groupColumns, rows: groupRows(tenantKey) }, empty: 'Geen facturen of betalingen in deze periode.' },
      {
        title: 'Ouderdom achterstanden',
        table: {
          columns: [{ key: 'label', label: 'Dagen na vervaldatum', type: 'text' }, { key: 'count', label: 'Facturen', type: 'number' }, { key: 'amount', label: 'Bedrag', type: 'money' }],
          rows: aging(views).map(bucket => ({ label: bucket.label, count: bucket.count, amount: bucket.amount })),
          totals: { label: 'Totaal', count: aging(views).reduce((n, bucket) => n + bucket.count, 0), amount: t.overdue },
        },
      },
      {
        title: 'Openstaande facturen',
        table: {
          columns: [
            { key: 'number', label: 'Factuur', type: 'text' }, { key: 'tenant', label: 'Huurder', type: 'text', width: 20 }, { key: 'property', label: 'Woning', type: 'text', width: 20 },
            { key: 'description', label: 'Omschrijving', type: 'text', width: 30 }, { key: 'dueDate', label: 'Vervaldatum', type: 'date' },
            { key: 'days', label: 'Dagen te laat', type: 'number' }, { key: 'balance', label: 'Openstaand', type: 'money' },
          ],
          rows: open.map(view => ({ number: view.number, tenant: view.tenant ?? null, property: view.property ?? null, description: view.description, dueDate: view.dueDate, days: view.daysOverdue || null, balance: view.balance })),
          totals: { number: 'Totaal', balance: sum(open, view => view.balance) },
        },
        empty: 'Geen openstaande facturen.',
      },
    ],
  }
}

/* ---------- Onderhoud ---------- */

function onderhoud(data: ReportData, options: ReportOptions): ReportDocument {
  const s = scope(data, options)
  const items = s.maintenance.filter(item => inPeriod(item.date ?? item.createdAt.slice(0, 10), options))
  const byProperty = [...new Set(items.map(item => item.property))].map(property => {
    const list = items.filter(item => item.property === property)
    return { property, count: list.length, open: list.filter(item => item.status !== 'Afgerond').length, urgent: list.filter(item => item.priority === 'Hoog').length, cost: sum(list, item => item.cost) }
  }).sort((a, b) => b.cost - a.cost)
  const cost = sum(items, item => item.cost)
  const withCost = items.filter(item => item.cost)
  return {
    ...header('onderhoud', options, s, true),
    sections: [
      {
        title: 'Samenvatting',
        kpis: [
          { label: 'Verzoeken', value: items.length, type: 'number' },
          { label: 'Open of in behandeling', value: items.filter(item => item.status !== 'Afgerond').length, type: 'number' },
          { label: 'Hoge prioriteit (open)', value: items.filter(item => item.priority === 'Hoog' && item.status !== 'Afgerond').length, type: 'number' },
          { label: 'Totale kosten', value: cost, type: 'money' },
          { label: 'Gemiddelde kosten', value: withCost.length ? round2(cost / withCost.length) : null, type: 'money' },
        ],
      },
      {
        title: 'Per status en prioriteit',
        table: {
          columns: [{ key: 'status', label: 'Status', type: 'text' }, { key: 'Hoog', label: 'Hoog', type: 'number' }, { key: 'Gemiddeld', label: 'Gemiddeld', type: 'number' }, { key: 'Laag', label: 'Laag', type: 'number' }, { key: 'cost', label: 'Kosten', type: 'money' }],
          rows: ['Open', 'In behandeling', 'Afgerond'].map(status => {
            const list = items.filter(item => item.status === status)
            return { status, Hoog: list.filter(item => item.priority === 'Hoog').length, Gemiddeld: list.filter(item => item.priority === 'Gemiddeld').length, Laag: list.filter(item => item.priority === 'Laag').length, cost: sum(list, item => item.cost) }
          }),
        },
      },
      {
        title: 'Per woning',
        table: {
          columns: [{ key: 'property', label: 'Woning', type: 'text', width: 26 }, { key: 'count', label: 'Verzoeken', type: 'number' }, { key: 'open', label: 'Open', type: 'number' }, { key: 'urgent', label: 'Hoge prioriteit', type: 'number' }, { key: 'cost', label: 'Kosten', type: 'money' }],
          rows: byProperty,
          totals: { property: 'Totaal', count: items.length, cost },
        },
        empty: 'Geen onderhoud in deze periode.',
      },
      {
        title: 'Verzoeken',
        table: {
          columns: [
            { key: 'date', label: 'Datum', type: 'date' }, { key: 'title', label: 'Verzoek', type: 'text', width: 30 }, { key: 'property', label: 'Woning', type: 'text', width: 22 },
            { key: 'priority', label: 'Prioriteit', type: 'text' }, { key: 'status', label: 'Status', type: 'text' }, { key: 'contractor', label: 'Uitvoerder', type: 'text', width: 20 }, { key: 'cost', label: 'Kosten', type: 'money' },
          ],
          rows: items.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).map(item => ({ date: item.date ?? null, title: item.title, property: item.property, priority: item.priority, status: item.status, contractor: item.contractor ?? null, cost: item.cost ?? null })),
          totals: { date: 'Totaal', cost },
        },
        empty: 'Geen onderhoud in deze periode.',
      },
    ],
  }
}

/* ---------- WWS en WWSO ---------- */

function wws(data: ReportData, options: ReportOptions): ReportDocument {
  const s = scope(data, options)
  const ws = s.wws.filter(item => inPeriod(item.date ?? item.createdAt.slice(0, 10), options))
  const wso = s.wwso.filter(item => inPeriod(item.date ?? item.createdAt.slice(0, 10), options))
  const all = [...ws, ...wso]
  const scored = all.filter(item => typeof item.points === 'number')
  const count = (value: string) => all.filter(item => item.betrouwbaarheid === value).length
  const withoutCalc = s.properties.filter(property => property.type !== 'Bedrijfsruimte' && !data.wws.some(item => item.property === property.name) && !data.wwso.some(item => item.property === property.name))
  const columns: ReportColumn[] = [
    { key: 'label', label: 'Object', type: 'text', width: 26 }, { key: 'property', label: 'Woning', type: 'text', width: 20 }, { key: 'date', label: 'Peildatum', type: 'date' },
    { key: 'points', label: 'Punten', type: 'number' }, { key: 'segment', label: 'Segment', type: 'text', width: 16 }, { key: 'rent', label: 'Max. huur', type: 'money' },
    { key: 'reliability', label: 'Uitkomst', type: 'text' }, { key: 'ruleset', label: 'Regelset', type: 'text', width: 28 },
  ]
  const row = (item: WwsCalculation | WwsoCalculation) => ({
    label: item.label, property: item.property || null, date: item.date ?? null, points: item.points ?? null,
    segment: 'segment' in item ? item.segment || null : null, rent: item.rent ?? null,
    reliability: item.betrouwbaarheid ? item.betrouwbaarheid[0].toUpperCase() + item.betrouwbaarheid.slice(1) : 'Oud model', ruleset: item.regelset ?? null,
  })
  return {
    ...header('wws', options, s, true),
    disclaimer: 'Uitkomsten zijn zo betrouwbaar als de gebruikte regelset. "Indicatief" betekent dat (een deel van) de rekenregels nog niet is geverifieerd tegen de officiële bron; "Onvolledig" dat niet alle rubrieken konden worden bepaald. Gebruik alleen "Officieel" gemarkeerde uitkomsten als formele onderbouwing.',
    sections: [
      {
        title: 'Samenvatting',
        kpis: [
          { label: 'WWS-berekeningen', value: ws.length, type: 'number' },
          { label: 'WWSO-berekeningen', value: wso.length, type: 'number' },
          { label: 'Gemiddeld aantal punten', value: scored.length ? Math.round(sum(scored, item => item.points) / scored.length) : null, type: 'number' },
          { label: 'Officieel / indicatief / onvolledig', value: `${count('officieel')} / ${count('indicatief')} / ${count('onvolledig')}`, type: 'text' },
        ],
      },
      { title: 'WWS — zelfstandige woonruimte', table: { columns, rows: ws.map(row) }, empty: 'Geen WWS-berekeningen in deze periode.' },
      { title: 'WWSO — onzelfstandige woonruimte', table: { columns, rows: wso.map(row) }, empty: 'Geen WWSO-berekeningen in deze periode.' },
      {
        title: 'Woningen zonder berekening',
        description: 'Woningen (geen bedrijfsruimte) waarvoor nog geen WWS- of WWSO-berekening is opgeslagen.',
        table: { columns: [{ key: 'name', label: 'Woning', type: 'text', width: 26 }, { key: 'address', label: 'Adres', type: 'text', width: 30 }, { key: 'type', label: 'Type', type: 'text' }, { key: 'rent', label: 'Huur p/m', type: 'money' }], rows: withoutCalc.map(item => ({ name: item.name, address: item.address, type: item.type, rent: item.rent || null })) },
        empty: 'Alle woningen hebben een berekening.',
      },
    ],
  }
}

const builders: Record<ReportId, (data: ReportData, options: ReportOptions) => ReportDocument> = { vastgoed, huurders, inkomsten, onderhoud, wws }

export function buildReport(id: ReportId, data: ReportData, options: ReportOptions) {
  return builders[id](data, options)
}

/* ---------- Opmaak (gedeeld door voorbeeld en PDF) ---------- */

const nlNumber = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 2 })
const nlMoney = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' })

export function formatCell(value: Cell, type: ColumnType) {
  if (value === null || value === '') return '—'
  if (typeof value === 'string' && type !== 'date') return value
  switch (type) {
    case 'money': return nlMoney.format(Number(value))
    case 'percent': return `${nlNumber.format(Math.round(Number(value) * 1000) / 10)}%`
    case 'number': return nlNumber.format(Number(value))
    case 'date': {
      const date = new Date(`${String(value).slice(0, 10)}T00:00:00`)
      return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
    }
    default: return String(value)
  }
}

/** Bestandsnaam zonder vreemde tekens, bijv. "huurinkomsten-2026-01-01-tm-2026-12-31". */
export function reportFileName(document: ReportDocument) {
  const base = document.title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return document.period ? `${base}-${document.period.from}-tm-${document.period.to}` : `${base}-${document.generatedAt}`
}
