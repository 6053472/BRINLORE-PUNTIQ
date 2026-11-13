/**
 * Tests voor de WWS-rekenmotor.  npm test
 *
 * LET OP: de regelset `testRegelset` hieronder bevat bewust nep-getallen (ronde waarden) om de mechaniek
 * van de motor te testen. Het zijn géén officiële waarden en ze worden nergens in de app gebruikt.
 */
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { berekenWws, controleerRegelset, kiesRegelset, legeInvoer, legeRegelset, regelsets, type Regelset, type WwsInvoer } from './index'

const geverifieerd = { status: 'geverifieerd' as const, bron: 'TESTBRON (nep)' }

function testRegelset(overrides: Partial<Regelset> = {}): Regelset {
  return {
    ...legeRegelset('test', '2000-01-01'),
    rubrieken: {
      vertrekken: { ...geverifieerd, puntenPerM2: 1 },
      overigeRuimten: { ...geverifieerd, puntenPerM2: 0.5 },
      verwarming: { ...geverifieerd, puntenPerVerwarmdVertrek: 1, puntenPerVerwarmdeOverigeRuimte: 1, maxPuntenOverigeRuimten: 2, puntenPerGekoeldVertrek: 1, maxPuntenKoeling: 1 },
      energie: { ...geverifieerd, perLabel: { A: { eengezins: 10, meergezins: 8 } }, zonderLabel: [{ vanafBouwjaar: 2000, punten: { eengezins: 5, meergezins: 4 } }, { vanafBouwjaar: 0, punten: { eengezins: 0, meergezins: 0 } }], zonderLabelOnbekendBouwjaar: -1 },
      keuken: { ...geverifieerd, aanrecht: [{ vanafMeters: 1, punten: 3 }], voorzieningen: { kookplaat: { naam: 'Kookplaat', punten: 1 } }, extraMaxIsAanrechtPunten: true },
      sanitair: { ...geverifieerd, voorzieningen: { toilet: { naam: 'Toilet', punten: 2 }, douche: { naam: 'Douche', punten: null } } },
      buitenruimte: { ...geverifieerd, puntenBijAanwezigheid: 1, puntenPerM2Prive: 0.5, maxPunten: 5, puntenZonderBuitenruimte: -2 },
      woz: { ...geverifieerd, minimumWaarde: 100000, delerWaarde: 10000, delerWaardePerM2: 1000, uitzonderingKleineWoning: null, plafond: null },
    },
    totaal: { afronding: 'heel_punt', minimumPunten: 10 },
    huurtabel: { ...geverifieerd, methode: 'exact', punten: Array.from({ length: 91 }, (_, i) => [10 + i, 100 + i * 10] as [number, number]), minimumPunten: 10, bedragPerPuntBoven: 10 },
    segmenten: { ...geverifieerd, lijst: [{ id: 'laag', naam: 'Laag', totEnMetPunten: 50, gereguleerd: true }, { id: 'vrij', naam: 'Vrij', totEnMetPunten: null, gereguleerd: false }] },
    opslagen: [{ ...geverifieerd, id: 'a', naam: 'Opslag A', percentage: 0.1 }, { ...geverifieerd, id: 'b', naam: 'Opslag B', percentage: 0.2 }],
    ...overrides,
  }
}

function testInvoer(overrides: Partial<WwsInvoer> = {}): WwsInvoer {
  return {
    ...legeInvoer('2026-01-01'),
    vertrekken: [{ id: '1', naam: 'Woonkamer', m2: 20, verwarmd: true, gekoeld: false }],
    energielabel: 'A',
    keuken: { aanrechtLengteMeters: 1.5, voorzieningen: {}, extraPuntenHandmatig: 0 },
    sanitair: { voorzieningen: { toilet: 1 } },
    buitenruimte: { priveM2: 4 },
    woz: { waarde: 100000, regioKenmerken: [] },
    ...overrides,
  }
}

const punten = (uitkomst: ReturnType<typeof berekenWws>, id: string) => uitkomst.rubrieken.find(item => item.id === id)?.punten

