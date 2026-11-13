/**
 * WWSO — waarderingsstelsel voor onzelfstandige woonruimte (kamers).
 *
 * Volledig gescheiden van de WWS-module (lib/wws): eigen invoer, regelset, motor en uitkomst.
 * Structuur volgt het Besluit huurprijzen woonruimte, bijlage I, onder B (rubrieken 1 t/m 13).
 * De rekenmotor bevat geen getallen uit de regelgeving; die staan in de regelset.
 */

export type Energielabel = 'A++++' | 'A+++' | 'A++' | 'A+' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
export const energielabels: Energielabel[] = ['A++++', 'A+++', 'A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G']

// =====================================================================
// Invoer — altijd vanuit één onzelfstandige woonruimte (de kamer die wordt gewaardeerd)
// =====================================================================

/** Ruimte die alleen door deze huurder wordt gebruikt. */
export type PriveRuimte = { id: string; naam: string; m2: number; verwarmd: boolean; gekoeld: boolean }

/** Ruimte op hetzelfde adres die met andere onzelfstandige woonruimten wordt gedeeld (bijv. keuken-woonkamer, gang). */
export type GedeeldeRuimte = PriveRuimte & {
  soort: 'vertrek' | 'overig'
  /** Aantal onzelfstandige woonruimten (inclusief deze) met toegang en gebruiksrecht. */
  gedeeldDoor: number
}

/** Keuken of sanitaire ruimte. `gedeeldDoor` = 1 bij een eigen voorziening. */
export type Voorziening = {
  id: string
  naam: string
  /** Punten van de voorziening als geheel, vóór deling (bijv. aanrecht + extra voorzieningen). */
  punten: number
  gedeeldDoor: number
}

/** Ruimte die gemeenschappelijk is voor meerdere adressen (bijv. recreatieruimte in een complex). */
export type ComplexRuimte = { id: string; naam: string; soort: 'vertrek' | 'overig'; m2: number; adressen: number }

export type HandmatigePunten = { punten: number; toelichting: string }

export type WwsoInvoer = {
  peildatum: string
  adres: {
    /** Totaal aantal onzelfstandige woonruimten op het adres (voor deling van gemeenschappelijke voorzieningen tussen adressen). */
    aantalWoonruimten: number
    bouwjaar: number | null
    /** Energielabel van de gehele woning (het adres). */
    energielabel: Energielabel | null
    /** Beschermd monument: geen minpunten voor energieprestatie. */
    monument: boolean
    /** Rijksmonument dat al vóór de Wet betaalbare huur werd verhuurd (puntentoeslag). */
    rijksmonumentVoorWbh: boolean
  }
  priveVertrekken: PriveRuimte[]
  priveOverigeRuimten: PriveRuimte[]
  gedeeldeRuimten: GedeeldeRuimte[]
  keukens: Voorziening[]
  sanitair: Voorziening[]
  buitenruimte: {
    priveM2: number
    gedeeldOpAdresM2: number
    gedeeldOpAdresDoor: number
    complexM2: number
    complexAdressen: number
  }
  complexRuimten: ComplexRuimte[]
  parkeren: {
    /** Aantal parkeerplekken per type, en het aantal adressen dat ze deelt. */
    typeI: number
    typeII: number
    typeIII: number
    adressen: number
    laadpalen: number
    laadpaalAdressen: number
  }
  woz: {
    /** WOZ-waarde van het adres waar de woonruimte onderdeel van is. */
    waardeAdres: number | null
    /** Gebruiksoppervlakte van de gehele woning (het adres), volgens het WOZ-waardeloket. */
    gebruiksoppervlakteAdres: number | null
    /** Gemiddelde WOZ-waarde per m² in het COROP-gebied, uit de Uitvoeringsregeling huurprijzen woonruimte. */
    coropGemiddeldePerM2: number | null
    coropGebied: string
  }
  bijzonder: { zorgwoning: boolean; aanbelfunctie: boolean }
  aftrek: {
    alleenViaVertrekVerhuurder: boolean
    ruitOppervlakteKleiner: boolean
    kozijnTeHoog: boolean
  }
  handmatig: Partial<Record<RubriekId, HandmatigePunten>>
}

