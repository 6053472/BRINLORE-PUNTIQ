/**
 * WWS (woningwaarderingsstelsel) voor zelfstandige woonruimte — types.
 *
 * De rekenmotor (engine.ts) bevat géén getallen uit de regelgeving. Alle punten, grenzen, delers en
 * huurbedragen komen uit een `Regelset`. Zo kan de officiële regelgeving per peildatum worden ingevoerd
 * en gecontroleerd, zonder de motor te wijzigen.
 */

// =====================================================================
// Invoer
// =====================================================================

export type Energielabel = 'A++++' | 'A+++' | 'A++' | 'A+' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
export const energielabels: Energielabel[] = ['A++++', 'A+++', 'A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G']

export type WoningType = 'eengezins' | 'meergezins'

/** Een vertrek (woonkamer, slaapkamer…) of overige ruimte (zolder, berging…). */
export type Ruimte = {
  id: string
  naam: string
  /** Gebruiksoppervlakte in m². */
  m2: number
  verwarmd: boolean
  gekoeld: boolean
}

/** Handmatig vastgestelde punten voor een rubriek, bijv. uit de Huurprijscheck van de Huurcommissie. */
export type HandmatigePunten = { punten: number; toelichting: string }

export type WwsInvoer = {
  /** Bepaalt welke regelset geldt (ISO-datum). */
  peildatum: string
  woningType: WoningType
  bouwjaar: number | null
  vertrekken: Ruimte[]
  overigeRuimten: Ruimte[]
  energielabel: Energielabel | null
  keuken: {
    aanrechtLengteMeters: number
    /** Per voorziening (sleutel uit de regelset-catalogus) het aantal. */
    voorzieningen: Record<string, number>
    /** Zelf vastgestelde punten voor extra voorzieningen, zolang de catalogus niet is ingevuld. */
    extraPuntenHandmatig: number
  }
  sanitair: {
    voorzieningen: Record<string, number>
  }
  buitenruimte: {
    /** Privé-buitenruimte (tuin, balkon, dakterras) in m². Gedeelde buitenruimte: via handmatige punten. */
    priveM2: number
  }
  woz: {
    waarde: number | null
    /** Gemeente/regio-kenmerk dat in sommige regelsets een andere deler oplevert. */
    regioKenmerken: string[]
  }
  /** Sleutels van van toepassing zijnde opslagen (bijv. monumentstatus). */
  opslagen: string[]
  handmatig: Partial<Record<RubriekId, HandmatigePunten>>
}

// =====================================================================
// Regelset
// =====================================================================

export type RubriekId =
  | 'vertrekken'
  | 'overigeRuimten'
  | 'verwarming'
  | 'energie'
  | 'keuken'
  | 'sanitair'
  | 'gehandicaptenvoorzieningen'
  | 'buitenruimte'
  | 'woz'
  | 'gemeenschappelijk'
  | 'bijzondereVoorzieningen'

/**
 * - geverifieerd: waarden zijn gecontroleerd tegen de genoemde officiële bron.
 * - ongeverifieerd: waarden zijn ingevuld maar (nog) niet gecontroleerd; uitkomst is indicatief.
 * - niet_geconfigureerd: geen rekenregel; alleen handmatige punten mogelijk.
 */
export type RegelStatus = 'geverifieerd' | 'ongeverifieerd' | 'niet_geconfigureerd'

export type Herkomst = {
  status: RegelStatus
  /** Vindplaats, bijv. "Besluit huurprijzen woonruimte, bijlage I, rubriek 1". */
  bron?: string
  /** Wie en wanneer gecontroleerd (alleen bij 'geverifieerd'). */
  gecontroleerdDoor?: string
  gecontroleerdOp?: string
  opmerking?: string
  /** Afronding van de rubriekpunten op een veelvoud van `stap` (bijv. 0,25). Weglaten = niet afronden. */
  afronding?: Afronding
}

export type Afronding = { stap: number }

/** Punten = oppervlakte × factor, afgerond. */
export type OppervlakteRegel = Herkomst & { puntenPerM2: number | null }

export type VerwarmingRegel = Herkomst & {
  puntenPerVerwarmdVertrek: number | null
  puntenPerVerwarmdeOverigeRuimte: number | null
  maxPuntenOverigeRuimten: number | null
  puntenPerGekoeldVertrek: number | null
  maxPuntenKoeling: number | null
}

export type EnergieRegel = Herkomst & {
  /** Punten per label, per woningtype. */
  perLabel: Partial<Record<Energielabel, Record<WoningType, number>>> | null
  /** Zonder geldig label: punten op basis van bouwjaar. Eerste regel waarvoor bouwjaar >= vanaf geldt. */
  zonderLabel: { vanafBouwjaar: number; punten: Record<WoningType, number> }[] | null
  zonderLabelOnbekendBouwjaar: number | null
}

export type CatalogusItem = { naam: string; punten: number | null; eenheid?: string }

