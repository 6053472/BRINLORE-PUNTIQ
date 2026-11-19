import assert from 'node:assert/strict'
import { test } from 'node:test'
import { controleerWwsBerekening, controleerWwsoBerekening } from './recheck'
import { berekenWws, kiesRegelset, legeInvoer, nieuweRuimte } from './wws'
import { berekenWwso, kiesWwsoRegelset, legeWwsoInvoer } from './wwso'
import type { WwsCalculation, WwsoCalculation } from './types'

const DATUM = '2026-03-01'

function wwsRecord(): WwsCalculation {
  const invoer = { ...legeInvoer(DATUM), vertrekken: [nieuweRuimte('Woonkamer', 25), nieuweRuimte('Slaapkamer', 12)], bouwjaar: 2005 }
  const regelset = kiesRegelset(DATUM)!
  const uitkomst = berekenWws(invoer, regelset)
  return { id: 1, createdAt: DATUM, label: 'Test', date: DATUM, points: uitkomst.totaalPunten ?? undefined, rent: uitkomst.maximaleHuur ?? undefined, regelset: regelset.id, invoer: JSON.stringify(invoer) }
}

test('een ongewijzigde WWS-berekening wordt als "klopt" herkend', () => {
  assert.equal(controleerWwsBerekening(wwsRecord()).status, 'ongewijzigd')
})

test('een WWS-berekening met een afwijkend puntental wordt gemeld', () => {
  const record = { ...wwsRecord(), points: 999 }
  const controle = controleerWwsBerekening(record)
  assert.equal(controle.status, 'afwijkend')
  assert.notEqual(controle.punten, 999)
})

test('WWS zonder bewaarde invoer of met onbekende regelset', () => {
  assert.equal(controleerWwsBerekening({ ...wwsRecord(), invoer: undefined }).status, 'geen_invoer')
  assert.equal(controleerWwsBerekening({ ...wwsRecord(), regelset: 'bestaat-niet' }).status, 'regelset_onbekend')
  assert.equal(controleerWwsBerekening({ ...wwsRecord(), invoer: '{kapot' }).status, 'geen_invoer')
})

test('WWSO-berekening: klopt en afwijkend', () => {
  const invoer = legeWwsoInvoer(DATUM)
  invoer.priveVertrekken = [{ id: 'a', naam: 'Kamer', m2: 14, verwarmd: true, gekoeld: false }]
  const regelset = kiesWwsoRegelset(DATUM)!
  const uitkomst = berekenWwso(invoer, regelset)
  const record: WwsoCalculation = { id: 2, createdAt: DATUM, label: 'Kamer', date: DATUM, points: uitkomst.totaalPunten ?? undefined, rent: uitkomst.maximaleHuur ?? undefined, regelset: regelset.id, invoer: JSON.stringify(invoer) }
  assert.equal(controleerWwsoBerekening(record).status, 'ongewijzigd')
  assert.equal(controleerWwsoBerekening({ ...record, points: 1 }).status, 'afwijkend')
})