// =====================================================================
// Regelset
// =====================================================================

export type RubriekId =
  | 'r1_vertrekken'
  | 'r2_overigeRuimten'
  | 'r3_verwarming'
  | 'r4_energie'
  | 'r5_keuken'
  | 'r6_sanitair'
  | 'r7_gehandicapten'
  | 'r8_buitenruimten'
  | 'r9_gemeenschappelijk'
  | 'r10_parkeren'
  | 'r11_woz'
  | 'r12_bijzonder'
  | 'r13_aftrek'

export type RegelStatus = 'geverifieerd' | 'ongeverifieerd' | 'niet_geconfigureerd'

export type Herkomst = {
  status: RegelStatus
  /** Vindplaats, bijv. "Besluit huurprijzen woonruimte, bijlage I, onder B, rubriek 1". */
  bron?: string
  gecontroleerdDoor?: string
  gecontroleerdOp?: string
  opmerking?: string
}

type N = number | null

export type WwsoRegelset = {
  id: string
  naam: string
  geldigVanaf: string
  geldigTot: string | null
  bron: string
  /** Afronding per rubriek (bijv. 0,25 met 1/8 naar boven). */
  afrondingRubriek: Herkomst & { stap: N }
  afrondingTotaal: Herkomst & { methode: 'heel_punt' | null }
  r1: Herkomst & { puntenPerM2: N }
  r2: Herkomst & { puntenPerM2: N }
  r3: Herkomst & { verwarmdVertrek: N; verwarmdeOverigeRuimte: N; gekoeldVertrek: N }
  r4: Herkomst & {
    /** Punten per m² (toegerekend volgens rubriek 1) per energielabel van het adres. */
    perM2PerLabel: Partial<Record<Energielabel, number>> | null
    /** Zonder label: label-equivalent op basis van bouwjaar (eerste rij met bouwjaar >= vanaf). */
    bouwjaarNaarLabel: { vanaf: number; label: Energielabel }[] | null
    geenMinpuntenBijMonument: boolean | null
  }
  r5: Herkomst
  r6: Herkomst
  r7: Herkomst
  r8: Herkomst & {
    privePuntenBijAanwezigheid: N
    privePuntenPerM2: N
    gedeeldPuntenPerM2: N
    maxPunten: N
    aftrekZonderBuitenruimte: N
  }
  r9: Herkomst & { vertrekPerM2: N; overigPerM2: N }
  r10: Herkomst & { typeI: N; typeII: N; typeIII: N }
  r11: Herkomst & {
    /** Punten op basis van de WOZ per m² t.o.v. het COROP-gemiddelde. */
    hoger: N
    gelijk: N
    lager: N
    /** Bandbreedte als fractie (0,10 = 10%). */
    marge: N
  }
  r12: Herkomst & { zorgwoningPercentage: N; aanbelfunctie: N; laadpaal: N }
  r13: Herkomst & { kleinerDanM2: N; aftrekKlein: N; aftrekViaVerhuurder: N; aftrekRuit: N; aftrekKozijn: N }
  rijksmonumentToeslag: Herkomst & { punten: N }
  huurtabel: Herkomst & { punten: [number, number][] | null }
}

// =====================================================================
// Uitkomst
// =====================================================================

export type RubriekUitkomst = {
  id: RubriekId
  nummer: number
  naam: string
  punten: number | null
  bron: 'berekend' | 'handmatig' | 'ontbreekt'
  status: RegelStatus
  stappen: string[]
  waarschuwingen: string[]
}

export type Betrouwbaarheid = 'officieel' | 'indicatief' | 'onvolledig'

export type WwsoUitkomst = {
  regelset: { id: string; naam: string }
  rubrieken: RubriekUitkomst[]
  /** m² vertrekken toegerekend aan de huurder (privé + aandeel gedeeld), basis voor rubriek 4 en 13. */
  toegerekendeM2Vertrekken: number
  toeslagen: { naam: string; punten: number }[]
  totaalPunten: number | null
  maximaleHuur: number | null
  betrouwbaarheid: Betrouwbaarheid
  redenen: string[]
}
