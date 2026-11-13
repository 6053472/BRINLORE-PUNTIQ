import type { Herkomst, Regelset } from '../types'

/**
 * Regelset met de waarden die vóór de herbouw van de WWS-module hardgecodeerd in lib/wws.ts stonden
 * (commits ecd4ba9 "Design & Formule" en 6f1bc93 "WWS"). Ze zijn één-op-één overgenomen, niet aangevuld
 * en NIET gecontroleerd tegen de officiële bron. Uitkomsten zijn daarom altijd 'indicatief'.
 *
 * Verifiëren: vergelijk elke waarde met de officiële bron (Besluit huurprijzen woonruimte, bijlage I, en
 * het beleidsboek WWS zelfstandige woonruimte van de Huurcommissie, geldend op de peildatum), corrigeer
 * waar nodig, en zet per onderdeel `status: 'geverifieerd'` met `bron`, `gecontroleerdDoor` en `gecontroleerdOp`.
 */

const BRON_TE_CONTROLEREN = 'Te controleren tegen: Besluit huurprijzen woonruimte, bijlage I (zelfstandige woonruimte), en het WWS-beleidsboek van de Huurcommissie.'

const overgenomen: Herkomst = {
  status: 'ongeverifieerd',
  bron: BRON_TE_CONTROLEREN,
  opmerking: 'Overgenomen uit de eerdere PUNTIQ-berekening; herkomst van de waarden onbekend.',
}

const kwart = { stap: 0.25 }

export const regelsetPuntiq2026Overgenomen: Regelset = {
  id: 'puntiq-2026-overgenomen',
  naam: 'WWS zelfstandig — 2026 (overgenomen, niet geverifieerd)',
  geldigVanaf: '2026-01-01',
  geldigTot: null,
  bron: BRON_TE_CONTROLEREN,
  rubrieken: {
    vertrekken: { ...overgenomen, afronding: kwart, puntenPerM2: 1 },
    overigeRuimten: { ...overgenomen, afronding: kwart, puntenPerM2: 0.75 },
    verwarming: {
      ...overgenomen,
      afronding: kwart,
      puntenPerVerwarmdVertrek: 2,
      puntenPerVerwarmdeOverigeRuimte: 1,
      maxPuntenOverigeRuimten: 4,
      puntenPerGekoeldVertrek: 1,
      maxPuntenKoeling: 2,
    },
    energie: {
      ...overgenomen,
      afronding: kwart,
      perLabel: {
        'A++++': { eengezins: 62, meergezins: 58 },
        'A+++': { eengezins: 57, meergezins: 53 },
        'A++': { eengezins: 52, meergezins: 48 },
        'A+': { eengezins: 47, meergezins: 43 },
        A: { eengezins: 41, meergezins: 37 },
        B: { eengezins: 34, meergezins: 30 },
        C: { eengezins: 22, meergezins: 15 },
        D: { eengezins: 14, meergezins: 11 },
        E: { eengezins: -4, meergezins: -4 },
        F: { eengezins: -9, meergezins: -9 },
        G: { eengezins: -15, meergezins: -15 },
      },
      zonderLabel: [
        { vanafBouwjaar: 2002, punten: { eengezins: 36, meergezins: 32 } },
        { vanafBouwjaar: 1992, punten: { eengezins: 24, meergezins: 20 } },
        { vanafBouwjaar: 1977, punten: { eengezins: 12, meergezins: 8 } },
        { vanafBouwjaar: 0, punten: { eengezins: -15, meergezins: -15 } },
      ],
      zonderLabelOnbekendBouwjaar: -15,
    },
    keuken: {
      ...overgenomen,
      afronding: kwart,
      aanrecht: [
        { vanafMeters: 2, punten: 7 },
        { vanafMeters: 1, punten: 4 },
      ],
      // De eerdere berekening kende geen catalogus van keukenvoorzieningen: extra punten werden handmatig ingevoerd.
      voorzieningen: {},
      extraMaxIsAanrechtPunten: true,
    },
    sanitair: {
      // De eerdere berekening liet de gebruiker de sanitairpunten zelf invullen; er is geen regel om over te nemen.
      status: 'niet_geconfigureerd',
      bron: BRON_TE_CONTROLEREN,
      voorzieningen: {},
    },
    buitenruimte: {
      ...overgenomen,
      afronding: kwart,
      puntenBijAanwezigheid: 2,
      puntenPerM2Prive: 0.35,
      maxPunten: 15,
      puntenZonderBuitenruimte: -5,
    },
    woz: {
      ...overgenomen,
      afronding: kwart,
      minimumWaarde: 85806,
      delerWaarde: 16954,
      delerWaardePerM2: 268,
      uitzonderingKleineWoning: { regioKenmerk: 'corop_amsterdam_utrecht', onderM2: 40, delerWaardePerM2: 114 },
      plafond: { vanafTotaal: 187, maxAandeel: 0.33, minimumTotaalNaPlafond: 186 },
    },
  },
  alleenHandmatig: [
    { id: 'gehandicaptenvoorzieningen', naam: 'Voorzieningen voor gehandicapten', herkomst: { status: 'niet_geconfigureerd', bron: BRON_TE_CONTROLEREN } },
    { id: 'gemeenschappelijk', naam: 'Gemeenschappelijke ruimten en parkeren', herkomst: { status: 'niet_geconfigureerd', bron: BRON_TE_CONTROLEREN } },
    { id: 'bijzondereVoorzieningen', naam: 'Bijzondere voorzieningen', herkomst: { status: 'niet_geconfigureerd', bron: BRON_TE_CONTROLEREN } },
  ],
  totaal: { afronding: 'heel_punt', minimumPunten: 40 },
  huurtabel: {
    ...overgenomen,
    // De eerdere berekening kende alleen deze ankerpunten en interpoleerde ertussen. De officiële tabel kent een bedrag per punt.
    methode: 'ankers_interpolatie',
    punten: [
      [40, 250.26],
      [100, 637.67],
      [143, 932.93],
      [144, 939.73],
      [186, 1228.07],
      [187, 1234.92],
      [250, 1667.4],
    ],
    minimumPunten: 40,
    bedragPerPuntBoven: 6.86,
  },
  segmenten: {
    ...overgenomen,
    lijst: [
      { id: 'sociaal', naam: 'Sociale huur', totEnMetPunten: 143, gereguleerd: true },
      { id: 'midden', naam: 'Middenhuur', totEnMetPunten: 186, gereguleerd: true },
      { id: 'vrij', naam: 'Vrije sector', totEnMetPunten: null, gereguleerd: false },
    ],
  },
  opslagen: [
    { ...overgenomen, id: 'nieuwbouw_middenhuur', naam: 'Nieuwbouw middenhuur', percentage: 0.1, minPunten: 144, maxPunten: 186 },
    { ...overgenomen, id: 'rijksmonument', naam: 'Rijksmonument', percentage: 0.35 },
    { ...overgenomen, id: 'gemeentelijk_monument', naam: 'Gemeentelijk monument', percentage: 0.15 },
    { ...overgenomen, id: 'beschermd_stadsgezicht', naam: 'Beschermd stads- of dorpsgezicht', percentage: 0.05, bouwjaarVoor: 1965 },
  ],
}
