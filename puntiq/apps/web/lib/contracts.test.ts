/** Tests voor contractstatus, meldingen bij aflopende contracten en contractvalidatie.  npm test */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { addDays, today } from './format'
import { buildNotifications, contractState, daysUntilEnd } from './notifications'
import { validate } from './records'
import type { Contract, UserSettings } from './types'

const NU = '2026-11-13'
const settings = {
  notifyContracts: true, notifyIndexation: false, notifyMaintenance: false, notifyPayments: false,
  contractReminderDays: 90, paymentReminderDays: 7, rentIndexation: 3,
} as UserSettings

const contract = (overrides: Partial<Contract> = {}): Contract => ({
  id: 1, createdAt: NU, property: 'Singel 229', tenant: 'Eva Jansen', start: '2025-01-01', status: 'Actief', ...overrides,
})
const meldingen = (contracts: Contract[], extra: Partial<UserSettings> = {}) =>
  buildNotifications({ contracts, maintenance: [], invoices: [], payments: [], properties: [], settings: { ...settings, ...extra } })
    .filter(item => item.module === 'contracts')

describe('contractstatus', () => {
  test('onbepaalde tijd blijft actief en heeft geen einddatum', () => {
    assert.equal(contractState(contract(), 90, NU), 'Actief')
    assert.equal(daysUntilEnd(contract(), NU), null)
  })

  test('binnen de herinneringstermijn: verloopt binnenkort; daarna verlopen', () => {
    assert.equal(contractState(contract({ end: addDays(NU, 91) }), 90, NU), 'Actief')
    assert.equal(contractState(contract({ end: addDays(NU, 90) }), 90, NU), 'Verloopt binnenkort')
    assert.equal(contractState(contract({ end: addDays(NU, -1) }), 90, NU), 'Verlopen')
    assert.equal(contractState(contract({ end: addDays(NU, -1), status: 'Beëindigd' }), 90, NU), 'Beëindigd')
  })
})

describe('meldingen voor aflopende contracten', () => {
  // buildNotifications gebruikt de echte datum; reken daarom relatief aan vandaag.
  const vandaag = today()

  test('geen melding voor onbepaalde tijd of buiten de termijn', () => {
    assert.equal(meldingen([contract(), contract({ id: 2, end: addDays(vandaag, 120) })]).length, 0)
  })

  test('waarschuwing binnen de termijn, urgent binnen 30 dagen en na afloop', () => {
    const [ver, dichtbij, verlopen] = [
      meldingen([contract({ end: addDays(vandaag, 60) })])[0],
      meldingen([contract({ end: addDays(vandaag, 20) })])[0],
      meldingen([contract({ end: addDays(vandaag, -3) })])[0],
    ]
    assert.equal(ver.tone, 'warning')
    assert.match(ver.title, /over 60 dagen/)
    assert.equal(dichtbij.tone, 'urgent')
    assert.equal(verlopen.tone, 'urgent')
    assert.equal(verlopen.title, 'Contract verlopen')
  })

  test('melding verwijst naar het contract, zodat het direct kan worden geopend', () => {
    assert.equal(meldingen([contract({ id: 42, end: addDays(vandaag, 10) })])[0].recordId, 42)
  })

  test('na verlenging verschijnt een nieuwe melding (andere id)', () => {
    const voor = meldingen([contract({ end: addDays(vandaag, 10) })])[0].id
    const na = meldingen([contract({ end: addDays(vandaag, 40) })])[0].id
    assert.notEqual(voor, na)
  })

  test('respecteert de instellingen: termijn en uitschakelen', () => {
    const c = contract({ end: addDays(vandaag, 45) })
    assert.equal(meldingen([c], { contractReminderDays: 30 }).length, 0)
    assert.equal(meldingen([c], { notifyContracts: false }).length, 0)
  })

  test('concept- en beëindigde contracten geven geen melding', () => {
    assert.equal(meldingen([contract({ end: addDays(vandaag, 5), status: 'Concept' }), contract({ id: 2, end: addDays(vandaag, 5), status: 'Beëindigd' })]).length, 0)
  })
})

describe('validatie', () => {
  const basis = { property: 'Singel 229', tenant: 'Eva', start: '2026-01-01', status: 'Actief' }

  test('onbepaalde tijd zonder einddatum is geldig', () => {
    assert.ok(validate('contracts', { ...basis, term: 'Onbepaalde tijd' }).data)
  })

  test('bepaalde tijd vereist een einddatum na de startdatum', () => {
    assert.match(validate('contracts', { ...basis, term: 'Bepaalde tijd' }).error ?? '', /einddatum/)
    assert.match(validate('contracts', { ...basis, term: 'Bepaalde tijd', end: '2026-01-01' }).error ?? '', /na de startdatum/)
    assert.ok(validate('contracts', { ...basis, term: 'Bepaalde tijd', end: '2027-01-01' }).data)
  })

  test('beëindigen zonder datum vult de beëindigingsdatum in', () => {
    assert.ok(validate('contracts', { ...basis, status: 'Beëindigd' }).data?.terminatedOn)
  })

  test('document kan aan een contract worden gekoppeld', () => {
    assert.equal(validate('documents', { name: 'Huurovereenkomst.pdf', contractId: 7 }).data?.contractId, 7)
  })
})
