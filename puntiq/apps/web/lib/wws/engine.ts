/**
 * WWS-rekenmotor voor zelfstandige woonruimte.
 *
 * Deze motor bevat bewust geen enkel getal uit de regelgeving: alle punten, delers, grenzen en bedragen
 * komen uit de meegegeven `Regelset`. Ontbreekt een benodigde waarde, dan wordt die rubriek niet geschat
 * maar als 'ontbreekt' gemarkeerd, tenzij de gebruiker handmatige punten heeft ingevuld.
 */
import type {
  Betrouwbaarheid, Herkomst, Opslag, Regelset, RubriekId, RubriekUitkomst, Segment, WwsInvoer, WwsUitkomst,
} from './types'

const fmt = (value: number) => (Number.isInteger(value) ? String(value) : value.toLocaleString('nl-NL', { maximumFractionDigits: 4 }))
const euro = (value: number) => value.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' })
const cents = (value: number) => Math.round(value * 100) / 100
const positive = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0)

function afronden(value: number, stap?: number) {
  return stap ? Math.round(value / stap) * stap : value
}

class Ontbreekt extends Error {}

/** Haalt een verplichte regelwaarde op; gooit Ontbreekt als die niet is ingevuld. */
function vereist<T>(value: T | null | undefined, naam: string): T {
  if (value === null || value === undefined) throw new Ontbreekt(naam)
  return value
}

type Berekening = { punten: number; stappen: string[]; waarschuwingen?: string[] }

function rubriek(id: RubriekId, naam: string, herkomst: Herkomst, invoer: WwsInvoer, bereken: () => Berekening): RubriekUitkomst {
  const handmatig = invoer.handmatig[id]
  if (handmatig) {
    return {
      id, naam, punten: handmatig.punten, bron: 'handmatig', status: herkomst.status,
      stappen: [`Handmatig ingevuld: ${fmt(handmatig.punten)} punten${handmatig.toelichting ? ` (${handmatig.toelichting})` : ''}.`],
      waarschuwingen: [],
    }
  }
  if (herkomst.status === 'niet_geconfigureerd') {
    return { id, naam, punten: null, bron: 'ontbreekt', status: herkomst.status, stappen: [], waarschuwingen: ['Geen rekenregel in deze regelset. Vul de punten handmatig in.'] }
  }
  try {
    const result = bereken()
    const punten = afronden(result.punten, herkomst.afronding?.stap)
    if (punten !== result.punten) result.stappen.push(`Afgerond op ${fmt(herkomst.afronding!.stap)}: ${fmt(punten)}`)
    return { id, naam, punten, bron: 'berekend', status: herkomst.status, stappen: result.stappen, waarschuwingen: result.waarschuwingen ?? [] }
  } catch (error) {
    if (!(error instanceof Ontbreekt)) throw error
    return { id, naam, punten: null, bron: 'ontbreekt', status: herkomst.status, stappen: [], waarschuwingen: [`Regelwaarde "${error.message}" ontbreekt in de regelset. Vul de punten handmatig in.`] }
  }
}

function catalogusPunten(catalogus: Record<string, { naam: string; punten: number | null }>, aantallen: Record<string, number>, stappen: string[]) {
  let totaal = 0
  for (const [sleutel, aantal] of Object.entries(aantallen)) {
    if (!positive(aantal)) continue
    const item = catalogus[sleutel]
    if (!item) throw new Ontbreekt(`voorziening ${sleutel}`)
    const punten = vereist(item.punten, `punten voor ${item.naam}`)
    totaal += punten * aantal
    stappen.push(`${item.naam}: ${fmt(aantal)} × ${fmt(punten)} = ${fmt(punten * aantal)}`)
  }
  return totaal
}

