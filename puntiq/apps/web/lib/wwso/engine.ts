/**
 * WWSO-rekenmotor (onzelfstandige woonruimte). Bevat geen getallen uit de regelgeving: alle waarden
 * komen uit de `WwsoRegelset`. Ontbreekt een benodigde waarde of invoer, dan wordt de rubriek niet
 * geschat maar als 'ontbreekt' gemarkeerd, tenzij er handmatige punten zijn ingevuld.
 */
import type { Herkomst, RubriekId, RubriekUitkomst, WwsoInvoer, WwsoRegelset, WwsoUitkomst } from './types'

const fmt = (value: number) => value.toLocaleString('nl-NL', { maximumFractionDigits: 4 })
const euro = (value: number) => value.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' })
const pos = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0)

class Ontbreekt extends Error {}
function vereist<T>(value: T | null | undefined, naam: string): T {
  if (value === null || value === undefined) throw new Ontbreekt(naam)
  return value
}
/** Deler uit de invoer: minimaal 1, anders ontbreekt de invoer. */
function deler(value: number, naam: string) {
  if (!Number.isFinite(value) || value < 1) throw new Ontbreekt(naam)
  return Math.floor(value)
}

const namen: Record<RubriekId, [number, string]> = {
  r1_vertrekken: [1, 'Oppervlakte van vertrekken'],
  r2_overigeRuimten: [2, 'Oppervlakte van overige ruimten'],
  r3_verwarming: [3, 'Verkoeling en verwarming'],
  r4_energie: [4, 'Energieprestatie'],
  r5_keuken: [5, 'Keuken'],
  r6_sanitair: [6, 'Sanitair'],
  r7_gehandicapten: [7, 'Woonvoorzieningen voor gehandicapten'],
  r8_buitenruimten: [8, 'Buitenruimten'],
  r9_gemeenschappelijk: [9, 'Gemeenschappelijke vertrekken, overige ruimten en voorzieningen'],
  r10_parkeren: [10, 'Gemeenschappelijke parkeerruimten'],
  r11_woz: [11, 'Punten voor de WOZ-waarde'],
  r12_bijzonder: [12, 'Bijzondere voorzieningen'],
  r13_aftrek: [13, 'Aftrekpunten'],
}

type Berekening = { punten: number; stappen: string[]; waarschuwingen?: string[] }