describe('rekenmotor', () => {
  test('volledig geverifieerde regelset levert een officiële uitkomst', () => {
    const u = berekenWws(testInvoer(), testRegelset())
    // 20 + 0 + 1 + 8 + 3 + 2 + (1 + 4×0,5) + (100000/10000 + 100000/20/1000) = 20+1+8+3+2+3+15 = 52
    assert.equal(u.totaalPunten, 52)
    assert.equal(u.segment?.id, 'vrij')
    assert.equal(u.maximaleHuur, null)
    assert.equal(u.betrouwbaarheid, 'officieel', u.redenen.join('; '))
  })

  test('gereguleerd segment krijgt een maximale huur uit de exacte tabel', () => {
    const u = berekenWws(testInvoer({ woz: { waarde: 100000, regioKenmerken: [] }, vertrekken: [{ id: '1', naam: 'K', m2: 10, verwarmd: false, gekoeld: false }] }), testRegelset())
    assert.equal(u.totaalPunten, 46) // 10 + 8 + 3 + 2 + 3 + (100000/10000 + 100000/10/1000)
    assert.equal(u.segment?.id, 'laag')
    assert.equal(u.maximaleHuur, 460)
  })

  test('een lege regelset schat niets: alles ontbreekt en de uitkomst is onvolledig', () => {
    const u = berekenWws(testInvoer(), legeRegelset('leeg', '2000-01-01'))
    assert.equal(u.betrouwbaarheid, 'onvolledig')
    assert.equal(u.totaalPunten, null)
    assert.equal(u.maximaleHuur, null)
    assert.ok(u.rubrieken.every(item => item.punten === null))
  })

  test('handmatige punten vullen een ontbrekende regel aan, maar de uitkomst wordt indicatief', () => {
    const regelset = testRegelset()
    const zonderSanitair = { ...regelset, rubrieken: { ...regelset.rubrieken, sanitair: { status: 'niet_geconfigureerd' as const, voorzieningen: {} } } }
    assert.equal(berekenWws(testInvoer(), zonderSanitair).betrouwbaarheid, 'onvolledig')
    const u = berekenWws(testInvoer({ handmatig: { sanitair: { punten: 2, toelichting: 'Huurprijscheck' } } }), zonderSanitair)
    assert.equal(punten(u, 'sanitair'), 2)
    assert.equal(u.totaalPunten, 52)
    assert.equal(u.betrouwbaarheid, 'indicatief')
  })

  test('een voorziening zonder punten in de catalogus wordt niet geschat', () => {
    const u = berekenWws(testInvoer({ sanitair: { voorzieningen: { toilet: 1, douche: 1 } } }), testRegelset())
    assert.equal(punten(u, 'sanitair'), null)
    assert.match(u.rubrieken.find(item => item.id === 'sanitair')!.waarschuwingen[0], /Douche/)
  })

  test('zonder WOZ-waarde geen totaal', () => {
    const u = berekenWws(testInvoer({ woz: { waarde: null, regioKenmerken: [] } }), testRegelset())
    assert.equal(punten(u, 'woz'), null)
    assert.equal(u.betrouwbaarheid, 'onvolledig')
  })

  test('niet-geverifieerde regels maken de uitkomst indicatief', () => {
    const r = testRegelset()
    const u = berekenWws(testInvoer(), { ...r, rubrieken: { ...r.rubrieken, energie: { ...r.rubrieken.energie, status: 'ongeverifieerd' } } })
    assert.equal(u.betrouwbaarheid, 'indicatief')
    assert.ok(u.redenen.some(reden => reden.startsWith('Energieprestatie')))
  })

  test('extra keukenvoorzieningen worden begrensd op de aanrechtpunten', () => {
    const u = berekenWws(testInvoer({ keuken: { aanrechtLengteMeters: 1, voorzieningen: { kookplaat: 1 }, extraPuntenHandmatig: 5 } }), testRegelset())
    assert.equal(punten(u, 'keuken'), 6)
  })

  test('zonder energielabel geldt het bouwjaar; zonder bouwjaar de aparte waarde', () => {
    assert.equal(punten(berekenWws(testInvoer({ energielabel: null, bouwjaar: 2010 }), testRegelset()), 'energie'), 4)
    assert.equal(punten(berekenWws(testInvoer({ energielabel: null, bouwjaar: 1950 }), testRegelset()), 'energie'), 0)
    assert.equal(punten(berekenWws(testInvoer({ energielabel: null, bouwjaar: null }), testRegelset()), 'energie'), -1)
  })

  test('meerdere opslagen tegelijk worden niet gecombineerd zonder regel', () => {
    const invoer = testInvoer({ vertrekken: [{ id: '1', naam: 'K', m2: 10, verwarmd: false, gekoeld: false }] })
    assert.equal(berekenWws({ ...invoer, opslagen: ['a'] }, testRegelset()).maximaleHuur, 506)
    const beide = berekenWws({ ...invoer, opslagen: ['a', 'b'] }, testRegelset())
    assert.equal(beide.maximaleHuur, 460)
    assert.equal(beide.opslagen.length, 0)
    assert.equal(beide.betrouwbaarheid, 'indicatief')
  })
})

