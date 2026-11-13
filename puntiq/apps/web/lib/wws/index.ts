export * from './types'
export { berekenWws, controleerRegelset } from './engine'
export { kiesRegelset, legeRegelset, regelsetOpId, regelsets } from './regelsets'

import type { Ruimte, WwsInvoer } from './types'

let teller = 0
export function nieuweRuimte(naam: string, m2 = 0, verwarmd = true): Ruimte {
  teller += 1
  return { id: `r${Date.now().toString(36)}${teller}`, naam, m2, verwarmd, gekoeld: false }
}

export function legeInvoer(peildatum: string): WwsInvoer {
  return {
    peildatum,
    woningType: 'meergezins',
    bouwjaar: null,
    vertrekken: [nieuweRuimte('Woonkamer'), nieuweRuimte('Slaapkamer')],
    overigeRuimten: [],
    energielabel: null,
    keuken: { aanrechtLengteMeters: 0, voorzieningen: {}, extraPuntenHandmatig: 0 },
    sanitair: { voorzieningen: {} },
    buitenruimte: { priveM2: 0 },
    woz: { waarde: null, regioKenmerken: [] },
    opslagen: [],
    handmatig: {},
  }
}

export const betrouwbaarheidLabel = {
  officieel: 'Officieel',
  indicatief: 'Indicatief',
  onvolledig: 'Onvolledig',
} as const
