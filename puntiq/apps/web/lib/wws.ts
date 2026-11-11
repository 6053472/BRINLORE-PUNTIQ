export type Energielabel =
  | 'A++++'
  | 'A+++'
  | 'A++'
  | 'A+'
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'GEEN'

export type WoningType = 'eengezins' | 'meergezins'
export type OpslagType =
  | 'geen'
  | 'nieuwbouw_middenhuur'
  | 'rijksmonument'
  | 'gemeentelijk_monument'
  | 'beschermd_stadsgezicht'

export type WwsInput = {
  m2Vertrekken: number
  m2OverigeRuimten: number
  verwarmdeVertrekken: number
  verwarmdeOverigeRuimten: number
  gekoeldeVertrekken: number
  energielabel: Energielabel
  bouwjaar: number
  woningType: WoningType
  aanrechtLengteMeters: number
  keukenExtraPunten: number
  sanitairPunten: number
  m2BuitenruimtePrive: number
  wozWaarde: number
  isCoropAmsterdamUtrechtKlein: boolean
  opslagType: OpslagType
}

export type WwsResult = {
  punten: {
    vertrekken: number
    overigeRuimten: number
    verwarming: number
    verkoeling: number
    energie: number
    keukenBasis: number
    keukenExtra: number
    keuken: number
    sanitair: number
    buitenruimte: number
    basis: number
    wozRuw: number
    wozDefinitief: number
  }
  totaleOppervlakte: number
  effectieveWoz: number
  wozCapToegepast: boolean
  ruwTotaal: number
  totaalPunten: number
  huurSegment: string
  wettelijkeMaximumhuur: number | null
  tabelHuurprijs: number
  opslagPercentage: number
  huurprijsMetOpslag: number
}

const quarter = (value: number) => Math.round(value * 4) / 4
const nonNegative = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0)

const energyPoints: Record<Exclude<Energielabel, 'GEEN'>, [number, number]> = {
  'A++++': [62, 58],
  'A+++': [57, 53],
  'A++': [52, 48],
  'A+': [47, 43],
  A: [41, 37],
  B: [34, 30],
  C: [22, 15],
  D: [14, 11],
  E: [-4, -4],
  F: [-9, -9],
  G: [-15, -15],
}

const rentAnchors: Array<[number, number]> = [
  [40, 250.26],
  [100, 637.67],
  [143, 932.93],
  [144, 939.79],
  [186, 1228.07],
  [187, 1234.92],
  [250, 1667.4],
]

function energyScore(label: Energielabel, bouwjaar: number, type: WoningType) {
  const index = type === 'eengezins' ? 0 : 1
  if (label !== 'GEEN') return energyPoints[label][index]
  if (bouwjaar >= 2002) return [36, 32][index]
  if (bouwjaar >= 1992) return [24, 20][index]
  if (bouwjaar >= 1977) return [12, 8][index]
  return -15
}

function interpolatedRent(points: number) {
  const bounded = Math.max(40, points)
  if (bounded > 250) return Math.round((1667.4 + (bounded - 250) * 6.86) * 100) / 100
  for (let index = 1; index < rentAnchors.length; index += 1) {
    const [fromPoints, fromRent] = rentAnchors[index - 1]
    const [toPoints, toRent] = rentAnchors[index]
    if (bounded <= toPoints) {
      const ratio = (bounded - fromPoints) / (toPoints - fromPoints)
      return Math.round((fromRent + ratio * (toRent - fromRent)) * 100) / 100
    }
  }
  return 1667.4
}

function opslagPercentage(type: OpslagType, punten: number, bouwjaar: number) {
  if (type === 'nieuwbouw_middenhuur') return punten >= 144 && punten <= 186 ? 0.1 : 0
  if (type === 'rijksmonument') return 0.35
  if (type === 'gemeentelijk_monument') return 0.15
  if (type === 'beschermd_stadsgezicht') return bouwjaar < 1965 ? 0.05 : 0
  return 0
}

/** Pure WWS 2026 calculation for a zelfstandige huurwoning. */
export function berekenWWS(input: WwsInput): WwsResult {
  const vertrekken = quarter(nonNegative(input.m2Vertrekken))
  const overigeRuimten = quarter(nonNegative(input.m2OverigeRuimten) * 0.75)
  const verwarming = quarter(
    nonNegative(input.verwarmdeVertrekken) * 2 + Math.min(nonNegative(input.verwarmdeOverigeRuimten), 4),
  )
  const verkoeling = quarter(Math.min(nonNegative(input.gekoeldeVertrekken), 2))
  const energie = quarter(energyScore(input.energielabel, input.bouwjaar, input.woningType))

  const keukenBasis = input.aanrechtLengteMeters >= 2 ? 7 : input.aanrechtLengteMeters >= 1 ? 4 : 0
  const keukenExtra = Math.min(nonNegative(input.keukenExtraPunten), keukenBasis)
  const keuken = quarter(keukenBasis + keukenExtra)
  const sanitair = quarter(nonNegative(input.sanitairPunten))
  const buitenruimte = quarter(
    input.m2BuitenruimtePrive <= 0
      ? -5
      : Math.min(15, 2 + nonNegative(input.m2BuitenruimtePrive) * 0.35),
  )
  const basis = quarter(
    vertrekken + overigeRuimten + verwarming + verkoeling + energie + keuken + sanitair + buitenruimte,
  )

  const totaleOppervlakte = nonNegative(input.m2Vertrekken) + nonNegative(input.m2OverigeRuimten)
  const effectieveWoz = Math.max(nonNegative(input.wozWaarde), 85806)
  const deelTwee = totaleOppervlakte > 0
    ? (effectieveWoz / totaleOppervlakte) / (input.isCoropAmsterdamUtrechtKlein ? 114 : 268)
    : 0
  const wozRuw = quarter(effectieveWoz / 16954 + deelTwee)
  const ruwTotaal = basis + wozRuw
  const wozCapToegepast = ruwTotaal >= 187
  const wozDefinitief = wozCapToegepast
    ? Math.min(wozRuw, (0.33 / 0.67) * basis)
    : wozRuw

  let totaalPunten = Math.round(basis + wozDefinitief)
  if (wozCapToegepast && totaalPunten < 187) totaalPunten = 186
  if (totaalPunten < 40) totaalPunten = 40

  const tabelHuurprijs = interpolatedRent(totaalPunten)
  const opslag = opslagPercentage(input.opslagType, totaalPunten, input.bouwjaar)
  const huurprijsMetOpslag = Math.round(tabelHuurprijs * (1 + opslag) * 100) / 100
  const wettelijkeMaximumhuur = totaalPunten >= 187 ? null : huurprijsMetOpslag
  const huurSegment = totaalPunten <= 143
    ? 'Sociale huur (gereguleerd, max € 932,93)'
    : totaalPunten <= 186
      ? 'Middenhuur (gereguleerd, max € 1.228,07)'
      : 'Vrije sector (geen wettelijke maximale huurprijs)'

  return {
    punten: { vertrekken, overigeRuimten, verwarming, verkoeling, energie, keukenBasis, keukenExtra, keuken, sanitair, buitenruimte, basis, wozRuw, wozDefinitief },
    totaleOppervlakte,
    effectieveWoz,
    wozCapToegepast,
    ruwTotaal,
    totaalPunten,
    huurSegment,
    wettelijkeMaximumhuur,
    tabelHuurprijs,
    opslagPercentage: opslag,
    huurprijsMetOpslag,
  }
}