export function berekenWws(invoer: WwsInvoer, regelset: Regelset): WwsUitkomst {
  const r = regelset.rubrieken
  const m2Vertrekken = invoer.vertrekken.reduce((sum, ruimte) => sum + positive(ruimte.m2), 0)
  const m2Overig = invoer.overigeRuimten.reduce((sum, ruimte) => sum + positive(ruimte.m2), 0)
  const totaleOppervlakte = m2Vertrekken + m2Overig

  const rubrieken: RubriekUitkomst[] = [
    rubriek('vertrekken', 'Oppervlakte vertrekken', r.vertrekken, invoer, () => {
      const factor = vereist(r.vertrekken.puntenPerM2, 'punten per m² vertrekken')
      const punten = m2Vertrekken * factor
      return { punten, stappen: [`${invoer.vertrekken.length} vertrek(ken), samen ${fmt(m2Vertrekken)} m² × ${fmt(factor)} = ${fmt(punten)}`] }
    }),
    rubriek('overigeRuimten', 'Oppervlakte overige ruimten', r.overigeRuimten, invoer, () => {
      const factor = vereist(r.overigeRuimten.puntenPerM2, 'punten per m² overige ruimten')
      const punten = m2Overig * factor
      return { punten, stappen: [`${invoer.overigeRuimten.length} overige ruimte(n), samen ${fmt(m2Overig)} m² × ${fmt(factor)} = ${fmt(punten)}`] }
    }),
    rubriek('verwarming', 'Verwarming en koeling', r.verwarming, invoer, () => {
      const v = r.verwarming
      const verwarmdeVertrekken = invoer.vertrekken.filter(ruimte => ruimte.verwarmd).length
      const verwarmdeOverige = invoer.overigeRuimten.filter(ruimte => ruimte.verwarmd).length
      const gekoeld = invoer.vertrekken.filter(ruimte => ruimte.gekoeld).length
      const stappen: string[] = []
      let punten = 0
      if (verwarmdeVertrekken) {
        const per = vereist(v.puntenPerVerwarmdVertrek, 'punten per verwarmd vertrek')
        punten += verwarmdeVertrekken * per
        stappen.push(`${verwarmdeVertrekken} verwarmd(e) vertrek(ken) × ${fmt(per)} = ${fmt(verwarmdeVertrekken * per)}`)
      }
      if (verwarmdeOverige) {
        const per = vereist(v.puntenPerVerwarmdeOverigeRuimte, 'punten per verwarmde overige ruimte')
        const max = vereist(v.maxPuntenOverigeRuimten, 'maximum punten verwarmde overige ruimten')
        const sub = Math.min(verwarmdeOverige * per, max)
        punten += sub
        stappen.push(`${verwarmdeOverige} verwarmde overige ruimte(n) × ${fmt(per)}, maximaal ${fmt(max)} = ${fmt(sub)}`)
      }
      if (gekoeld) {
        const per = vereist(v.puntenPerGekoeldVertrek, 'punten per gekoeld vertrek')
        const max = vereist(v.maxPuntenKoeling, 'maximum punten koeling')
        const sub = Math.min(gekoeld * per, max)
        punten += sub
        stappen.push(`${gekoeld} gekoeld(e) vertrek(ken) × ${fmt(per)}, maximaal ${fmt(max)} = ${fmt(sub)}`)
      }
      if (!stappen.length) stappen.push('Geen verwarmde of gekoelde ruimten opgegeven.')
      return { punten, stappen }
    }),
    rubriek('energie', 'Energieprestatie', r.energie, invoer, () => {
      const e = r.energie
      if (invoer.energielabel) {
        const tabel = vereist(e.perLabel, 'energiepunten per label')
        const rij = vereist(tabel[invoer.energielabel], `energiepunten voor label ${invoer.energielabel}`)
        return { punten: rij[invoer.woningType], stappen: [`Energielabel ${invoer.energielabel}, ${invoer.woningType}woning: ${fmt(rij[invoer.woningType])}`] }
      }
      if (invoer.bouwjaar === null) {
        const punten = vereist(e.zonderLabelOnbekendBouwjaar, 'energiepunten zonder label en bouwjaar')
        return { punten, stappen: [`Geen energielabel en geen bouwjaar: ${fmt(punten)}`], waarschuwingen: ['Vul energielabel of bouwjaar in voor een nauwkeuriger uitkomst.'] }
      }
      const reeks = vereist(e.zonderLabel, 'energiepunten zonder label')
      const rij = [...reeks].sort((a, b) => b.vanafBouwjaar - a.vanafBouwjaar).find(item => invoer.bouwjaar! >= item.vanafBouwjaar)
      const gevonden = vereist(rij, `energiepunten zonder label voor bouwjaar ${invoer.bouwjaar}`)
      return {
        punten: gevonden.punten[invoer.woningType],
        stappen: [`Geen geldig energielabel; bouwjaar ${invoer.bouwjaar} (vanaf ${gevonden.vanafBouwjaar}): ${fmt(gevonden.punten[invoer.woningType])}`],
        waarschuwingen: ['Zonder geldig energielabel geldt een waardering op basis van bouwjaar.'],
      }
    }),
    rubriek('keuken', 'Keuken', r.keuken, invoer, () => {
      const k = r.keuken
      const stappen: string[] = []
      const lengte = positive(invoer.keuken.aanrechtLengteMeters)
      const drempels = vereist(k.aanrecht, 'punten per aanrechtlengte')
      const drempel = [...drempels].sort((a, b) => b.vanafMeters - a.vanafMeters).find(item => lengte >= item.vanafMeters)
      const aanrecht = drempel?.punten ?? 0
      stappen.push(`Aanrecht ${fmt(lengte)} m${drempel ? ` (vanaf ${fmt(drempel.vanafMeters)} m)` : ''}: ${fmt(aanrecht)}`)
      let extra = catalogusPunten(k.voorzieningen, invoer.keuken.voorzieningen, stappen)
      if (positive(invoer.keuken.extraPuntenHandmatig)) {
        extra += invoer.keuken.extraPuntenHandmatig
        stappen.push(`Extra voorzieningen (zelf vastgesteld): ${fmt(invoer.keuken.extraPuntenHandmatig)}`)
      }
      if (extra > 0 && vereist(k.extraMaxIsAanrechtPunten, 'maximum extra keukenvoorzieningen') && extra > aanrecht) {
        stappen.push(`Extra voorzieningen begrensd tot de aanrechtpunten: ${fmt(extra)} → ${fmt(aanrecht)}`)
        extra = aanrecht
      }
      return { punten: aanrecht + extra, stappen }
    }),
    rubriek('sanitair', 'Sanitair', r.sanitair, invoer, () => {
      const stappen: string[] = []
      const punten = catalogusPunten(r.sanitair.voorzieningen, invoer.sanitair.voorzieningen, stappen)
      if (!stappen.length) stappen.push('Geen sanitaire voorzieningen opgegeven.')
      return { punten, stappen }
    }),
    // Aanvullende rubrieken zonder automatische regel: alleen handmatig, anders 0 (voorziening niet aanwezig).
    ...regelset.alleenHandmatig.map((item): RubriekUitkomst => {
      const handmatig = invoer.handmatig[item.id]
      return handmatig
        ? { id: item.id, naam: item.naam, punten: handmatig.punten, bron: 'handmatig', status: item.herkomst.status, stappen: [`Handmatig ingevuld: ${fmt(handmatig.punten)} punten${handmatig.toelichting ? ` (${handmatig.toelichting})` : ''}.`], waarschuwingen: [] }
        : { id: item.id, naam: item.naam, punten: 0, bron: 'berekend', status: item.herkomst.status, stappen: ['Niet opgegeven: aangenomen dat deze voorzieningen ontbreken (0 punten).'], waarschuwingen: [] }
    }),
    rubriek('buitenruimte', 'Buitenruimte', r.buitenruimte, invoer, () => {
      const b = r.buitenruimte
      const m2 = positive(invoer.buitenruimte.priveM2)
      if (!m2) {
        const punten = vereist(b.puntenZonderBuitenruimte, 'punten zonder buitenruimte')
        return { punten, stappen: [`Geen privé-buitenruimte: ${fmt(punten)}`] }
      }
      const basis = vereist(b.puntenBijAanwezigheid, 'punten bij aanwezigheid buitenruimte')
      const per = vereist(b.puntenPerM2Prive, 'punten per m² privé-buitenruimte')
      const max = vereist(b.maxPunten, 'maximum punten buitenruimte')
      const ruw = basis + m2 * per
      const punten = Math.min(ruw, max)
      return { punten, stappen: [`Aanwezig: ${fmt(basis)} + ${fmt(m2)} m² × ${fmt(per)} = ${fmt(ruw)}${ruw > max ? `, begrensd op ${fmt(max)}` : ''}`] }
    }),
  ]

  // ---------- WOZ ----------
  const w = r.woz
  const wozRubriek = rubriek('woz', 'WOZ-waarde', w, invoer, () => {
    const waarde = vereist(invoer.woz.waarde, 'WOZ-waarde van de woning (invoer)')
    if (!totaleOppervlakte) throw new Ontbreekt('oppervlakte van de woning (invoer)')
    const minimum = vereist(w.minimumWaarde, 'minimale WOZ-waarde')
    const deler1 = vereist(w.delerWaarde, 'deler WOZ-waarde')
    let deler2 = vereist(w.delerWaardePerM2, 'deler WOZ-waarde per m²')
    const stappen: string[] = []
    const effectief = Math.max(waarde, minimum)
    if (effectief !== waarde) stappen.push(`WOZ-waarde ${euro(waarde)} is lager dan het minimum; gerekend met ${euro(minimum)}`)
    const u = w.uitzonderingKleineWoning
    if (u && invoer.woz.regioKenmerken.includes(u.regioKenmerk) && totaleOppervlakte < u.onderM2) {
      deler2 = u.delerWaardePerM2
      stappen.push(`Kleine woning (< ${fmt(u.onderM2)} m²) met kenmerk "${u.regioKenmerk}": afwijkende deler ${fmt(deler2)}`)
    }
    const deel1 = effectief / deler1
    const deel2 = effectief / totaleOppervlakte / deler2
    stappen.push(`${euro(effectief)} / ${fmt(deler1)} = ${fmt(cents(deel1))}`)
    stappen.push(`${euro(effectief)} / ${fmt(totaleOppervlakte)} m² / ${fmt(deler2)} = ${fmt(cents(deel2))}`)
    return { punten: deel1 + deel2, stappen }
  })

  const redenen: string[] = []
  const alle = [...rubrieken, wozRubriek]
  const ontbrekend = alle.filter(item => item.punten === null)
  for (const item of ontbrekend) redenen.push(`${item.naam}: niet bepaald.`)

  const herkomsten: { naam: string; herkomst: Herkomst }[] = []
  const regelVan: Record<string, Herkomst> = { ...r, ...Object.fromEntries(regelset.alleenHandmatig.map(item => [item.id, item.herkomst])) }
  for (const item of alle) {
    if (item.bron === 'handmatig') redenen.push(`${item.naam}: handmatig ingevuld.`)
    else if (item.bron === 'berekend') herkomsten.push({ naam: item.naam, herkomst: regelVan[item.id] })
  }

  let puntenZonderWoz: number | null = null
  let totaalPunten: number | null = null
  if (!ontbrekend.length) {
    puntenZonderWoz = rubrieken.reduce((sum, item) => sum + item.punten!, 0)
    let woz = wozRubriek.punten!
    const plafond = w.plafond
    let begrensd = false
    if (wozRubriek.bron === 'berekend' && plafond && puntenZonderWoz + woz >= plafond.vanafTotaal) {
      const max = (plafond.maxAandeel / (1 - plafond.maxAandeel)) * puntenZonderWoz
      if (woz > max) {
        wozRubriek.stappen.push(`Totaal ≥ ${fmt(plafond.vanafTotaal)}: WOZ-punten maximaal ${fmt(plafond.maxAandeel * 100)}% van het totaal → ${fmt(cents(max))}`)
        woz = max
      }
      begrensd = true
    }
    const t = regelset.totaal
    if (t.afronding === null) {
      redenen.push('Afronding van het totaal ontbreekt in de regelset.')
    } else {
      let totaal = Math.round(puntenZonderWoz + woz)
      if (begrensd && plafond?.minimumTotaalNaPlafond !== undefined && totaal < plafond.vanafTotaal) totaal = plafond.minimumTotaalNaPlafond
      if (t.minimumPunten !== null && totaal < t.minimumPunten) totaal = t.minimumPunten
      totaalPunten = totaal
    }
  }

  // ---------- Segment en huur ----------
  let segment: Segment | null = null
  let tabelHuur: number | null = null
  let maximaleHuur: number | null = null
  const toegepasteOpslagen: { id: string; naam: string; percentage: number }[] = []

  if (totaalPunten !== null) {
    const segmenten = regelset.segmenten
    if (segmenten.status === 'niet_geconfigureerd' || !segmenten.lijst.length) {
      redenen.push('Huursegmenten ontbreken in de regelset.')
    } else {
      segment = segmenten.lijst.find(item => item.totEnMetPunten === null || totaalPunten! <= item.totEnMetPunten) ?? null
      herkomsten.push({ naam: 'Huursegmenten', herkomst: segmenten })
    }

    const h = regelset.huurtabel
    if (h.status === 'niet_geconfigureerd' || !h.punten?.length || h.minimumPunten === null) {
      redenen.push('Huurprijstabel ontbreekt in de regelset; geen maximale huur berekend.')
    } else {
      herkomsten.push({ naam: 'Huurprijstabel', herkomst: h })
      if (h.methode === 'ankers_interpolatie') redenen.push('Maximale huur is benaderd via interpolatie tussen ankerpunten, niet uit de volledige officiële tabel.')
      tabelHuur = huurUitTabel(totaalPunten, h.punten, h.minimumPunten, h.bedragPerPuntBoven, h.methode, redenen)
    }

    const gekozen = regelset.opslagen.filter(item => invoer.opslagen.includes(item.id))
    const vanToepassing = gekozen.filter(item => opslagGeldt(item, totaalPunten!, invoer.bouwjaar))
    for (const item of gekozen.filter(item => !vanToepassing.includes(item))) redenen.push(`Opslag "${item.naam}" is niet van toepassing op deze woning.`)
    if (vanToepassing.length > 1) {
      redenen.push('Meerdere opslagen tegelijk: de combinatie is niet in de regelset vastgelegd. Opslagen niet toegepast.')
    } else if (vanToepassing.length === 1) {
      const opslag = vanToepassing[0]
      if (opslag.percentage === null) redenen.push(`Percentage voor opslag "${opslag.naam}" ontbreekt in de regelset.`)
      else {
        toegepasteOpslagen.push({ id: opslag.id, naam: opslag.naam, percentage: opslag.percentage })
        herkomsten.push({ naam: `Opslag ${opslag.naam}`, herkomst: opslag })
      }
    }

    if (tabelHuur !== null && segment) {
      const opslag = toegepasteOpslagen.reduce((sum, item) => sum + item.percentage, 0)
      maximaleHuur = segment.gereguleerd ? cents(tabelHuur * (1 + opslag)) : null
    }
  }

  for (const { naam, herkomst } of herkomsten) {
    if (herkomst.status === 'ongeverifieerd') redenen.push(`${naam}: regel nog niet geverifieerd tegen de officiële bron.`)
  }

  const volledig = totaalPunten !== null && segment !== null && (tabelHuur !== null || segment?.gereguleerd === false)
  const betrouwbaarheid: Betrouwbaarheid = !volledig ? 'onvolledig' : redenen.length ? 'indicatief' : 'officieel'

  return {
    regelset: { id: regelset.id, naam: regelset.naam, geldigVanaf: regelset.geldigVanaf, geldigTot: regelset.geldigTot },
    rubrieken: alle,
    totaleOppervlakte,
    puntenZonderWoz,
    totaalPunten,
    segment,
    tabelHuur,
    opslagen: toegepasteOpslagen,
    maximaleHuur,
    betrouwbaarheid,
    redenen: Array.from(new Set(redenen)),
  }
}

