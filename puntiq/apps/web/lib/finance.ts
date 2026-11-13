/**
 * Facturen en betalingen: afgeleide status en overzichten. Puur (geen I/O), zodat het overal testbaar is.
 *
 * - Een factuur is wat een huurder moet betalen (bedrag + vervaldatum).
 * - Een betaling is wat er werkelijk is ontvangen; gekoppeld aan een factuur (of nog niet).
 * - De status van een factuur wordt afgeleid uit de gekoppelde betalingen, nooit met de hand gezet.
 */
import { daysBetween, monthKey } from './format'
import type { Invoice, Payment } from './types'

export type InvoiceState = 'Openstaand' | 'Deels betaald' | 'Achterstallig' | 'Betaald' | 'Geannuleerd'
export const invoiceStates: InvoiceState[] = ['Openstaand', 'Deels betaald', 'Achterstallig', 'Betaald', 'Geannuleerd']

const cents = (value: number) => Math.round(value * 100) / 100
/** Kleiner verschil dan een halve cent telt als voldaan. */
const EPSILON = 0.005

export type InvoiceView = Invoice & {
  paid: number
  balance: number
  state: InvoiceState
  /** Dagen na de vervaldatum (alleen bij een openstaand saldo), anders 0. */
  daysOverdue: number
  payments: Payment[]
}

export function paymentsByInvoice(payments: Payment[]) {
  const map = new Map<number, Payment[]>()
  for (const payment of payments) {
    if (!payment.invoiceId) continue
    map.set(payment.invoiceId, [...(map.get(payment.invoiceId) ?? []), payment])
  }
  return map
}

export function invoiceView(invoice: Invoice, linked: Payment[], now: string): InvoiceView {
  const paid = cents(linked.reduce((sum, payment) => sum + payment.amount, 0))
  const balance = cents(invoice.amount - paid)
  let state: InvoiceState
  if (invoice.status === 'Geannuleerd') state = 'Geannuleerd'
  else if (balance <= EPSILON) state = 'Betaald'
  else if (invoice.dueDate < now) state = 'Achterstallig'
  else if (paid > EPSILON) state = 'Deels betaald'
  else state = 'Openstaand'
  const daysOverdue = state === 'Achterstallig' ? daysBetween(invoice.dueDate, now) : 0
  return { ...invoice, paid, balance: state === 'Geannuleerd' ? 0 : Math.max(0, balance), state, daysOverdue, payments: linked }
}

export function invoiceViews(invoices: Invoice[], payments: Payment[], now: string) {
  const byInvoice = paymentsByInvoice(payments)
  return invoices.map(invoice => invoiceView(invoice, byInvoice.get(invoice.id) ?? [], now))
}

const isOpen = (view: InvoiceView) => view.state === 'Openstaand' || view.state === 'Deels betaald' || view.state === 'Achterstallig'

export type Totals = { invoiced: number; received: number; open: number; overdue: number; overdueCount: number; openCount: number }

export function totals(views: InvoiceView[], payments: Payment[], period?: { from: string; to: string }): Totals {
  const inPeriod = (date: string) => !period || (date >= period.from && date <= period.to)
  const active = views.filter(view => view.state !== 'Geannuleerd')
  const open = active.filter(isOpen)
  const overdue = open.filter(view => view.state === 'Achterstallig')
  return {
    invoiced: cents(active.filter(view => inPeriod(view.issueDate)).reduce((sum, view) => sum + view.amount, 0)),
    received: cents(payments.filter(payment => inPeriod(payment.receivedOn)).reduce((sum, payment) => sum + payment.amount, 0)),
    open: cents(open.reduce((sum, view) => sum + view.balance, 0)),
    overdue: cents(overdue.reduce((sum, view) => sum + view.balance, 0)),
    overdueCount: overdue.length,
    openCount: open.length,
  }
}

export type GroupRow = { key: string; label: string; invoiced: number; received: number; open: number; overdue: number; overdueCount: number; oldestDue?: string }

