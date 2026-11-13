/**
 * Tests voor de WWSO-rekenmotor. Waar mogelijk worden de rekenvoorbeelden uit de toelichting bij
 * bijlage I, onder B (Besluit huurprijzen woonruimte) nagerekend.
 */
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, test } from 'node:test'
import { berekenWwso, controleerWwsoRegelset, kiesWwsoRegelset, legeWwsoInvoer, type WwsoInvoer, type WwsoRegelset } from './index'

const regelset = kiesWwsoRegelset('2026-06-01')!
const punten = (invoer: WwsoInvoer, id: string, set: WwsoRegelset = regelset) => berekenWwso(invoer, set).rubrieken.find(item => item.id === id)!.punten

function kamer(overrides: Partial<WwsoInvoer> = {}): WwsoInvoer {
  const basis = legeWwsoInvoer('2026-06-01')
  return {
    ...basis,
    adres: { ...basis.adres, aantalWoonruimten: 4, energielabel: 'A' },
    priveVertrekken: [{ id: 'k', naam: 'Kamer', m2: 10, verwarmd: true, gekoeld: false }],
    woz: { waardeAdres: 400000, gebruiksoppervlakteAdres: 100, coropGemiddeldePerM2: 4000, coropGebied: 'Test' },
    ...overrides,
  }
}

describe('rekenvoorbeelden uit de toelichting bij bijlage I, onder B', () => {
  test('rubriek 1: 10 m² eigen kamer + 40 m² woonkamer gedeeld door 4 = 20 punten', () => {
    const invoer = kamer({ gedeeldeRuimten: [{ id: 'g', naam: 'Woonkamer', soort: 'vertrek', m2: 40, verwarmd: false, gekoeld: false, gedeeldDoor: 4 }] })
    assert.equal(punten(invoer, 'r1_vertrekken'), 20)
  })

  test('rubriek 4: 20 m² × 0,65 (label A) = 13 punten', () => {
    assert.equal(punten(kamer({ priveVertrekken: [{ id: 'k', naam: 'Kamer', m2: 20, verwarmd: false, gekoeld: false }] }), 'r4_energie'), 13)
  })

  test('rubriek 5: keuken van 10 punten gedeeld door 4 = 2,5', () => {
    assert.equal(punten(kamer({ keukens: [{ id: 'k', naam: 'Keuken', punten: 10, gedeeldDoor: 4 }] }), 'r5_keuken'), 2.5)
  })

  test('rubriek 6: badkamer 5 punten / 4 + eigen toilet 3 = 4,25', () => {
    const invoer = kamer({ sanitair: [{ id: 'b', naam: 'Badkamer', punten: 5, gedeeldDoor: 4 }, { id: 't', naam: 'Toilet', punten: 3, gedeeldDoor: 1 }] })
    assert.equal(punten(invoer, 'r6_sanitair'), 4.25)
  })

  test('rubriek 9: 9,5625 / 4 woonruimten = 2,390625 → afgerond 2,50', () => {
    // 76,5 m² vertrek / 8 adressen = 9,5625 punten per adres.
    const invoer = kamer({ complexRuimten: [{ id: 'c', naam: 'Recreatieruimte', soort: 'vertrek', m2: 76.5, adressen: 8 }] })
    assert.equal(punten(invoer, 'r9_gemeenschappelijk'), 2.5)
  })

  test('rubriek 10: 5 plekken type III × 4 = 20; / 10 adressen / 4 woonruimten = 0,50', () => {
    const invoer = kamer({ parkeren: { typeI: 0, typeII: 0, typeIII: 5, adressen: 10, laadpalen: 0, laadpaalAdressen: 1 } })
    assert.equal(punten(invoer, 'r10_parkeren'), 0.5)
  })
})