function opslagGeldt(opslag: Opslag, punten: number, bouwjaar: number | null) {
  if (opslag.minPunten !== undefined && punten < opslag.minPunten) return false
  if (opslag.maxPunten !== undefined && punten > opslag.maxPunten) return false
  if (opslag.bouwjaarVoor !== undefined && (bouwjaar === null || bouwjaar >= opslag.bouwjaarVoor)) return false
  return true
}

function huurUitTabel(
  punten: number, tabel: [number, number][], minimum: number, perPuntBoven: number | null,
  methode: 'exact' | 'ankers_interpolatie', redenen: string[],
): number | null {
  const rijen = [...tabel].sort((a, b) => a[0] - b[0])
  const p = Math.max(minimum, punten)
  const [hoogstePunt, hoogsteBedrag] = rijen[rijen.length - 1]
  if (p > hoogstePunt) {
    if (perPuntBoven === null) {
      redenen.push(`Geen bedrag per punt boven ${hoogstePunt} punten in de regelset.`)
      return null
    }
    return cents(hoogsteBedrag + (p - hoogstePunt) * perPuntBoven)
  }
  if (methode === 'exact') {
    const rij = rijen.find(([aantal]) => aantal === p)
    if (!rij) redenen.push(`Huurprijstabel bevat geen bedrag voor ${p} punten.`)
    return rij ? rij[1] : null
  }
  for (let index = 1; index < rijen.length; index += 1) {
    const [vanPunten, vanBedrag] = rijen[index - 1]
    const [totPunten, totBedrag] = rijen[index]
    if (p <= totPunten) return cents(vanBedrag + ((p - vanPunten) / (totPunten - vanPunten)) * (totBedrag - vanBedrag))
  }
  return hoogsteBedrag
}

