import type { Herkomst, WwsoRegelset } from '../types'

/**
 * WWSO-regelset op basis van het Besluit huurprijzen woonruimte (BWBR0003237), bijlage I, onder B,
 * tekstversie geldend vanaf 01-01-2026 (geraadpleegd op wetten.overheid.nl, 13-11-2026).
 *
 * STATUS: de waarden zijn via een geautomatiseerde lezing van de wettekst overgenomen en daarom nog
 * 'ongeverifieerd'. Leg elke waarde naast de officiële tekst en zet dan per onderdeel status
 * 'geverifieerd' met gecontroleerdDoor/gecontroleerdOp.
 *
 * Onderdeel B verwijst voor veel details naar de toelichting bij onderdeel A ("van overeenkomstige
 * toepassing, tenzij hiervan wordt afgeweken"). Waarden die alleen in onderdeel A staan, zijn hieronder
 * expliciet als zodanig gemarkeerd: hun toepassing op onzelfstandige woonruimte is een afleiding.
 */

const BESLUIT = 'Besluit huurprijzen woonruimte (BWBR0003237), bijlage I'
const b = (rubriek: string, opmerking?: string): Herkomst => ({ status: 'ongeverifieerd', bron: `${BESLUIT}, onder B, ${rubriek} (tekstversie 01-01-2026)`, opmerking })
const viaA = (rubriek: string, opmerking: string): Herkomst => ({
  status: 'ongeverifieerd',
  bron: `${BESLUIT}, onder A, ${rubriek}; van overeenkomstige toepassing op onder B (toelichting B, inleiding)`,
  opmerking,
})