export function berekenWwso(invoer: WwsoInvoer, regelset: WwsoRegelset): WwsoUitkomst {
  const r = regelset
  const redenen: string[] = []
  const stap = r.afrondingRubriek.stap
  const afronden = (value: number) => (stap ? Math.round(value / stap) * stap : value)

  const rubriek = (id: RubriekId, herkomst: Herkomst, bereken: () => Berekening, standaardNul = false): RubriekUitkomst => {
    const [nummer, naam] = namen[id]
    const basis = { id, nummer, naam, status: herkomst.status }
    const handmatig = invoer.handmatig[id]
    if (handmatig) {
      return { ...basis, punten: handmatig.punten, bron: 'handmatig', stappen: [`Handmatig ingevuld: ${fmt(handmatig.punten)}${handmatig.toelichting ? ` (${handmatig.toelichting})` : ''}`], waarschuwingen: [] }
    }
    if (herkomst.status === 'niet_geconfigureerd') {
      return standaardNul
        ? { ...basis, punten: 0, bron: 'berekend', stappen: ['Geen rekenregel; niet opgegeven, dus 0 punten. Vul handmatig in als deze voorzieningen aanwezig zijn.'], waarschuwingen: [] }
        : { ...basis, punten: null, bron: 'ontbreekt', stappen: [], waarschuwingen: ['Geen rekenregel in deze regelset. Vul de punten handmatig in.'] }
    }
    try {
      const result = bereken()
      const punten = afronden(result.punten)
      if (stap && punten !== result.punten) result.stappen.push(`Afgerond op ${fmt(stap)}: ${fmt(punten)}`)
      return { ...basis, punten, bron: 'berekend', stappen: result.stappen, waarschuwingen: result.waarschuwingen ?? [] }
    } catch (error) {
      if (!(error instanceof Ontbreekt)) throw error
      return { ...basis, punten: null, bron: 'ontbreekt', stappen: [], waarschuwingen: [`Ontbreekt: ${error.message}.`] }
    }
  }

  // ---------- Toegerekende oppervlakte (privé + aandeel in gedeelde ruimten op het adres) ----------
  const gedeeldeVertrekken = invoer.gedeeldeRuimten.filter(ruimte => ruimte.soort === 'vertrek')
  const gedeeldeOverige = invoer.gedeeldeRuimten.filter(ruimte => ruimte.soort === 'overig')
  const aandeel = (ruimten: { naam: string; m2: number; gedeeldDoor: number }[], stappen: string[]) =>
    ruimten.reduce((sum, ruimte) => {
      const n = deler(ruimte.gedeeldDoor, `aantal woonruimten dat "${ruimte.naam}" deelt`)
      stappen.push(`${ruimte.naam}: ${fmt(pos(ruimte.m2))} m² / ${n} woonruimten = ${fmt(pos(ruimte.m2) / n)} m²`)
      return sum + pos(ruimte.m2) / n
    }, 0)
  const som = (ruimten: { m2: number }[]) => ruimten.reduce((sum, ruimte) => sum + pos(ruimte.m2), 0)

  let toegerekendeM2Vertrekken = som(invoer.priveVertrekken)
  try {
    toegerekendeM2Vertrekken += aandeel(gedeeldeVertrekken, [])
  } catch {
    // Ongeldige deler: rubriek 1 meldt dit hieronder.
  }

  const rubrieken: RubriekUitkomst[] = []

  rubrieken.push(rubriek('r1_vertrekken', r.r1, () => {
    const per = vereist(r.r1.puntenPerM2, 'punten per m² vertrek')
    const stappen = [`Privé-vertrekken: ${fmt(som(invoer.priveVertrekken))} m²`]
    const m2 = som(invoer.priveVertrekken) + aandeel(gedeeldeVertrekken, stappen)
    stappen.push(`Toegerekend ${fmt(m2)} m² × ${fmt(per)} = ${fmt(m2 * per)}`)
    return { punten: m2 * per, stappen }
  }))

  rubrieken.push(rubriek('r2_overigeRuimten', r.r2, () => {
    const per = vereist(r.r2.puntenPerM2, 'punten per m² overige ruimte')
    const stappen = [`Privé overige ruimten: ${fmt(som(invoer.priveOverigeRuimten))} m²`]
    const m2 = som(invoer.priveOverigeRuimten) + aandeel(gedeeldeOverige, stappen)
    stappen.push(`Toegerekend ${fmt(m2)} m² × ${fmt(per)} = ${fmt(m2 * per)}`)
    return { punten: m2 * per, stappen }
  }))

  rubrieken.push(rubriek('r3_verwarming', r.r3, () => {
    const stappen: string[] = []
    let punten = 0
    const tel = (aantal: number, per: number | null, label: string, gedeeldDoor = 1) => {
      if (!aantal) return
      const waarde = vereist(per, `punten per ${label}`)
      const sub = (aantal * waarde) / gedeeldDoor
      punten += sub
      stappen.push(`${aantal} ${label} × ${fmt(waarde)}${gedeeldDoor > 1 ? ` / ${gedeeldDoor} woonruimten` : ''} = ${fmt(sub)}`)
    }
    tel(invoer.priveVertrekken.filter(item => item.verwarmd).length, r.r3.verwarmdVertrek, 'verwarmd privé-vertrek')
    tel(invoer.priveOverigeRuimten.filter(item => item.verwarmd).length, r.r3.verwarmdeOverigeRuimte, 'verwarmde privé overige ruimte')
    tel(invoer.priveVertrekken.filter(item => item.gekoeld).length, r.r3.gekoeldVertrek, 'gekoeld privé-vertrek')
    for (const ruimte of invoer.gedeeldeRuimten) {
      const n = deler(ruimte.gedeeldDoor, `aantal woonruimten dat "${ruimte.naam}" deelt`)
      if (ruimte.verwarmd) tel(1, ruimte.soort === 'vertrek' ? r.r3.verwarmdVertrek : r.r3.verwarmdeOverigeRuimte, `verwarmd gedeeld(e) ${ruimte.soort === 'vertrek' ? 'vertrek' : 'overige ruimte'} (${ruimte.naam})`, n)
      if (ruimte.gekoeld && ruimte.soort === 'vertrek') tel(1, r.r3.gekoeldVertrek, `gekoeld gedeeld vertrek (${ruimte.naam})`, n)
    }
    if (!stappen.length) stappen.push('Geen verwarmde of gekoelde ruimten opgegeven.')
    return { punten, stappen }
  }))

  rubrieken.push(rubriek('r4_energie', r.r4, () => {
    const tabel = vereist(r.r4.perM2PerLabel, 'punten per m² per energielabel')
    const stappen: string[] = []
    let label = invoer.adres.energielabel
    if (label) stappen.push(`Energielabel van het adres: ${label}`)
    else {
      const bouwjaar = vereist(invoer.adres.bouwjaar, 'energielabel of bouwjaar van het adres (invoer)')
      const reeks = vereist(r.r4.bouwjaarNaarLabel, 'waardering zonder label naar bouwjaar')
      const rij = vereist([...reeks].sort((a, b) => b.vanaf - a.vanaf).find(item => bouwjaar >= item.vanaf), `waardering voor bouwjaar ${bouwjaar}`)
      label = rij.label
      stappen.push(`Geen geldig energielabel; bouwjaar ${bouwjaar} wordt gewaardeerd als ${label}`)
    }
    const per = vereist(tabel[label], `punten per m² voor label ${label}`)
    let punten = toegerekendeM2Vertrekken * per
    stappen.push(`${fmt(toegerekendeM2Vertrekken)} m² (rubriek 1) × ${fmt(per)} = ${fmt(punten)}`)
    if (punten < 0 && invoer.adres.monument && vereist(r.r4.geenMinpuntenBijMonument, 'regel minpunten bij monument')) {
      stappen.push('Monument: geen minpunten voor energieprestatie → 0')
      punten = 0
    }
    return { punten, stappen }
  }))

  const voorzieningen = (lijst: WwsoInvoer['keukens'], soort: string): Berekening => {
    const stappen: string[] = []
    let punten = 0
    for (const item of lijst) {
      const n = deler(item.gedeeldDoor, `aantal woonruimten dat "${item.naam}" deelt`)
      punten += item.punten / n
      stappen.push(`${item.naam}: ${fmt(item.punten)}${n > 1 ? ` / ${n} woonruimten` : ' (eigen)'} = ${fmt(item.punten / n)}`)
    }
    if (!lijst.length) stappen.push(`Geen ${soort} opgegeven.`)
    return { punten, stappen, waarschuwingen: lijst.length ? [`De punten per ${soort} zijn zelf ingevoerd; de regelset bevat nog geen tabel per voorziening.`] : [] }
  }
  rubrieken.push(rubriek('r5_keuken', r.r5, () => voorzieningen(invoer.keukens, 'keuken')))
  rubrieken.push(rubriek('r6_sanitair', r.r6, () => voorzieningen(invoer.sanitair, 'sanitaire voorziening')))
  if (invoer.keukens.length || invoer.sanitair.length) redenen.push('Punten van keuken en/of sanitair zijn per voorziening zelf ingevoerd.')

  rubrieken.push(rubriek('r7_gehandicapten', r.r7, () => ({ punten: 0, stappen: [] }), true))

  rubrieken.push(rubriek('r8_buitenruimten', r.r8, () => {
    const b = invoer.buitenruimte
    const stappen: string[] = []
    let punten = 0
    if (pos(b.priveM2)) {
      const basis = vereist(r.r8.privePuntenBijAanwezigheid, 'punten bij aanwezigheid privé-buitenruimte')
      const per = vereist(r.r8.privePuntenPerM2, 'punten per m² privé-buitenruimte')
      punten += basis + b.priveM2 * per
      stappen.push(`Privé: ${fmt(basis)} + ${fmt(b.priveM2)} m² × ${fmt(per)} = ${fmt(basis + b.priveM2 * per)}`)
    }
    if (pos(b.gedeeldOpAdresM2)) {
      const per = vereist(r.r8.gedeeldPuntenPerM2, 'punten per m² gedeelde buitenruimte')
      const n = deler(b.gedeeldOpAdresDoor, 'aantal woonruimten dat de gedeelde buitenruimte deelt')
      punten += (b.gedeeldOpAdresM2 * per) / n
      stappen.push(`Gedeeld op het adres: ${fmt(b.gedeeldOpAdresM2)} m² × ${fmt(per)} / ${n} woonruimten = ${fmt((b.gedeeldOpAdresM2 * per) / n)}`)
    }
    if (pos(b.complexM2)) {
      const per = vereist(r.r8.gedeeldPuntenPerM2, 'punten per m² gedeelde buitenruimte')
      const adressen = deler(b.complexAdressen, 'aantal adressen dat de buitenruimte deelt')
      const n = deler(invoer.adres.aantalWoonruimten, 'aantal onzelfstandige woonruimten op het adres')
      const sub = (b.complexM2 * per) / adressen / n
      punten += sub
      stappen.push(`Gedeeld met andere adressen: ${fmt(b.complexM2)} m² × ${fmt(per)} / ${adressen} adressen / ${n} woonruimten = ${fmt(sub)}`)
    }
    if (!stappen.length) {
      const aftrek = vereist(r.r8.aftrekZonderBuitenruimte, 'aftrek zonder buitenruimte')
      return { punten: aftrek, stappen: [`Geen enkele buitenruimte: ${fmt(aftrek)}`] }
    }
    const max = vereist(r.r8.maxPunten, 'maximum punten buitenruimten')
    if (punten > max) {
      stappen.push(`Begrensd op ${fmt(max)}`)
      punten = max
    }
    return { punten, stappen }
  }))

  rubrieken.push(rubriek('r9_gemeenschappelijk', r.r9, () => {
    const stappen: string[] = []
    if (!invoer.complexRuimten.length) return { punten: 0, stappen: ['Geen ruimten die met andere adressen worden gedeeld.'] }
    const n = deler(invoer.adres.aantalWoonruimten, 'aantal onzelfstandige woonruimten op het adres')
    let punten = 0
    for (const ruimte of invoer.complexRuimten) {
      const per = vereist(ruimte.soort === 'vertrek' ? r.r9.vertrekPerM2 : r.r9.overigPerM2, `punten per m² gemeenschappelijk(e) ${ruimte.soort}`)
      const adressen = deler(ruimte.adressen, `aantal adressen met toegang tot "${ruimte.naam}"`)
      const sub = (pos(ruimte.m2) * per) / adressen / n
      punten += sub
      stappen.push(`${ruimte.naam}: ${fmt(pos(ruimte.m2))} m² × ${fmt(per)} / ${adressen} adressen / ${n} woonruimten = ${fmt(sub)}`)
    }
    return { punten, stappen }
  }))

  rubrieken.push(rubriek('r10_parkeren', r.r10, () => {
    const p = invoer.parkeren
    const totaalPlekken = pos(p.typeI) + pos(p.typeII) + pos(p.typeIII)
    if (!totaalPlekken) return { punten: 0, stappen: ['Geen gemeenschappelijke parkeerplekken.'] }
    const stappen: string[] = []
    let totaal = 0
    for (const [aantal, waarde, label] of [[p.typeI, r.r10.typeI, 'type I'], [p.typeII, r.r10.typeII, 'type II'], [p.typeIII, r.r10.typeIII, 'type III']] as const) {
      if (!pos(aantal)) continue
      const per = vereist(waarde, `punten parkeerplek ${label}`)
      totaal += aantal * per
      stappen.push(`${aantal} × ${label} × ${fmt(per)} = ${fmt(aantal * per)}`)
    }
    const adressen = deler(p.adressen, 'aantal adressen dat de parkeerplekken deelt')
    const n = deler(invoer.adres.aantalWoonruimten, 'aantal onzelfstandige woonruimten op het adres')
    stappen.push(`${fmt(totaal)} / ${adressen} adressen / ${n} woonruimten = ${fmt(totaal / adressen / n)}`)
    return { punten: totaal / adressen / n, stappen }
  }))

  rubrieken.push(rubriek('r11_woz', r.r11, () => {
    const w = invoer.woz
    const waarde = vereist(w.waardeAdres, 'WOZ-waarde van het adres (invoer)')
    const m2 = vereist(w.gebruiksoppervlakteAdres, 'gebruiksoppervlakte van het adres (invoer)')
    const gemiddelde = vereist(w.coropGemiddeldePerM2, 'COROP-gemiddelde WOZ-waarde per m² (invoer, uit de Uitvoeringsregeling)')
    if (m2 <= 0 || gemiddelde <= 0) throw new Ontbreekt('geldige oppervlakte en COROP-gemiddelde (invoer)')
    const marge = vereist(r.r11.marge, 'bandbreedte t.o.v. COROP-gemiddelde')
    const perM2 = waarde / m2
    const verhouding = perM2 / gemiddelde
    const stappen = [
      `${euro(waarde)} / ${fmt(m2)} m² = ${euro(perM2)} per m²`,
      `COROP-gemiddelde${w.coropGebied ? ` (${w.coropGebied})` : ''}: ${euro(gemiddelde)} per m² → ${fmt(Math.round((verhouding - 1) * 1000) / 10)}%`,
    ]
    const [punten, uitleg] = verhouding > 1 + marge
      ? [vereist(r.r11.hoger, 'punten bij WOZ boven het gemiddelde'), `meer dan ${fmt(marge * 100)}% hoger`]
      : verhouding < 1 - marge
        ? [vereist(r.r11.lager, 'punten bij WOZ onder het gemiddelde'), `meer dan ${fmt(marge * 100)}% lager`]
        : [vereist(r.r11.gelijk, 'punten bij WOZ rond het gemiddelde'), `maximaal ${fmt(marge * 100)}% afwijkend`]
    stappen.push(`${uitleg}: ${fmt(punten)}`)
    return { punten, stappen }
  }))

  rubrieken.push(rubriek('r12_bijzonder', r.r12, () => {
    const stappen: string[] = []
    let punten = 0
    if (invoer.bijzonder.zorgwoning) {
      const pct = vereist(r.r12.zorgwoningPercentage, 'percentage zorgwoning')
      const basis = rubrieken.filter(item => item.nummer <= 11)
      if (basis.some(item => item.punten === null)) throw new Ontbreekt('rubrieken 1 t/m 11 (nodig voor de zorgwoning-toeslag)')
      const som11 = basis.reduce((sum, item) => sum + item.punten!, 0)
      punten += som11 * pct
      stappen.push(`Zorgwoning: ${fmt(pct * 100)}% van ${fmt(som11)} (rubrieken 1–11) = ${fmt(som11 * pct)}`)
    }
    if (invoer.bijzonder.aanbelfunctie) {
      const waarde = vereist(r.r12.aanbelfunctie, 'punten aanbelfunctie')
      punten += waarde
      stappen.push(`Aanbelfunctie met video en audio: ${fmt(waarde)}`)
    }
    if (pos(invoer.parkeren.laadpalen)) {
      const waarde = vereist(r.r12.laadpaal, 'punten per laadpaal')
      const adressen = deler(invoer.parkeren.laadpaalAdressen, 'aantal adressen met toegang tot de laadpaal')
      const sub = (invoer.parkeren.laadpalen * waarde) / adressen
      punten += sub
      stappen.push(`${invoer.parkeren.laadpalen} laadpaal/-palen × ${fmt(waarde)} / ${adressen} adressen = ${fmt(sub)}`)
    }
    if (!stappen.length) stappen.push('Geen bijzondere voorzieningen.')
    return { punten, stappen }
  }))

  rubrieken.push(rubriek('r13_aftrek', r.r13, () => {
    const stappen: string[] = []
    let punten = 0
    const grens = vereist(r.r13.kleinerDanM2, 'oppervlaktegrens aftrek')
    if (toegerekendeM2Vertrekken < grens) {
      const a = vereist(r.r13.aftrekKlein, 'aftrek kleine oppervlakte')
      punten += a
      stappen.push(`Oppervlakte vertrekken (rubriek 1) ${fmt(toegerekendeM2Vertrekken)} m² < ${fmt(grens)} m²: ${fmt(a)}`)
    }
    const checks: [boolean, number | null, string][] = [
      [invoer.aftrek.alleenViaVertrekVerhuurder, r.r13.aftrekViaVerhuurder, 'Alleen bereikbaar via woon-/slaapvertrek van de verhuurder'],
      [invoer.aftrek.ruitOppervlakteKleiner, r.r13.aftrekRuit, 'Ruitoppervlakte (hoofd)woonvertrek te klein'],
      [invoer.aftrek.kozijnTeHoog, r.r13.aftrekKozijn, 'Laagste raamkozijn (hoofd)woonvertrek te hoog'],
    ]
    for (const [geldt, waarde, label] of checks) {
      if (!geldt) continue
      const a = vereist(waarde, `aftrek: ${label.toLowerCase()}`)
      punten += a
      stappen.push(`${label}: ${fmt(a)}`)
    }
    if (!stappen.length) stappen.push('Geen aftrekpunten.')
    return { punten, stappen }
  }))

  // ---------- Totaal ----------
  const ontbrekend = rubrieken.filter(item => item.punten === null)
  for (const item of ontbrekend) redenen.push(`Rubriek ${item.nummer} (${item.naam}): niet bepaald.`)
  for (const item of rubrieken) {
    if (item.bron === 'handmatig') redenen.push(`Rubriek ${item.nummer} (${item.naam}): handmatig ingevuld.`)
    else if (item.bron === 'berekend' && item.status === 'ongeverifieerd') redenen.push(`Rubriek ${item.nummer} (${item.naam}): regel nog niet geverifieerd.`)
  }
  if (stap === null) redenen.push('Afronding per rubriek ontbreekt in de regelset.')
  else if (r.afrondingRubriek.status === 'ongeverifieerd') redenen.push('Afronding per rubriek: nog niet geverifieerd.')

  const toeslagen: { naam: string; punten: number }[] = []
  if (invoer.adres.rijksmonumentVoorWbh) {
    if (r.rijksmonumentToeslag.punten === null) redenen.push('Puntentoeslag rijksmonument ontbreekt in de regelset.')
    else {
      toeslagen.push({ naam: 'Rijksmonument (verhuurd vóór de Wet betaalbare huur)', punten: r.rijksmonumentToeslag.punten })
      if (r.rijksmonumentToeslag.status === 'ongeverifieerd') redenen.push('Toeslag rijksmonument: nog niet geverifieerd.')
    }
  }

  let totaalPunten: number | null = null
  if (!ontbrekend.length) {
    const som = rubrieken.reduce((sum, item) => sum + item.punten!, 0) + toeslagen.reduce((sum, item) => sum + item.punten, 0)
    if (r.afrondingTotaal.methode === 'heel_punt') {
      totaalPunten = Math.round(som)
      if (r.afrondingTotaal.status === 'ongeverifieerd') redenen.push('Afronding van het totaal: nog niet geverifieerd.')
    } else redenen.push('Afronding van het totaal ontbreekt in de regelset.')
  }

  let maximaleHuur: number | null = null
  if (totaalPunten !== null) {
    const tabel = r.huurtabel.punten
    if (r.huurtabel.status === 'niet_geconfigureerd' || !tabel?.length) {
      redenen.push('Huurprijstabel voor onzelfstandige woonruimte is nog niet in de regelset ingevoerd; geen maximale huur berekend.')
    } else {
      maximaleHuur = tabel.find(([punten]) => punten === totaalPunten)?.[1] ?? null
      if (maximaleHuur === null) redenen.push(`Huurprijstabel bevat geen bedrag voor ${totaalPunten} punten.`)
      else if (r.huurtabel.status === 'ongeverifieerd') redenen.push('Huurprijstabel: nog niet geverifieerd.')
    }
  }

  return {
    regelset: { id: r.id, naam: r.naam },
    rubrieken,
    toegerekendeM2Vertrekken,
    toeslagen,
    totaalPunten,
    maximaleHuur,
    betrouwbaarheid: totaalPunten === null ? 'onvolledig' : redenen.length ? 'indicatief' : 'officieel',
    redenen: Array.from(new Set(redenen)),
  }
}

/** Overzicht per onderdeel van de regelset: status, bron en ontbrekende waarden. */
export function controleerWwsoRegelset(r: WwsoRegelset) {
  const onderdelen: [string, Herkomst & Record<string, unknown>][] = [
    ['Afronding per rubriek', r.afrondingRubriek], ['Afronding totaal', r.afrondingTotaal],
    ...(Object.keys(namen) as RubriekId[]).map(id => {
      const key = id.split('_')[0] as 'r1'
      return [`${namen[id][0]}. ${namen[id][1]}`, r[key] as Herkomst & Record<string, unknown>] as [string, Herkomst & Record<string, unknown>]
    }),
    ['Toeslag rijksmonument', r.rijksmonumentToeslag], ['Huurprijstabel', r.huurtabel],
  ]
  const meta = ['status', 'bron', 'gecontroleerdDoor', 'gecontroleerdOp', 'opmerking']
  return onderdelen.map(([naam, regel]) => ({
    naam,
    status: regel.status,
    bron: regel.bron,
    opmerking: regel.opmerking,
    ontbrekend: Object.entries(regel).filter(([key, value]) => !meta.includes(key) && value === null).map(([key]) => key),
  }))
}
