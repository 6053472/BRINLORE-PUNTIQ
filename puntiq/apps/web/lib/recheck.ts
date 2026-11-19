import { berekenWws, kiesRegelset, legeInvoer, regelsetOpId, type WwsInvoer } from './wws'
import { berekenWwso, kiesWwsoRegelset, legeWwsoInvoer, wwsoRegelsets, type WwsoInvoer } from './wwso'
import type { WwsCalculation, WwsoCalculation } from './types'

/**
 * Controle van opgeslagen berekeningen. Elke berekening bewaart haar invoer en de regelset waarmee ze is
 * gemaakt; hier wordt ze opnieuw doorgerekend zodat afwijkingen (door een gecorrigeerde regelset of een
 * rekenfout) en verouderde regelsets zichtbaar worden.
 */
export type ControleStatus = 'ongewijzigd' | 'afwijkend' | 'nieuwe_regelset' | 'geen_invoer' | 'regelset_onbekend'

export type Controle = {
  status: ControleStatus
  /** Opnieuw berekend met de regelset waarmee de berekening is opgeslagen. */
  punten: number | null
  huur: number | null
  /** Regelset die vandaag voor deze peildatum zou gelden, als die afwijkt van de opgeslagen regelset. */
  nieuweRegelset?: { id: string; naam: string; punten: number | null; huur: number | null }
}

export const controleLabel: Record<ControleStatus, string> = {
  ongewijzigd: 'Klopt',
  afwijkend: 'Afwijkend',
  nieuwe_regelset: 'Nieuwere regelset',
  geen_invoer: 'Geen invoer bewaard',
  regelset_onbekend: 'Regelset onbekend',
}

const sameNumber = (a: number | null | undefined, b: number | null | undefined) => (a ?? null) === null || (b ?? null) === null ? (a ?? null) === (b ?? null) : Math.abs((a as number) - (b as number)) < 0.01

function parse<T>(json: string | undefined, basis: T): T | null {
  if (!json) return null
  try {
    return { ...basis, ...(JSON.parse(json) as T) }
  } catch {
    return null
  }
}

function conclude(record: { points?: number; rent?: number }, punten: number | null, huur: number | null, nieuwe?: Controle['nieuweRegelset']): Controle {
  const gelijk = sameNumber(record.points, punten) && sameNumber(record.rent, huur)
  return { status: !gelijk ? 'afwijkend' : nieuwe ? 'nieuwe_regelset' : 'ongewijzigd', punten, huur, nieuweRegelset: nieuwe }
}

/** Een bewaarde invoer uit een ouder schema mag de controle niet laten crashen: dat telt als "geen bruikbare invoer". */
const veilig = (berekening: () => Controle): Controle => {
  try {
    return berekening()
  } catch {
    return { status: 'geen_invoer', punten: null, huur: null }
  }
}

export const controleerWwsBerekening = (record: WwsCalculation): Controle => veilig(() => wwsControle(record))
export const controleerWwsoBerekening = (record: WwsoCalculation): Controle => veilig(() => wwsoControle(record))

function wwsControle(record: WwsCalculation): Controle {
  const invoer = parse<WwsInvoer>(record.invoer, legeInvoer(record.date ?? ''))
  if (!invoer) return { status: 'geen_invoer', punten: null, huur: null }
  const opgeslagen = record.regelset ? regelsetOpId(record.regelset) : kiesRegelset(invoer.peildatum)
  if (!opgeslagen) return { status: 'regelset_onbekend', punten: null, huur: null }
  const uitkomst = berekenWws(invoer, opgeslagen)
  const actueel = kiesRegelset(invoer.peildatum)
  let nieuwe: Controle['nieuweRegelset']
  if (actueel && actueel.id !== opgeslagen.id) {
    const nu = berekenWws(invoer, actueel)
    nieuwe = { id: actueel.id, naam: actueel.naam, punten: nu.totaalPunten, huur: nu.maximaleHuur }
  }
  return conclude(record, uitkomst.totaalPunten, uitkomst.maximaleHuur, nieuwe)
}

function wwsoControle(record: WwsoCalculation): Controle {
  const invoer = parse<WwsoInvoer>(record.invoer, legeWwsoInvoer(record.date ?? ''))
  if (!invoer) return { status: 'geen_invoer', punten: null, huur: null }
  const opgeslagen = record.regelset ? wwsoRegelsets.find(set => set.id === record.regelset) : kiesWwsoRegelset(invoer.peildatum)
  if (!opgeslagen) return { status: 'regelset_onbekend', punten: null, huur: null }
  const uitkomst = berekenWwso(invoer, opgeslagen)
  const actueel = kiesWwsoRegelset(invoer.peildatum)
  let nieuwe: Controle['nieuweRegelset']
  if (actueel && actueel.id !== opgeslagen.id) {
    const nu = berekenWwso(invoer, actueel)
    nieuwe = { id: actueel.id, naam: actueel.naam, punten: nu.totaalPunten, huur: nu.maximaleHuur }
  }
  return conclude(record, uitkomst.totaalPunten, uitkomst.maximaleHuur, nieuwe)
}
