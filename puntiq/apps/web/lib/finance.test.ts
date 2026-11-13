/** Tests voor facturen, betalingen en betaaloverzichten.  npm test */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { aging, convertLegacyPayment, groupBy, invoiceView, invoiceViews, monthly, nextInvoiceNumber, propertyKey, tenantKey, totals } from './finance'
import { addDays, today } from './format'
import { buildNotifications } from './notifications'
import { validate } from './records'
import type { Invoice, Payment, UserSettings } from './types'

const NU = '2026-11-13'
let id = 0
const factuur = (o: Partial<Invoice> = {}): Invoice => ({
  id: ++id, createdAt: NU, number: `F2026-${String(id).padStart(4, '0')}`, description: 'Huur', type: 'Huur',
  tenant: 'Eva', tenantId: 1, property: 'Singel 229', propertyId: 10,
  amount: 1000, issueDate: '2026-11-01', dueDate: '2026-11-15', status: 'Open', ...o,
})
const betaling = (o: Partial<Payment> = {}): Payment => ({ id: ++id, createdAt: NU, amount: 1000, receivedOn: '2026-11-05', method: 'Overboeking', tenant: 'Eva', tenantId: 1, property: 'Singel 229', propertyId: 10, ...o })

describe('status van een factuur', () => {
  test('openstaand vóór de vervaldatum, achterstallig erna', () => {
    assert.equal(invoiceView(factuur(), [], NU).state, 'Openstaand')
    const laat = invoiceView(factuur({ dueDate: '2026-10-01' }), [], NU)
    assert.equal(laat.state, 'Achterstallig')
    assert.equal(laat.daysOverdue, 43)
  })

  test('deelbetaling: deels betaald, met juist saldo', () => {
    const f = factuur()
    const v = invoiceView(f, [betaling({ amount: 400, invoiceId: f.id })], NU)
    assert.equal(v.state, 'Deels betaald')
    assert.equal(v.paid, 400)
    assert.equal(v.balance, 600)
  })

  test('deelbetaling na de vervaldatum blijft achterstallig voor het restant', () => {
    const f = factuur({ dueDate: '2026-11-01' })
    const v = invoiceView(f, [betaling({ amount: 400, invoiceId: f.id })], NU)
    assert.equal(v.state, 'Achterstallig')
    assert.equal(v.balance, 600)
  })

  test('volledig betaald (ook via meerdere betalingen en met centafronding)', () => {
    const f = factuur({ amount: 1095.1 })
    const v = invoiceView(f, [betaling({ amount: 1000, invoiceId: f.id }), betaling({ amount: 95.1, invoiceId: f.id })], NU)
    assert.equal(v.state, 'Betaald')
    assert.equal(v.balance, 0)
  })

  test('overbetaling: betaald, saldo niet negatief', () => {
    const f = factuur()
    const v = invoiceView(f, [betaling({ amount: 1200, invoiceId: f.id })], NU)
    assert.equal(v.state, 'Betaald')
    assert.equal(v.balance, 0)
    assert.equal(v.paid, 1200)
  })

  test('geannuleerd telt nergens mee', () => {
    const v = invoiceView(factuur({ status: 'Geannuleerd', dueDate: '2026-01-01' }), [], NU)
    assert.equal(v.state, 'Geannuleerd')
    assert.equal(v.balance, 0)
    assert.equal(totals([v], [], undefined).open, 0)
  })
})