/** Controleert een regelset: welke waarden ontbreken en welke zijn niet geverifieerd. Voor het beheerscherm. */
export function controleerRegelset(regelset: Regelset) {
  const onderdelen: { naam: string; status: Herkomst['status']; bron?: string; ontbrekend: string[] }[] = []
  // Metadata en optionele regels (null = bewust niet van toepassing) tellen niet als ontbrekend.
  const overslaan = ['status', 'bron', 'gecontroleerdDoor', 'gecontroleerdOp', 'opmerking', 'afronding', 'uitzonderingKleineWoning', 'plafond']
  const leeg = (object: Record<string, unknown>, prefix = ''): string[] =>
    Object.entries(object).flatMap(([key, value]) => {
      if (overslaan.includes(key)) return []
      if (value === null) return [`${prefix}${key}`]
      if (value && typeof value === 'object' && !Array.isArray(value)) return leeg(value as Record<string, unknown>, `${prefix}${key}.`)
      return []
    })
  const namen: Record<keyof Regelset['rubrieken'], string> = {
    vertrekken: 'Oppervlakte vertrekken', overigeRuimten: 'Oppervlakte overige ruimten', verwarming: 'Verwarming en koeling', energie: 'Energieprestatie',
    keuken: 'Keuken', sanitair: 'Sanitair', buitenruimte: 'Buitenruimte', woz: 'WOZ-waarde',
  }
  for (const [key, regel] of Object.entries(regelset.rubrieken) as [keyof Regelset['rubrieken'], Herkomst][]) {
    onderdelen.push({ naam: namen[key], status: regel.status, bron: regel.bron, ontbrekend: leeg(regel as unknown as Record<string, unknown>) })
  }
  for (const item of regelset.alleenHandmatig) onderdelen.push({ naam: item.naam, status: item.herkomst.status, bron: item.herkomst.bron, ontbrekend: [] })
  const h = regelset.huurtabel
  onderdelen.push({ naam: 'Huurprijstabel', status: h.status, bron: h.bron, ontbrekend: [...(h.punten ? [] : ['punten']), ...(h.minimumPunten === null ? ['minimumPunten'] : []), ...(h.bedragPerPuntBoven === null ? ['bedragPerPuntBoven'] : []), ...(h.methode === 'ankers_interpolatie' ? ['volledige tabel (nu interpolatie)'] : [])] })
  onderdelen.push({ naam: 'Huursegmenten', status: regelset.segmenten.status, bron: regelset.segmenten.bron, ontbrekend: regelset.segmenten.lijst.slice(0, -1).filter(item => item.totEnMetPunten === null).map(item => `grens ${item.naam}`) })
  for (const opslag of regelset.opslagen) onderdelen.push({ naam: `Opslag: ${opslag.naam}`, status: opslag.status, bron: opslag.bron, ontbrekend: opslag.percentage === null ? ['percentage'] : [] })
  return onderdelen
}