describe('regelsets', () => {
  test('kiest de regelset die op de peildatum geldt', () => {
    const oud = { ...legeRegelset('oud', '2025-01-01'), geldigTot: '2025-07-01' }
    const nieuw = legeRegelset('nieuw', '2025-07-01')
    assert.equal(kiesRegelset('2025-06-30', [oud, nieuw])?.id, 'oud')
    assert.equal(kiesRegelset('2025-07-01', [oud, nieuw])?.id, 'nieuw')
    assert.equal(kiesRegelset('2024-12-31', [oud, nieuw]), null)
  })

  test('de controle meldt ontbrekende waarden, maar niet bewust lege optionele regels', () => {
    const controle = controleerRegelset(testRegelset())
    const woz = controle.find(item => item.naam === 'WOZ-waarde')!
    assert.deepEqual(woz.ontbrekend, [])
    assert.ok(controle.find(item => item.naam === 'Sanitair')!.ontbrekend.includes('voorzieningen.douche.punten'))
  })

  test('meegeleverde regelset: niets is als geverifieerd gemarkeerd zonder bron', () => {
    for (const set of regelsets) {
      for (const onderdeel of controleerRegelset(set)) {
        if (onderdeel.status === 'geverifieerd') assert.ok(onderdeel.bron, `${set.id}: ${onderdeel.naam} is geverifieerd zonder bron`)
      }
    }
  })

  test('overgenomen regelset geeft dezelfde uitkomst als de eerdere PUNTIQ-berekening', () => {
    // Referentie berekend met de oude lib/wws.ts (commit 6f1bc93) voor het standaardvoorbeeld uit het formulier.
    const set = kiesRegelset('2026-06-01')!
    const u = berekenWws({
      ...legeInvoer('2026-06-01'),
      bouwjaar: 2005,
      vertrekken: [{ id: '1', naam: 'Woonkamer', m2: 30, verwarmd: true, gekoeld: false }, { id: '2', naam: 'Slaapkamer', m2: 14, verwarmd: true, gekoeld: false }, { id: '3', naam: 'Slaapkamer', m2: 8, verwarmd: true, gekoeld: false }],
      overigeRuimten: [{ id: '4', naam: 'Berging', m2: 10, verwarmd: true, gekoeld: false }],
      energielabel: 'A',
      keuken: { aanrechtLengteMeters: 2, voorzieningen: {}, extraPuntenHandmatig: 4 },
      buitenruimte: { priveM2: 8 },
      woz: { waarde: 350000, regioKenmerken: [] },
      handmatig: { sanitair: { punten: 7, toelichting: '' } },
    }, set)
    assert.deepEqual(
      Object.fromEntries(u.rubrieken.filter(item => item.punten).map(item => [item.id, item.punten])),
      { vertrekken: 52, overigeRuimten: 7.5, verwarming: 7, energie: 37, keuken: 11, sanitair: 7, buitenruimte: 4.75, woz: 41.75 },
    )
    assert.equal(u.totaalPunten, 168)
    assert.equal(u.maximaleHuur, 1104.5)
    assert.equal(u.segment?.naam, 'Middenhuur')
    assert.equal(u.betrouwbaarheid, 'indicatief')
  })
})
