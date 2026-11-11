'use client'

import { useState } from 'react'
import { useApp } from './AppProvider'
import { Icon } from './icons'
import { EmptyState, Modal, PageHead, PanelHeading, Stat } from './ui'
import { berekenWWS, type Energielabel, type OpslagType, type WoningType, type WwsInput } from '../lib/wws'
import { formatDate, money, today } from '../lib/format'

export function WwsModal({ onClose }: { onClose: () => void }) {
  const { properties, saveRecord, saveProperty, notify } = useApp()
  const [input, setInput] = useState<WwsInput>({
    m2Vertrekken: 52, m2OverigeRuimten: 10, verwarmdeVertrekken: 3,
    verwarmdeOverigeRuimten: 1, gekoeldeVertrekken: 0, energielabel: 'A',
    bouwjaar: 2005, woningType: 'meergezins', aanrechtLengteMeters: 2,
    keukenExtraPunten: 4, sanitairPunten: 7, m2BuitenruimtePrive: 8,
    wozWaarde: 350000, isCoropAmsterdamUtrechtKlein: false, opslagType: 'geen',
  })
  const [propertyId, setPropertyId] = useState('')
  const [label, setLabel] = useState('')
  const [applyToProperty, setApplyToProperty] = useState(true)
  const [busy, setBusy] = useState(false)
  const result = berekenWWS(input)
  const maxRent = result.wettelijkeMaximumhuur ?? result.huurprijsMetOpslag
  const selected = properties.find(property => String(property.id) === propertyId)

  const setNumber = (name: keyof WwsInput, value: string) => setInput(current => ({ ...current, [name]: value === '' ? 0 : Math.max(0, Number(value)) }))
  const num = (name: keyof WwsInput, step = '1') => (
    <input type="number" min="0" step={step} value={(input[name] as number) || ''} onChange={event => setNumber(name, event.target.value)} />
  )

  const save = async () => {
    setBusy(true)
    const name = selected?.name ?? label.trim()
    if (!name) {
      notify('Kies een woning of geef de berekening een naam.', 'error')
      setBusy(false)
      return
    }
    const saved = await saveRecord('wws', {
      label: name,
      property: selected?.name ?? '',
      date: today(),
      points: result.totaalPunten,
      rent: maxRent,
      segment: result.huurSegment,
    })
    if (!saved) return setBusy(false)
    if (selected && applyToProperty) await saveProperty({ ...selected, points: result.totaalPunten, rent: result.wettelijkeMaximumhuur ?? selected.rent }, selected.id)
    notify(selected && applyToProperty ? 'Berekening opgeslagen en toegepast op de woning' : 'WWS-berekening opgeslagen')
    onClose()
  }

  return (
    <Modal
      wide
      eyebrow="WWS / WWSO"
      title="Woningwaardering berekenen"
      subtitle="Prijspeil 1 januari 2026. Indicatief totdat alle WWS-rubrieken en bewijsstukken zijn gecontroleerd."
      onClose={onClose}
      actions={
        <>
          <button type="button" className="button ghost" onClick={onClose}>Annuleren</button>
          <button type="button" className="button" disabled={busy} onClick={save}>Berekening opslaan</button>
        </>
      }
    >
      <div className="form-grid">
        <label>Woning (optioneel)
          <select value={propertyId} onChange={event => setPropertyId(event.target.value)}>
            <option value="">— Los object —</option>
            {properties.map(property => <option key={property.id} value={property.id}>{property.name}</option>)}
          </select>
        </label>
        <label>Naam berekening
          <input value={selected?.name ?? label} disabled={Boolean(selected)} onChange={event => setLabel(event.target.value)} placeholder="bijv. Singel 229" />
        </label>
        <label>Woningtype
          <select value={input.woningType} onChange={event => setInput(current => ({ ...current, woningType: event.target.value as WoningType }))}>
            <option value="meergezins">Appartement / meergezinswoning</option>
            <option value="eengezins">Eengezinswoning</option>
          </select>
        </label>
        <label>Vertrekken (m²){num('m2Vertrekken')}</label>
        <label>Overige ruimten (m²){num('m2OverigeRuimten', '0.25')}</label>
        <label>WOZ-waarde (€){num('wozWaarde', '1000')}</label>
        <label>Energielabel
          <select value={input.energielabel} onChange={event => setInput(current => ({ ...current, energielabel: event.target.value as Energielabel }))}>
            {['A++++', 'A+++', 'A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'GEEN'].map(value => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label>Bouwjaar{num('bouwjaar')}</label>
        <label>Verwarmde vertrekken{num('verwarmdeVertrekken')}</label>
        <label>Verwarmde overige ruimtes{num('verwarmdeOverigeRuimten')}</label>
        <label>Gekoelde vertrekken{num('gekoeldeVertrekken')}</label>
        <label>Aanrechtlengte (meter){num('aanrechtLengteMeters', '0.1')}</label>
        <label>Keuken extra punten{num('keukenExtraPunten', '0.25')}</label>
        <label>Sanitairpunten{num('sanitairPunten', '0.25')}</label>
        <label>Privé-buitenruimte (m²){num('m2BuitenruimtePrive', '0.25')}</label>
        <label>Opslag
          <select value={input.opslagType} onChange={event => setInput(current => ({ ...current, opslagType: event.target.value as OpslagType }))}>
            <option value="geen">Geen opslag</option>
            <option value="nieuwbouw_middenhuur">Nieuwbouw middenhuur (+10%)</option>
            <option value="rijksmonument">Rijksmonument (+35%)</option>
            <option value="gemeentelijk_monument">Gemeentelijk monument (+15%)</option>
            <option value="beschermd_stadsgezicht">Beschermd stadsgezicht (+5%)</option>
          </select>
        </label>
        <label className="check-label wide-field">
          <input type="checkbox" checked={input.isCoropAmsterdamUtrechtKlein} onChange={event => setInput(current => ({ ...current, isCoropAmsterdamUtrechtKlein: event.target.checked }))} />
          COROP Amsterdam/Utrecht én kleiner dan 40 m²
        </label>
        {selected && (
          <label className="check-label wide-field">
            <input type="checkbox" checked={applyToProperty} onChange={event => setApplyToProperty(event.target.checked)} />
            Punten en maximale huur direct toepassen op {selected.name}
          </label>
        )}
      </div>
      <div className="result-box">
        <span>{result.huurSegment}</span>
        <strong>{result.totaalPunten} <small>punten</small></strong>
        <p>{result.wettelijkeMaximumhuur === null ? 'Geen wettelijke maximale huurprijs' : <>Maximale kale huurprijs <b>{money(result.wettelijkeMaximumhuur)}</b> per maand</>}</p>
        {result.opslagPercentage > 0 && <small>Inclusief {Math.round(result.opslagPercentage * 100)}% opslag. Tabelhuur: {money(result.tabelHuurprijs)}.</small>}
      </div>
      <div className="breakdown" aria-label="Puntenuitsplitsing">
        <strong>Puntenuitsplitsing</strong>
        <div><span>Vertrekken</span><b>{result.punten.vertrekken}</b></div>
        <div><span>Overige ruimten</span><b>{result.punten.overigeRuimten}</b></div>
        <div><span>Verwarming / verkoeling</span><b>{result.punten.verwarming + result.punten.verkoeling}</b></div>
        <div><span>Energieprestatie</span><b>{result.punten.energie}</b></div>
        <div><span>Keuken (basis + extra)</span><b>{result.punten.keuken}</b></div>
        <div><span>Sanitair</span><b>{result.punten.sanitair}</b></div>
        <div><span>Buitenruimte</span><b>{result.punten.buitenruimte}</b></div>
        <div><span>Basispunten</span><b>{result.punten.basis}</b></div>
        <div><span>WOZ-punten{result.wozCapToegepast ? ' (33%-cap toegepast)' : ''}</span><b>{result.punten.wozDefinitief}</b></div>
      </div>
    </Modal>
  )
}

export function WwsModule({ onCalculate }: { onCalculate: () => void }) {
  const { properties, records, removeRecord, confirm, notify } = useApp()
  const year = String(new Date().getFullYear())
  const thisYear = records.wws.filter(item => (item.date ?? item.createdAt).startsWith(year)).length
  const scored = properties.filter(property => property.points > 0)
  const average = scored.length ? Math.round(scored.reduce((sum, property) => sum + property.points, 0) / scored.length) : 0
  const missing = properties.filter(property => !property.energyLabel && property.type !== 'Bedrijfsruimte').length
  const remove = async (id: number) => {
    if (!(await confirm('Deze berekening wordt verwijderd.'))) return
    if (await removeRecord('wws', id)) notify('Berekening verwijderd')
  }
  return (
    <>
      <PageHead eyebrow="WWS / WWSO" title="WWS / WWSO" description="Bereken WWS/WWSO-punten en maximale huurprijzen.">
        <button type="button" className="button" onClick={onCalculate}><Icon name="calc" size={16} /> Nieuwe berekening</button>
      </PageHead>
      <div className="stats-grid">
        <Stat label="Berekeningen dit jaar" value={String(thisYear)} trend={`${records.wws.length} in totaal`} icon="calc" />
        <Stat label="Gemiddeld aantal punten" value={average ? String(average) : '—'} trend={scored.length ? `Over ${scored.length} woningen` : 'Nog geen punten'} icon="check" tone="sage" />
        <Stat label="Te controleren" value={String(missing)} trend="Energielabel ontbreekt" icon="alert" tone={missing ? 'gold' : 'sage'} />
        <Stat label="Prijspeil" value="1 jan 2026" trend="Regelgeving actueel" icon="shield" tone="gold" />
      </div>
      <div className="panel">
        <PanelHeading title="Opgeslagen berekeningen" subtitle="Eerder uitgevoerde WWS-/WWSO-berekeningen" />
        {records.wws.length === 0 ? (
          <EmptyState icon="calc" title="Nog geen berekeningen" text="Voer een berekening uit en sla die op om de maximale huurprijs vast te leggen." action={<button type="button" className="button" onClick={onCalculate}>Nieuwe berekening</button>} />
        ) : (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Object</th><th>Datum</th><th>Punten</th><th>Segment</th><th className="right">Max. huur</th><th /></tr></thead>
              <tbody>
                {records.wws.map(item => (
                  <tr key={item.id}>
                    <td><strong>{item.label}</strong></td>
                    <td>{formatDate(item.date)}</td>
                    <td>{item.points}</td>
                    <td>{item.segment?.split(' (')[0]}</td>
                    <td className="right"><strong>{item.rent ? money(item.rent) : '—'}</strong></td>
                    <td className="right"><button type="button" className="icon-button danger-icon" aria-label="Verwijderen" onClick={() => remove(item.id)}><Icon name="trash" size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
