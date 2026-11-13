export * from './types'
export { berekenWwso, controleerWwsoRegelset } from './engine'

import type { WwsoInvoer, WwsoRegelset } from './types'
import { wwsoRegelset2026 } from './regelsets/bijlage-I-B-2026'

/** Alle WWSO-regelsets. Voeg een nieuwe versie toe en sluit de vorige af met `geldigTot`. */
export const wwsoRegelsets: WwsoRegelset[] = [wwsoRegelset2026]

export function kiesWwsoRegelset(peildatum: string, lijst: WwsoRegelset[] = wwsoRegelsets) {
  return lijst
    .filter(set => set.geldigVanaf <= peildatum && (set.geldigTot === null || peildatum < set.geldigTot))
    .sort((a, b) => b.geldigVanaf.localeCompare(a.geldigVanaf))[0] ?? null
}

let teller = 0
export const nieuwId = () => `w${Date.now().toString(36)}${(teller += 1)}`

export function legeWwsoInvoer(peildatum: string): WwsoInvoer {
  return {
    peildatum,
    adres: { aantalWoonruimten: 4, bouwjaar: null, energielabel: null, monument: false, rijksmonumentVoorWbh: false },
    priveVertrekken: [{ id: nieuwId(), naam: 'Kamer', m2: 0, verwarmd: true, gekoeld: false }],
    priveOverigeRuimten: [],
    gedeeldeRuimten: [],
    keukens: [],
    sanitair: [],
    buitenruimte: { priveM2: 0, gedeeldOpAdresM2: 0, gedeeldOpAdresDoor: 4, complexM2: 0, complexAdressen: 1 },
    complexRuimten: [],
    parkeren: { typeI: 0, typeII: 0, typeIII: 0, adressen: 1, laadpalen: 0, laadpaalAdressen: 1 },
    woz: { waardeAdres: null, gebruiksoppervlakteAdres: null, coropGemiddeldePerM2: null, coropGebied: '' },
    bijzonder: { zorgwoning: false, aanbelfunctie: false },
    aftrek: { alleenViaVertrekVerhuurder: false, ruitOppervlakteKleiner: false, kozijnTeHoog: false },
    handmatig: {},
  }
}
