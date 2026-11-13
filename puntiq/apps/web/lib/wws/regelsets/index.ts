import type { Regelset } from '../types'
import { regelsetPuntiq2026Overgenomen } from './puntiq-2026-overgenomen'

/**
 * Alle beschikbare regelsets. Een nieuwe (officiële) regelset toevoegen:
 *   1. Kopieer `legeRegelset()` naar een nieuw bestand in deze map, bijv. `wws-2027-07-01.ts`.
 *   2. Vul elke waarde in vanuit de officiële bron en zet per onderdeel status 'geverifieerd' met bronvermelding.
 *   3. Voeg de regelset hieronder toe en sluit de vorige af met `geldigTot`.
 * De rekenmotor hoeft daarvoor niet te veranderen.
 */
export const regelsets: Regelset[] = [regelsetPuntiq2026Overgenomen]

/** De regelset die op de peildatum (ISO yyyy-mm-dd) geldt, of null. */
export function kiesRegelset(peildatum: string, lijst: Regelset[] = regelsets): Regelset | null {
  return lijst
    .filter(set => set.geldigVanaf <= peildatum && (set.geldigTot === null || peildatum < set.geldigTot))
    .sort((a, b) => b.geldigVanaf.localeCompare(a.geldigVanaf))[0] ?? null
}

export function regelsetOpId(id: string) {
  return regelsets.find(set => set.id === id) ?? null
}

/** Sjabloon: een regelset waarin nog niets is ingevuld. Elke berekening is hiermee 'onvolledig'. */
export function legeRegelset(id: string, geldigVanaf: string): Regelset {
  const leeg = { status: 'niet_geconfigureerd' as const }
  return {
    id,
    naam: `WWS zelfstandig — ${geldigVanaf} (in te vullen)`,
    geldigVanaf,
    geldigTot: null,
    bron: '',
    rubrieken: {
      vertrekken: { ...leeg, puntenPerM2: null },
      overigeRuimten: { ...leeg, puntenPerM2: null },
      verwarming: { ...leeg, puntenPerVerwarmdVertrek: null, puntenPerVerwarmdeOverigeRuimte: null, maxPuntenOverigeRuimten: null, puntenPerGekoeldVertrek: null, maxPuntenKoeling: null },
      energie: { ...leeg, perLabel: null, zonderLabel: null, zonderLabelOnbekendBouwjaar: null },
      keuken: { ...leeg, aanrecht: null, voorzieningen: {}, extraMaxIsAanrechtPunten: null },
      sanitair: { ...leeg, voorzieningen: {} },
      buitenruimte: { ...leeg, puntenBijAanwezigheid: null, puntenPerM2Prive: null, maxPunten: null, puntenZonderBuitenruimte: null },
      woz: { ...leeg, minimumWaarde: null, delerWaarde: null, delerWaardePerM2: null, uitzonderingKleineWoning: null, plafond: null },
    },
    alleenHandmatig: [],
    totaal: { afronding: null, minimumPunten: null },
    huurtabel: { ...leeg, methode: 'exact', punten: null, minimumPunten: null, bedragPerPuntBoven: null },
    segmenten: { ...leeg, lijst: [] },
    opslagen: [],
  }
}