describe('rekenmotor', () => {
  test('energie zonder label volgt het bouwjaar; monument krijgt geen minpunten', () => {
    const zonderLabel = (bouwjaar: number, monument = false) => kamer({ adres: { ...kamer().adres, energielabel: null, bouwjaar, monument } })
    assert.equal(punten(zonderLabel(1995), 'r4_energie'), 3.5) // label C: 10 m² × 0,35
    assert.equal(punten(zonderLabel(1950), 'r4_energie'), -1.5) // label G: 10 × -0,15
    assert.equal(punten(zonderLabel(1950, true), 'r4_energie'), 0)
  })

  test('WOZ: 14 / 12 / 10 punten t.o.v. het COROP-gemiddelde (±10%)', () => {
    const woz = (waardeAdres: number) => punten(kamer({ woz: { waardeAdres, gebruiksoppervlakteAdres: 100, coropGemiddeldePerM2: 4000, coropGebied: '' } }), 'r11_woz')
    assert.equal(woz(441000), 14)
    assert.equal(woz(440000), 12)
    assert.equal(woz(360000), 12)
    assert.equal(woz(359000), 10)
  })

  test('zonder COROP-gemiddelde is de uitkomst onvolledig (geen schatting)', () => {
    const u = berekenWwso(kamer({ woz: { waardeAdres: 400000, gebruiksoppervlakteAdres: 100, coropGemiddeldePerM2: null, coropGebied: '' } }), regelset)
    assert.equal(u.totaalPunten, null)
    assert.equal(u.betrouwbaarheid, 'onvolledig')
  })

  test('aftrek: minder dan 8 m² toegerekend + kozijn te hoog = -8', () => {
    const invoer = kamer({ priveVertrekken: [{ id: 'k', naam: 'Kamer', m2: 7, verwarmd: false, gekoeld: false }], aftrek: { alleenViaVertrekVerhuurder: false, ruitOppervlakteKleiner: false, kozijnTeHoog: true } })
    assert.equal(punten(invoer, 'r13_aftrek'), -8)
    // Met een aandeel in een gedeeld vertrek komt de kamer wél boven 8 m².
    assert.equal(punten({ ...invoer, gedeeldeRuimten: [{ id: 'g', naam: 'Woonkamer', soort: 'vertrek', m2: 8, verwarmd: false, gedeeldDoor: 4, gekoeld: false }] }, 'r13_aftrek'), -4)
  })

  test('geen buitenruimte geeft aftrek; gedeelde buitenruimte wordt verdeeld', () => {
    assert.equal(punten(kamer(), 'r8_buitenruimten'), -5)
    const gedeeld = kamer({ buitenruimte: { priveM2: 0, gedeeldOpAdresM2: 20, gedeeldOpAdresDoor: 4, complexM2: 0, complexAdressen: 1 } })
    assert.equal(punten(gedeeld, 'r8_buitenruimten'), 3.75) // 20 × 0,75 / 4
  })

  test('zorgwoning: 35% van rubriek 1 t/m 11', () => {
    const u = berekenWwso(kamer({ bijzonder: { zorgwoning: true, aanbelfunctie: false } }), regelset)
    const som = u.rubrieken.filter(item => item.nummer <= 11).reduce((sum, item) => sum + item.punten!, 0)
    assert.equal(u.rubrieken.find(item => item.id === 'r12_bijzonder')!.punten, Math.round((som * 0.35) / 0.25) * 0.25)
  })

  test('ongeldige deler (0 woonruimten) wordt niet geschat', () => {
    const invoer = kamer({ keukens: [{ id: 'k', naam: 'Keuken', punten: 10, gedeeldDoor: 0 }] })
    assert.equal(punten(invoer, 'r5_keuken'), null)
  })

  test('handmatige punten vullen een rubriek zonder regel aan', () => {
    assert.equal(punten(kamer({ handmatig: { r7_gehandicapten: { punten: 2, toelichting: 'test' } } }), 'r7_gehandicapten'), 2)
    assert.equal(punten(kamer(), 'r7_gehandicapten'), 0)
  })

  test('volledige kamer: totaal op hele punten, indicatief en zonder huur zolang de tabel ontbreekt', () => {
    const u = berekenWwso(kamer(), regelset)
    assert.equal(u.totaalPunten, Math.round(u.rubrieken.reduce((sum, item) => sum + item.punten!, 0)))
    assert.equal(u.maximaleHuur, null)
    assert.equal(u.betrouwbaarheid, 'indicatief')
    assert.ok(u.redenen.some(reden => reden.includes('Huurprijstabel')))
  })

  test('rijksmonument verhuurd vóór de Wet betaalbare huur: +10 punten', () => {
    const zonder = berekenWwso(kamer(), regelset).totaalPunten!
    const met = berekenWwso(kamer({ adres: { ...kamer().adres, rijksmonumentVoorWbh: true } }), regelset).totaalPunten!
    assert.equal(met - zonder, 10)
  })
})

describe('regelset en scheiding', () => {
  test('alle onderdelen hebben een bronvermelding', () => {
    for (const onderdeel of controleerWwsoRegelset(regelset)) assert.ok(onderdeel.bron, onderdeel.naam)
  })

  test('niets is als geverifieerd gemarkeerd zonder controle', () => {
    for (const onderdeel of controleerWwsoRegelset(regelset)) assert.notEqual(onderdeel.status, 'geverifieerd', onderdeel.naam)
  })

  test('de WWSO-module importeert niets uit de WWS-module', () => {
    const map = path.join(process.cwd(), 'lib', 'wwso')
    const bestanden = readdirSync(map, { recursive: true }).map(String).filter(naam => naam.endsWith('.ts'))
    for (const bestand of bestanden) {
      const inhoud = readFileSync(path.join(map, bestand), 'utf8')
      assert.doesNotMatch(inhoud, /from ['"][./]*(lib\/)?wws['"/]/, `${bestand} importeert uit lib/wws`)
    }
  })
})