/** Overzicht per huurder of per woning. Betalingen zonder factuur tellen mee als ontvangen bij die groep. */
export function groupBy(views: InvoiceView[], payments: Payment[], keyOf: (item: { tenant?: string; tenantId?: number; property?: string; propertyId?: number }) => { key: string; label: string } | null): GroupRow[] {
  const rows = new Map<string, GroupRow>()
  const row = (key: string, label: string) => rows.get(key) ?? rows.set(key, { key, label, invoiced: 0, received: 0, open: 0, overdue: 0, overdueCount: 0 }).get(key)!
  for (const view of views) {
    if (view.state === 'Geannuleerd') continue
    const group = keyOf(view)
    if (!group) continue
    const r = row(group.key, group.label)
    r.invoiced = cents(r.invoiced + view.amount)
    if (isOpen(view)) r.open = cents(r.open + view.balance)
    if (view.state === 'Achterstallig') {
      r.overdue = cents(r.overdue + view.balance)
      r.overdueCount += 1
      if (!r.oldestDue || view.dueDate < r.oldestDue) r.oldestDue = view.dueDate
    }
  }
  for (const payment of payments) {
    const group = keyOf(payment)
    if (!group) continue
    const r = row(group.key, group.label)
    r.received = cents(r.received + payment.amount)
  }
  return [...rows.values()].sort((a, b) => b.overdue - a.overdue || b.open - a.open || a.label.localeCompare(b.label))
}

export const tenantKey = (item: { tenant?: string; tenantId?: number }) =>
  item.tenantId ? { key: `t${item.tenantId}`, label: item.tenant || 'Onbekende huurder' } : item.tenant ? { key: `n:${item.tenant}`, label: item.tenant } : null
export const propertyKey = (item: { property?: string; propertyId?: number }) =>
  item.propertyId ? { key: `p${item.propertyId}`, label: item.property || 'Onbekende woning' } : item.property ? { key: `n:${item.property}`, label: item.property } : null

/** Achterstanden naar ouderdom (dagen na vervaldatum). */
export const agingBuckets = [
  { label: '1–30 dagen', min: 1, max: 30 },
  { label: '31–60 dagen', min: 31, max: 60 },
  { label: '61–90 dagen', min: 61, max: 90 },
  { label: 'Meer dan 90 dagen', min: 91, max: Infinity },
]

export function aging(views: InvoiceView[]) {
  return agingBuckets.map(bucket => {
    const items = views.filter(view => view.state === 'Achterstallig' && view.daysOverdue >= bucket.min && view.daysOverdue <= bucket.max)
    return { ...bucket, count: items.length, amount: cents(items.reduce((sum, view) => sum + view.balance, 0)) }
  })
}

/** Gefactureerd en ontvangen per maand (YYYY-MM). */
export function monthly(views: InvoiceView[], payments: Payment[], months: string[]) {
  return months.map(month => ({
    month,
    invoiced: cents(views.filter(view => view.state !== 'Geannuleerd' && monthKey(view.issueDate) === month).reduce((sum, view) => sum + view.amount, 0)),
    received: cents(payments.filter(payment => monthKey(payment.receivedOn) === month).reduce((sum, payment) => sum + payment.amount, 0)),
  }))
}

/** Volgend factuurnummer: F{jaar}-{volgnummer}, doorlopend per jaar. */
export function nextInvoiceNumber(existing: string[], year: number) {
  const prefix = `F${year}-`
  const highest = existing.filter(number => number.startsWith(prefix)).reduce((max, number) => Math.max(max, Number(number.slice(prefix.length)) || 0), 0)
  return `${prefix}${String(highest + 1).padStart(4, '0')}`
}

/**
 * Zet een betaling uit het oude model (vordering met status) om naar een factuur plus, indien betaald,
 * een ontvangen betaling. Gebruikt door de eenmalige migratie.
 */
export function convertLegacyPayment(legacy: Record<string, unknown>) {
  const type = String(legacy.type ?? 'Overig')
  const invoice: Record<string, unknown> = {
    description: String(legacy.description ?? 'Betaling'),
    property: legacy.property ?? undefined,
    tenant: legacy.tenant ?? undefined,
    type: ['Huur', 'Servicekosten', 'Borg', 'Onderhoud', 'Overig'].includes(type) ? type : 'Overig',
    amount: Number(legacy.amount) || 0,
    issueDate: String(legacy.dueDate),
    dueDate: String(legacy.dueDate),
    status: 'Open',
  }
  const payment = legacy.status === 'Betaald'
    ? {
        amount: Number(legacy.amount) || 0,
        receivedOn: String(legacy.paidDate ?? legacy.dueDate),
        method: 'Overboeking',
        property: legacy.property ?? undefined,
        tenant: legacy.tenant ?? undefined,
        note: 'Overgezet uit het oude betalingsoverzicht',
      }
    : null
  return { invoice, payment }
}