describe('overzichten', () => {
  const eva = factuur({ dueDate: '2026-09-01', amount: 1000 })
  const evaNieuw = factuur({ issueDate: '2026-11-01', dueDate: '2026-12-01', amount: 1000 })
  const bas = factuur({ tenant: 'Bas', tenantId: 2, property: 'Herengracht 1', propertyId: 11, dueDate: '2026-10-20', amount: 800 })
  const betalingen = [betaling({ amount: 250, invoiceId: eva.id, receivedOn: '2026-09-10' }), betaling({ amount: 100, receivedOn: '2026-11-02' })]
  const views = invoiceViews([eva, evaNieuw, bas], betalingen, NU)

  test('totalen: gefactureerd, ontvangen, openstaand en achterstallig', () => {
    const t = totals(views, betalingen, undefined)
    assert.deepEqual(t, { invoiced: 2800, received: 350, open: 2550, overdue: 1550, overdueCount: 2, openCount: 3 })
  })

  test('periode beperkt gefactureerd en ontvangen, niet de stand van openstaand', () => {
    const t = totals(views, betalingen, { from: '2026-11-01', to: '2026-11-30' })
    assert.equal(t.received, 100)
    assert.equal(t.open, 2550)
  })

  test('per huurder: achterstanden bovenaan, ongekoppelde betalingen tellen mee als ontvangen', () => {
    const rows = groupBy(views, betalingen, tenantKey)
    assert.deepEqual(rows.map(row => row.label), ['Bas', 'Eva']) // grootste achterstand eerst
    const eva = rows.find(row => row.label === 'Eva')!
    assert.equal(eva.overdue, 750)
    assert.equal(eva.received, 350)
    assert.equal(eva.oldestDue, '2026-09-01')
    assert.equal(rows[0].overdue, 800)
  })

  test('per woning', () => {
    const rows = groupBy(views, betalingen, propertyKey)
    assert.equal(rows.find(row => row.label === 'Herengracht 1')?.open, 800)
  })

  test('ouderdom: 1–30 en 61–90 dagen', () => {
    const buckets = aging(views)
    assert.equal(buckets[0].amount, 800) // Bas, 24 dagen
    assert.equal(buckets[2].amount, 750) // Eva, 73 dagen
  })

  test('per maand', () => {
    // Alle drie de facturen zijn in november gedateerd; de betalingen vallen in september en november.
    assert.deepEqual(monthly(views, betalingen, ['2026-09', '2026-11']), [
      { month: '2026-09', invoiced: 0, received: 250 },
      { month: '2026-11', invoiced: 2800, received: 100 },
    ])
  })
})

describe('nummering en migratie', () => {
  test('factuurnummers lopen per jaar door', () => {
    assert.equal(nextInvoiceNumber([], 2026), 'F2026-0001')
    assert.equal(nextInvoiceNumber(['F2026-0007', 'F2025-0099', 'eigen-nummer'], 2026), 'F2026-0008')
  })

  test('oude betaling wordt factuur, plus betaling als die betaald was', () => {
    const open = convertLegacyPayment({ description: 'Huur okt', amount: 900, dueDate: '2026-10-01', status: 'Openstaand', type: 'Huur', tenant: 'Eva' })
    assert.equal(open.invoice.amount, 900)
    assert.equal(open.payment, null)
    const betaald = convertLegacyPayment({ description: 'Borg', amount: 1800, dueDate: '2026-01-01', status: 'Betaald', paidDate: '2026-01-03', type: 'Borg' })
    assert.equal(betaald.payment?.receivedOn, '2026-01-03')
    assert.equal(betaald.payment?.amount, 1800)
  })
})

describe('validatie', () => {
  test('betaling moet groter zijn dan 0', () => {
    assert.match(validate('payments', { amount: 0, receivedOn: NU }).error ?? '', /groter zijn dan 0/)
    assert.ok(validate('payments', { amount: 10, receivedOn: NU }).data)
  })
  test('vervaldatum niet vóór factuurdatum', () => {
    assert.match(validate('invoices', { description: 'x', amount: 1, issueDate: '2026-11-10', dueDate: '2026-11-01' }).error ?? '', /vervaldatum/)
  })
})

describe('meldingen', () => {
  const settings = { notifyContracts: false, notifyIndexation: false, notifyMaintenance: false, notifyPayments: true, contractReminderDays: 90, paymentReminderDays: 7, rentIndexation: 3 } as UserSettings
  const nu = today()

  test('achterstallig saldo geeft een urgente melding die naar de factuur verwijst', () => {
    const f = factuur({ issueDate: addDays(nu, -40), dueDate: addDays(nu, -10) })
    const [melding] = buildNotifications({ contracts: [], maintenance: [], invoices: [f], payments: [betaling({ amount: 300, invoiceId: f.id })], properties: [], settings })
    assert.equal(melding.tone, 'urgent')
    assert.match(melding.title, /700/)
    assert.equal(melding.recordId, f.id)
  })

  test('volledig betaalde factuur geeft geen melding', () => {
    const f = factuur({ issueDate: addDays(nu, -40), dueDate: addDays(nu, -10) })
    assert.equal(buildNotifications({ contracts: [], maintenance: [], invoices: [f], payments: [betaling({ invoiceId: f.id })], properties: [], settings }).length, 0)
  })
})