export const wwsoRegelset2026: WwsoRegelset = {
  id: 'wwso-bijlage-I-B-2026-01',
  naam: 'WWSO onzelfstandige woonruimte — bijlage I onder B, versie 1-1-2026 (niet geverifieerd)',
  geldigVanaf: '2026-01-01',
  geldigTot: null,
  bron: `${BESLUIT}, onder B, met toelichting (tekstversie geldend vanaf 01-01-2026).`,

  afrondingRubriek: { ...viaA('toelichting, inleiding', 'Per rubriek na saldering afronden op 0,25 punt, 1/8 punt naar boven. Bevestigd door het rekenvoorbeeld in toelichting B, rubriek 9.'), stap: 0.25 },
  afrondingTotaal: { ...viaA('slotopmerking', 'Totaal afronden op hele punten, 0,5 naar boven. Toelichting B bij de slotopmerking: "geen opmerking in aanvulling op onder A".'), methode: 'heel_punt' },

  r1: { ...b('rubriek 1', 'Gemeenschappelijk vertrek op hetzelfde adres: te delen door het aantal onzelfstandige woonruimten met toegang en gebruiksrecht. Eisen aan een vertrek (o.a. minimale afmetingen) worden niet door de rekenmotor gecontroleerd.'), puntenPerM2: 1 },
  r2: { ...b('rubriek 2', 'Gedeelde overige ruimte: zelfde deling als rubriek 1. Aftrek zolder zonder vaste trap (onder A) is niet opgenomen; gebruik zo nodig handmatige punten.'), puntenPerM2: 0.75 },
  r3: {
    ...b('rubriek 3', 'Gedeelde ruimten: punten te delen door het aantal onzelfstandige woonruimten. De maxima uit onder A (overige ruimten, koeling) zijn in onder B niet gevonden en worden niet toegepast.'),
    verwarmdVertrek: 2,
    verwarmdeOverigeRuimte: 1,
    gekoeldVertrek: 1,
  },
  r4: {
    ...b('rubriek 4.1 en 4.2', 'Punten per m² die volgens rubriek 1 aan de huurder zijn toe te rekenen; energielabel van de gehele woning (het adres). Monument: geen minpunten.'),
    perM2PerLabel: { 'A++++': 1, 'A+++': 0.95, 'A++': 0.85, 'A+': 0.75, A: 0.65, B: 0.5, C: 0.35, D: 0.2, E: -0.05, F: -0.1, G: -0.15 },
    bouwjaarNaarLabel: [
      { vanaf: 2002, label: 'A' },
      { vanaf: 2000, label: 'B' },
      { vanaf: 1992, label: 'C' },
      { vanaf: 1984, label: 'D' },
      { vanaf: 1979, label: 'E' },
      { vanaf: 1977, label: 'F' },
      { vanaf: 0, label: 'G' },
    ],
    geenMinpuntenBijMonument: true,
  },
  r5: b('rubriek 5', 'Punten van de keuken (5.1 aanrecht, 5.2 voorzieningen) te delen door het aantal onzelfstandige woonruimten met toegang en gebruiksrecht. De puntenwaarden per voorziening zijn nog niet in deze regelset opgenomen: de gebruiker voert de punten per keuken in.'),
  r6: b('rubriek 6', 'Zelfde deling als rubriek 5; een eigen voorziening wordt niet gedeeld. Puntenwaarden per voorziening nog niet opgenomen. Bij 8 of meer woonruimten op een adres vervalt het maximum voor wastafels voor maximaal één ruimte.'),
  r7: { status: 'niet_geconfigureerd', bron: `${BESLUIT}, onder B, rubriek 7`, opmerking: 'Waardering op basis van de kosten van de voorziening, te delen door het aantal gehandicapten met toegang. Alleen handmatig.' },
  r8: {
    ...b('rubriek 8', 'Gedeelde buitenruimte: 0,75 punt per m², te delen door het aantal woonruimten met toegang; bij meerdere adressen eerst door adressen, dan door woonruimten op het adres. Privé-buitenruimte, maximum en aftrek: onder A.'),
    privePuntenBijAanwezigheid: 2,
    privePuntenPerM2: 0.35,
    gedeeldPuntenPerM2: 0.75,
    maxPunten: 15,
    aftrekZonderBuitenruimte: -5,
  },
  r9: { ...b('rubriek 9', 'Per m², gedeeld door het aantal adressen met toegang en daarna door het aantal onzelfstandige woonruimten op dat adres.'), vertrekPerM2: 1, overigPerM2: 0.75 },
  r10: { ...viaA('rubriek 10 (punten per type parkeerplek)', 'Deling volgens onder B, rubriek 10: door het aantal adressen en daarna door het aantal woonruimten op het adres.'), typeI: 9, typeII: 6, typeIII: 4 },
  r11: {
    ...b('rubriek 11.1', 'WOZ-waarde van het adres per m² gebruiksoppervlakte, vergeleken met het gemiddelde in het COROP-gebied (gemiddelden: Uitvoeringsregeling huurprijzen woonruimte). Of het 33%-plafond en het minimum uit onder A ook voor onder B gelden, is in de tekst niet bevestigd; die worden niet toegepast.'),
    hoger: 14,
    gelijk: 12,
    lager: 10,
    marge: 0.1,
  },
  r12: { ...b('rubriek 12', 'Zorgwoning: 35% van de punten van rubriek 1 t/m 11. Laadpaal: 2 punten gedeeld door het aantal adressen met toegang.'), zorgwoningPercentage: 0.35, aanbelfunctie: 0.25, laadpaal: 2 },
  r13: { ...b('rubriek 13', 'Vier aftrekposten van elk 4 punten. "Totale oppervlakte van vertrekken onder rubriek 1" is geïnterpreteerd als de aan de huurder toegerekende m².'), kleinerDanM2: 8, aftrekKlein: -4, aftrekViaVerhuurder: -4, aftrekRuit: -4, aftrekKozijn: -4 },
  rijksmonumentToeslag: { status: 'ongeverifieerd', bron: 'Besluit huurprijzen woonruimte, artikel 8a, tweede lid', opmerking: 'Rijksmonument dat vóór de Wet betaalbare huur werd verhuurd: waardering onder B vermeerderd met 10 punten.', punten: 10 },
  huurtabel: {
    status: 'niet_geconfigureerd',
    bron: 'Uitvoeringsregeling huurprijzen woonruimte (BWBR0015386), bijlage met maximale huurprijsgrenzen voor onzelfstandige woonruimte',
    opmerking: 'Nog niet ingevoerd. Neem de tabel letterlijk over uit de geldende Uitvoeringsregeling.',
    punten: null,
  },
}