export type KeukenRegel = Herkomst & {
  /** Punten bij een aanrechtlengte van ten minste `vanafMeters`. Eerste passende (aflopend gesorteerd) telt. */
  aanrecht: { vanafMeters: number; punten: number }[] | null
  voorzieningen: Record<string, CatalogusItem>
  /** Extra voorzieningen mogen niet meer opleveren dan de aanrechtpunten (indien true). */
  extraMaxIsAanrechtPunten: boolean | null
}

export type SanitairRegel = Herkomst & { voorzieningen: Record<string, CatalogusItem> }

export type BuitenruimteRegel = Herkomst & {
  puntenBijAanwezigheid: number | null
  puntenPerM2Prive: number | null
  maxPunten: number | null
  puntenZonderBuitenruimte: number | null
}

export type WozRegel = Herkomst & {
  minimumWaarde: number | null
  /** Deel 1: WOZ-waarde / deler. */
  delerWaarde: number | null
  /** Deel 2: (WOZ-waarde / m²) / deler. */
  delerWaardePerM2: number | null
  /** Afwijkende deler voor deel 2 als de woning een regiokenmerk heeft én kleiner is dan `onderM2`. null = geen uitzondering. */
  uitzonderingKleineWoning: { regioKenmerk: string; onderM2: number; delerWaardePerM2: number } | null
  /** Maximale aandeel WOZ-punten vanaf een puntentotaal. null = geen plafond. */
  plafond: { vanafTotaal: number; maxAandeel: number; minimumTotaalNaPlafond?: number } | null
}

/** Huurprijstabel. Exact: elke punt heeft een bedrag. Ankers: lineaire interpolatie (een benadering!). */
export type HuurTabel = Herkomst & {
  methode: 'exact' | 'ankers_interpolatie'
  punten: [punten: number, bedrag: number][] | null
  minimumPunten: number | null
  /** Bedrag per punt boven het hoogste tabelpunt. */
  bedragPerPuntBoven: number | null
}

export type Segment = { id: string; naam: string; totEnMetPunten: number | null; gereguleerd: boolean }

export type Opslag = Herkomst & {
  id: string
  naam: string
  percentage: number | null
  /** Optionele voorwaarden; ontbrekende voorwaarde = altijd van toepassing. */
  minPunten?: number
  maxPunten?: number
  bouwjaarVoor?: number
}

export type Regelset = {
  id: string
  naam: string
  /** Inclusief. */
  geldigVanaf: string
  /** Exclusief; null = tot nader order. */
  geldigTot: string | null
  /** Algemene bronvermelding van de regelset. */
  bron: string
  /** Lijst van rubrieken die meetellen; rubrieken buiten de rekenregels kunnen alleen handmatig. */
  rubrieken: {
    vertrekken: OppervlakteRegel
    overigeRuimten: OppervlakteRegel
    verwarming: VerwarmingRegel
    energie: EnergieRegel
    keuken: KeukenRegel
    sanitair: SanitairRegel
    buitenruimte: BuitenruimteRegel
    woz: WozRegel
  }
  /** Rubrieken zonder automatische regel (bijv. gehandicaptenvoorzieningen): alleen handmatig. */
  alleenHandmatig: { id: RubriekId; naam: string; herkomst: Herkomst }[]
  totaal: { afronding: 'heel_punt' | null; minimumPunten: number | null }
  huurtabel: HuurTabel
  segmenten: Herkomst & { lijst: Segment[] }
  opslagen: Opslag[]
}

// =====================================================================
// Uitkomst
// =====================================================================

export type RubriekUitkomst = {
  id: RubriekId
  naam: string
  /** null = kon niet worden berekend. */
  punten: number | null
  bron: 'berekend' | 'handmatig' | 'ontbreekt'
  status: RegelStatus
  /** Uitleg per rekenstap, voor controle door de gebruiker. */
  stappen: string[]
  waarschuwingen: string[]
}

/**
 * - officieel: alle gebruikte regels zijn geverifieerd en de berekening is volledig.
 * - indicatief: volledig, maar (een deel van) de regels is niet geverifieerd of benaderd.
 * - onvolledig: niet alle rubrieken konden worden bepaald; geen totaal of maximale huur.
 */
export type Betrouwbaarheid = 'officieel' | 'indicatief' | 'onvolledig'

export type WwsUitkomst = {
  regelset: { id: string; naam: string; geldigVanaf: string; geldigTot: string | null }
  rubrieken: RubriekUitkomst[]
  totaleOppervlakte: number
  puntenZonderWoz: number | null
  totaalPunten: number | null
  segment: Segment | null
  tabelHuur: number | null
  opslagen: { id: string; naam: string; percentage: number }[]
  maximaleHuur: number | null
  betrouwbaarheid: Betrouwbaarheid
  /** Redenen waarom de uitkomst niet 'officieel' is. */
  redenen: string[]
}
