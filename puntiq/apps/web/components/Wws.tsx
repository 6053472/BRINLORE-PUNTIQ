'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { useApp } from './AppProvider'
import { Icon } from './icons'
import { EmptyState, Modal, PageHead, PanelHeading, Stat } from './ui'
import {
  berekenWws, betrouwbaarheidLabel, controleerRegelset, energielabels, kiesRegelset, legeInvoer, nieuweRuimte,
  type Betrouwbaarheid, type CatalogusItem, type Energielabel, type RegelStatus, type Ruimte, type RubriekId, type WwsInvoer, type WwsUitkomst,
} from '../lib/wws'
import { formatDate, money, today } from '../lib/format'
import type { WwsCalculation } from '../lib/types'

const badgeClass: Record<Betrouwbaarheid, string> = { officieel: 'status s-actief', indicatief: 'status tone-warn', onvolledig: 'status tone-bad' }
const statusLabel: Record<RegelStatus, string> = { geverifieerd: 'Geverifieerd', ongeverifieerd: 'Niet geverifieerd', niet_geconfigureerd: 'Geen regel' }
const statusClass: Record<RegelStatus, string> = { geverifieerd: 'status s-actief', ongeverifieerd: 'status tone-warn', niet_geconfigureerd: 'status tone-neutral' }
const regioLabels: Record<string, string> = { corop_amsterdam_utrecht: 'De woning ligt in het COROP-gebied Amsterdam of Utrecht' }
const fmt = (value: number) => value.toLocaleString('nl-NL', { maximumFractionDigits: 2 })

export function BetrouwbaarheidBadge({ value }: { value: Betrouwbaarheid }) {
  return <span className={badgeClass[value]}>{betrouwbaarheidLabel[value]}</span>
}

function parseInvoer(record?: WwsCalculation): WwsInvoer | null {
  if (!record?.invoer) return null
  try {
    return { ...legeInvoer(today()), ...(JSON.parse(record.invoer) as WwsInvoer) }
  } catch {
    return null
  }
}

/* ---------- Invoer-onderdelen ---------- */

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="wws-section">
      <legend>{title}</legend>
      {hint && <p className="muted small-text">{hint}</p>}
      {children}
    </fieldset>
  )
}

function NumberInput({ value, onChange, step = 1, min = 0, placeholder, label }: { value: number | null; onChange: (value: number | null) => void; step?: number; min?: number; placeholder?: string; label?: string }) {
  return (
    <input
      type="number" inputMode="decimal" min={min} step={step} placeholder={placeholder} aria-label={label}
      value={value ?? ''}
      onChange={event => onChange(event.target.value === '' ? null : Math.max(min, Number(event.target.value)))}
    />
  )
}

function RuimteTabel({ titel, ruimten, koeling, onChange, standaardNaam }: { titel: string; ruimten: Ruimte[]; koeling: boolean; onChange: (ruimten: Ruimte[]) => void; standaardNaam: string }) {
  const update = (id: string, patch: Partial<Ruimte>) => onChange(ruimten.map(ruimte => (ruimte.id === id ? { ...ruimte, ...patch } : ruimte)))
  const totaal = ruimten.reduce((sum, ruimte) => sum + (ruimte.m2 || 0), 0)
  return (
    <div className="room-table">
      <div className="room-row room-head" aria-hidden="true">
        <span>{titel}</span><span>m²</span><span>Verwarmd</span>{koeling && <span>Gekoeld</span>}<span />
      </div>
      {ruimten.map((ruimte, index) => (
        <div className={`room-row ${koeling ? '' : 'no-cooling'}`} key={ruimte.id}>
          <input value={ruimte.naam} onChange={event => update(ruimte.id, { naam: event.target.value })} aria-label={`${titel} ${index + 1}: naam`} />
          <input type="number" min="0" step="0.01" value={ruimte.m2 || ''} onChange={event => update(ruimte.id, { m2: Math.max(0, Number(event.target.value)) })} aria-label={`${ruimte.naam || titel}: oppervlakte in m²`} />
          <input type="checkbox" checked={ruimte.verwarmd} onChange={event => update(ruimte.id, { verwarmd: event.target.checked })} aria-label={`${ruimte.naam || titel}: verwarmd`} />
          {koeling && <input type="checkbox" checked={ruimte.gekoeld} onChange={event => update(ruimte.id, { gekoeld: event.target.checked })} aria-label={`${ruimte.naam || titel}: gekoeld`} />}
          <button type="button" className="icon-button danger-icon" aria-label={`${ruimte.naam || titel} verwijderen`} onClick={() => onChange(ruimten.filter(item => item.id !== ruimte.id))}><Icon name="x" size={15} /></button>
        </div>
      ))}
      <div className="room-foot">
        <button type="button" className="link-button" onClick={() => onChange([...ruimten, nieuweRuimte(standaardNaam)])}><Icon name="plus" size={14} /> {standaardNaam} toevoegen</button>
        <span className="muted">{ruimten.length} {ruimten.length === 1 ? 'ruimte' : 'ruimten'} · {fmt(totaal)} m²</span>
      </div>
    </div>
  )
}

function Catalogus({ items, aantallen, onChange }: { items: Record<string, CatalogusItem>; aantallen: Record<string, number>; onChange: (aantallen: Record<string, number>) => void }) {
  const entries = Object.entries(items)
  if (!entries.length) return null
  return (
    <div className="form-grid">
      {entries.map(([sleutel, item]) => (
        <label key={sleutel}>
          {item.naam}{item.punten === null && <small className="field-hint"> (nog geen punten in regelset)</small>}
          <NumberInput value={aantallen[sleutel] ?? null} onChange={value => onChange({ ...aantallen, [sleutel]: value ?? 0 })} placeholder="aantal" />
        </label>
      ))}
    </div>
  )
}

/* ---------- Uitkomst ---------- */

function Uitkomst({ uitkomst, invoer, onHandmatig }: { uitkomst: WwsUitkomst; invoer: WwsInvoer; onHandmatig: (id: RubriekId, waarde: { punten: number; toelichting: string } | null) => void }) {
  const [bewerken, setBewerken] = useState<RubriekId | null>(null)
  const [concept, setConcept] = useState({ punten: '', toelichting: '' })
  const regulated = uitkomst.segment?.gereguleerd

  const openEdit = (id: RubriekId) => {
    const huidig = invoer.handmatig[id]
    setConcept({ punten: huidig ? String(huidig.punten) : '', toelichting: huidig?.toelichting ?? '' })
    setBewerken(bewerken === id ? null : id)
  }

  return (
    <aside className="wws-result" aria-live="polite">
      <div className="result-box">
        <BetrouwbaarheidBadge value={uitkomst.betrouwbaarheid} />
        <strong>{uitkomst.totaalPunten ?? '—'} <small>punten</small></strong>
        {uitkomst.segment && <p>{uitkomst.segment.naam}</p>}
        {uitkomst.totaalPunten !== null && (
          <p>
            {regulated === false
              ? 'Geen wettelijke maximale huurprijs'
              : uitkomst.maximaleHuur !== null
                ? <>Maximale kale huur{uitkomst.betrouwbaarheid !== 'officieel' && ' (indicatief)'} <b>{money(uitkomst.maximaleHuur)}</b></>
                : 'Maximale huur kan niet worden bepaald'}
          </p>
        )}
        {uitkomst.opslagen.map(opslag => <small key={opslag.id}>Inclusief {fmt(opslag.percentage * 100)}% opslag {opslag.naam.toLowerCase()}. Tabelhuur: {money(uitkomst.tabelHuur ?? 0)}.</small>)}
      </div>

      {uitkomst.redenen.length > 0 && (
        <details className="wws-reasons" open={uitkomst.betrouwbaarheid === 'onvolledig'}>
          <summary>{uitkomst.betrouwbaarheid === 'onvolledig' ? 'Wat ontbreekt er?' : 'Waarom niet officieel?'} ({uitkomst.redenen.length})</summary>
          <ul>{uitkomst.redenen.map(reden => <li key={reden}>{reden}</li>)}</ul>
        </details>
      )}

      <div className="breakdown wws-breakdown" aria-label="Puntenuitsplitsing">
        <strong>Puntenuitsplitsing</strong>
        {uitkomst.rubrieken.map(item => (
          <div key={item.id} className={`wws-rubriek ${item.bron}`}>
            <details>
              <summary>
                <span>{item.naam}{item.bron === 'handmatig' && <em> · handmatig</em>}</span>
                <b>{item.punten === null ? '—' : fmt(item.punten)}</b>
              </summary>
              {item.stappen.length > 0 && <ul>{item.stappen.map((stap, index) => <li key={index}>{stap}</li>)}</ul>}
              {item.waarschuwingen.map(waarschuwing => <p key={waarschuwing} className="wws-warning"><Icon name="alert" size={13} /> {waarschuwing}</p>)}
              <small className="muted">Regel: {statusLabel[item.status]}</small>
            </details>
            <button type="button" className="link-button" onClick={() => openEdit(item.id)}>{invoer.handmatig[item.id] ? 'Wijzigen' : 'Handmatig'}</button>
            {bewerken === item.id && (
              <form className="wws-manual" onSubmit={event => {
                event.preventDefault()
                const punten = Number(concept.punten.replace(',', '.'))
                if (concept.punten.trim() === '' || !Number.isFinite(punten)) return
                onHandmatig(item.id, { punten, toelichting: concept.toelichting.trim() })
                setBewerken(null)
              }}>
                <label>Punten<input type="number" step="0.25" value={concept.punten} onChange={event => setConcept(current => ({ ...current, punten: event.target.value }))} required autoFocus /></label>
                <label>Toelichting / bron<input value={concept.toelichting} onChange={event => setConcept(current => ({ ...current, toelichting: event.target.value }))} placeholder="bijv. Huurprijscheck" /></label>
                <div className="button-row">
                  <button className="button small">Toepassen</button>
                  {invoer.handmatig[item.id] && <button type="button" className="button ghost small" onClick={() => { onHandmatig(item.id, null); setBewerken(null) }}>Terug naar berekening</button>}
                </div>
              </form>
            )}
          </div>
        ))}
        {uitkomst.puntenZonderWoz !== null && <div className="wws-subtotal"><span>Totaal vóór afronding</span><b>{fmt(uitkomst.puntenZonderWoz + (uitkomst.rubrieken.find(item => item.id === 'woz')?.punten ?? 0))}</b></div>}
      </div>
      <p className="muted small-text">Regelset: {uitkomst.regelset.naam}</p>
    </aside>
  )
}

/* ---------- Calculator ---------- */

export function WwsModal({ onClose, record }: { onClose: () => void; record?: WwsCalculation }) {
  const { properties, saveRecord, saveProperty, notify } = useApp()
  const [invoer, setInvoer] = useState<WwsInvoer>(() => parseInvoer(record) ?? legeInvoer(today()))
  const [propertyId, setPropertyId] = useState(() => String(properties.find(property => property.name === record?.property)?.id ?? ''))
  const [label, setLabel] = useState(record?.label ?? '')
  const [applyToProperty, setApplyToProperty] = useState(true)
  const [busy, setBusy] = useState(false)

  const regelset = useMemo(() => kiesRegelset(invoer.peildatum), [invoer.peildatum])
  const uitkomst = useMemo(() => (regelset ? berekenWws(invoer, regelset) : null), [invoer, regelset])
  const selected = properties.find(property => String(property.id) === propertyId)
  const set = <K extends keyof WwsInvoer>(key: K, value: WwsInvoer[K]) => setInvoer(current => ({ ...current, [key]: value }))
  const setHandmatig = (id: RubriekId, waarde: { punten: number; toelichting: string } | null) =>
    setInvoer(current => {
      const handmatig = { ...current.handmatig }
      if (waarde) handmatig[id] = waarde
      else delete handmatig[id]
      return { ...current, handmatig }
    })

  const chooseProperty = (id: string) => {
    setPropertyId(id)
    const property = properties.find(item => String(item.id) === id)
    if (!property) return
    // Bekende woninggegevens overnemen, zonder ingevulde waarden te overschrijven.
    setInvoer(current => ({
      ...current,
      bouwjaar: current.bouwjaar ?? property.yearBuilt ?? null,
      energielabel: current.energielabel ?? ((energielabels as string[]).includes(property.energyLabel ?? '') ? (property.energyLabel as Energielabel) : null),
    }))
  }

  const sanitairHandmatig = regelset?.rubrieken.sanitair.status === 'niet_geconfigureerd'
  const regioUitzondering = regelset?.rubrieken.woz.uitzonderingKleineWoning

  const save = async () => {
    const name = selected?.name ?? label.trim()
    if (!name) return notify('Kies een woning of geef de berekening een naam.', 'error')
    if (!uitkomst) return notify('Er is geen regelset voor deze peildatum.', 'error')
    setBusy(true)
    const saved = await saveRecord('wws', {
      label: name,
      property: selected?.name ?? '',
      date: invoer.peildatum,
      points: uitkomst.totaalPunten ?? undefined,
      rent: uitkomst.maximaleHuur ?? undefined,
      segment: uitkomst.segment?.naam ?? '',
      regelset: uitkomst.regelset.id,
      betrouwbaarheid: uitkomst.betrouwbaarheid,
      invoer: JSON.stringify(invoer),
    }, record?.id)
    if (!saved) return setBusy(false)
    const apply = selected && applyToProperty && uitkomst.totaalPunten !== null
    if (apply) await saveProperty({ ...selected, points: uitkomst.totaalPunten!, rent: uitkomst.maximaleHuur ?? selected.rent }, selected.id)
    notify(apply ? 'Berekening opgeslagen en toegepast op de woning' : 'WWS-berekening opgeslagen')
    onClose()
  }

  return (
    <Modal
      wide
      eyebrow="WWS · ZELFSTANDIGE WOONRUIMTE"
      title={record ? 'Berekening bewerken' : 'Woningwaardering berekenen'}
      subtitle="Vul de woninggegevens in; de punten worden direct berekend volgens de regelset die op de peildatum geldt."
      onClose={onClose}
      actions={
        <>
          <button type="button" className="button ghost" onClick={onClose}>Annuleren</button>
          <button type="button" className="button" disabled={busy || !uitkomst} onClick={save}>{busy ? 'Opslaan…' : 'Berekening opslaan'}</button>
        </>
      }
    >
      <div className="wws-layout">
        <div className="wws-form">
          <Section title="Woning">
            <div className="form-grid">
              <label>Woning (optioneel)
                <select value={propertyId} onChange={event => chooseProperty(event.target.value)}>
                  <option value="">— Los object —</option>
                  {properties.map(property => <option key={property.id} value={property.id}>{property.name}</option>)}
                </select>
              </label>
              <label>Naam berekening
                <input value={selected?.name ?? label} disabled={Boolean(selected)} onChange={event => setLabel(event.target.value)} placeholder="bijv. Singel 229" />
              </label>
              <label>Peildatum
                <input type="date" value={invoer.peildatum} onChange={event => event.target.value && set('peildatum', event.target.value)} required />
              </label>
              <label>Woningtype
                <select value={invoer.woningType} onChange={event => set('woningType', event.target.value as WwsInvoer['woningType'])}>
                  <option value="meergezins">Appartement / meergezinswoning</option>
                  <option value="eengezins">Eengezinswoning</option>
                </select>
              </label>
              <label>Bouwjaar<NumberInput value={invoer.bouwjaar} min={1000} onChange={value => set('bouwjaar', value)} placeholder="bijv. 1928" /></label>
            </div>
            {!regelset && <p className="form-error">Er is geen regelset die geldt op {formatDate(invoer.peildatum)}. Kies een andere peildatum.</p>}
          </Section>

          <Section title="Kamers en oppervlakte" hint="Gebruiksoppervlakte per ruimte. Vertrekken zijn o.a. woonkamer, slaapkamers en een keuken van voldoende grootte; overige ruimten zijn o.a. berging, zolder en hal.">
            <RuimteTabel titel="Vertrekken" standaardNaam="Vertrek" koeling ruimten={invoer.vertrekken} onChange={value => set('vertrekken', value)} />
            <RuimteTabel titel="Overige ruimten" standaardNaam="Overige ruimte" koeling={false} ruimten={invoer.overigeRuimten} onChange={value => set('overigeRuimten', value)} />
          </Section>

          <Section title="Energieprestatie">
            <label>Energielabel
              <select value={invoer.energielabel ?? ''} onChange={event => set('energielabel', (event.target.value || null) as Energielabel | null)}>
                <option value="">Geen geldig energielabel</option>
                {energielabels.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </Section>

          <Section title="Voorzieningen">
            <div className="form-grid">
              <label>Aanrechtlengte keuken (meter)<NumberInput value={invoer.keuken.aanrechtLengteMeters || null} step={0.1} onChange={value => set('keuken', { ...invoer.keuken, aanrechtLengteMeters: value ?? 0 })} placeholder="bijv. 2,4" /></label>
              <label>Extra keukenvoorzieningen (punten)<NumberInput value={invoer.keuken.extraPuntenHandmatig || null} step={0.25} onChange={value => set('keuken', { ...invoer.keuken, extraPuntenHandmatig: value ?? 0 })} placeholder="zelf vastgesteld" /></label>
            </div>
            {regelset && <Catalogus items={regelset.rubrieken.keuken.voorzieningen} aantallen={invoer.keuken.voorzieningen} onChange={value => set('keuken', { ...invoer.keuken, voorzieningen: value })} />}
            {regelset && <Catalogus items={regelset.rubrieken.sanitair.voorzieningen} aantallen={invoer.sanitair.voorzieningen} onChange={value => set('sanitair', { voorzieningen: value })} />}
            {sanitairHandmatig && (
              <label>Sanitair (punten)
                <NumberInput
                  value={invoer.handmatig.sanitair?.punten ?? null} step={0.25}
                  onChange={value => setHandmatig('sanitair', value === null ? null : { punten: value, toelichting: invoer.handmatig.sanitair?.toelichting ?? 'Zelf vastgesteld' })}
                  placeholder="zelf vastgesteld"
                />
                <small className="field-hint">Deze regelset bevat nog geen rekenregel voor sanitair. Vul de punten in die u zelf heeft vastgesteld, bijvoorbeeld met de Huurprijscheck van de Huurcommissie.</small>
              </label>
            )}
          </Section>

          <Section title="Buitenruimte">
            <label>Privé-buitenruimte (m²)<NumberInput value={invoer.buitenruimte.priveM2 || null} step={0.01} onChange={value => set('buitenruimte', { priveM2: value ?? 0 })} placeholder="tuin, balkon of dakterras" /></label>
            <small className="field-hint">Gedeelde buitenruimte kunt u in de puntenuitsplitsing handmatig toevoegen.</small>
          </Section>

          <Section title="WOZ-waarde">
            <label>WOZ-waarde (€)<NumberInput value={invoer.woz.waarde} step={1000} onChange={value => set('woz', { ...invoer.woz, waarde: value })} placeholder="volgens WOZ-beschikking" /></label>
            {regioUitzondering && (
              <label className="check-label">
                <input type="checkbox" checked={invoer.woz.regioKenmerken.includes(regioUitzondering.regioKenmerk)} onChange={event => set('woz', { ...invoer.woz, regioKenmerken: event.target.checked ? [regioUitzondering.regioKenmerk] : [] })} />
                {regioLabels[regioUitzondering.regioKenmerk] ?? regioUitzondering.regioKenmerk}
              </label>
            )}
          </Section>

          {regelset && regelset.opslagen.length > 0 && (
            <Section title="Opslag" hint="Een opslag op de maximale huur, bijvoorbeeld bij monumentstatus.">
              <div className="radio-list">
                {[{ id: '', naam: 'Geen opslag', percentage: 0 as number | null }, ...regelset.opslagen].map(opslag => (
                  <label key={opslag.id || 'geen'} className="check-label">
                    <input type="radio" name="opslag" checked={opslag.id ? invoer.opslagen.includes(opslag.id) : invoer.opslagen.length === 0} onChange={() => set('opslagen', opslag.id ? [opslag.id] : [])} />
                    {opslag.naam}{opslag.id && opslag.percentage !== null && ` (+${fmt(opslag.percentage * 100)}%)`}
                  </label>
                ))}
              </div>
            </Section>
          )}

          {selected && (
            <label className="check-label">
              <input type="checkbox" checked={applyToProperty} onChange={event => setApplyToProperty(event.target.checked)} />
              Punten en maximale huur na opslaan toepassen op {selected.name}
            </label>
          )}
        </div>
        {uitkomst ? <Uitkomst uitkomst={uitkomst} invoer={invoer} onHandmatig={setHandmatig} /> : <aside className="wws-result"><p className="muted">Geen regelset voor deze peildatum.</p></aside>}
      </div>
    </Modal>
  )
}

/* ---------- Module ---------- */

function RegelsetStatus() {
  const regelset = kiesRegelset(today())
  if (!regelset) return <p className="form-error">Er is geen regelset die vandaag geldt. Berekeningen zijn niet mogelijk.</p>
  const onderdelen = controleerRegelset(regelset)
  const geverifieerd = onderdelen.filter(item => item.status === 'geverifieerd').length
  return (
    <details className="panel wws-ruleset">
      <summary>
        <span><strong>{regelset.naam}</strong><small className="muted">Geldig vanaf {formatDate(regelset.geldigVanaf)} · {geverifieerd} van {onderdelen.length} onderdelen geverifieerd</small></span>
        <span className={geverifieerd === onderdelen.length ? 'status s-actief' : 'status tone-warn'}>{geverifieerd === onderdelen.length ? 'Geverifieerd' : 'Niet volledig geverifieerd'}</span>
      </summary>
      <p className="muted small-text">{regelset.bron}</p>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Onderdeel</th><th>Status</th><th>Ontbreekt</th></tr></thead>
          <tbody>
            {onderdelen.map(item => (
              <tr key={item.naam}>
                <td>{item.naam}</td>
                <td><span className={statusClass[item.status]}>{statusLabel[item.status]}</span></td>
                <td className="muted">{item.ontbrekend.join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

export function WwsModule({ onCalculate, onOpen }: { onCalculate: () => void; onOpen: (record: WwsCalculation) => void }) {
  const { properties, records, removeRecord, confirm, notify } = useApp()
  const year = String(new Date().getFullYear())
  const thisYear = records.wws.filter(item => (item.date ?? item.createdAt).startsWith(year)).length
  const scored = properties.filter(property => property.points > 0)
  const average = scored.length ? Math.round(scored.reduce((sum, property) => sum + property.points, 0) / scored.length) : 0
  const incomplete = records.wws.filter(item => item.betrouwbaarheid === 'onvolledig').length
  const remove = async (id: number) => {
    if (!(await confirm('Deze berekening wordt verwijderd.'))) return
    if (await removeRecord('wws', id)) notify('Berekening verwijderd')
  }
  return (
    <>
      <PageHead eyebrow="WWS" title="Woningwaardering" description="Bereken WWS-punten en de maximale huurprijs van zelfstandige woningen.">
        <button type="button" className="button" onClick={onCalculate}><Icon name="calc" size={16} /> Nieuwe berekening</button>
      </PageHead>
      <div className="stats-grid">
        <Stat label="Berekeningen dit jaar" value={String(thisYear)} trend={`${records.wws.length} in totaal`} icon="calc" />
        <Stat label="Gemiddeld aantal punten" value={average ? String(average) : '—'} trend={scored.length ? `Over ${scored.length} woningen` : 'Nog geen punten'} icon="check" tone="sage" />
        <Stat label="Onvolledig" value={String(incomplete)} trend="Berekeningen met ontbrekende gegevens" icon="alert" tone={incomplete ? 'gold' : 'sage'} />
        <Stat label="Regelset" value={kiesRegelset(today())?.geldigVanaf.slice(0, 4) ?? '—'} trend="Zie status hieronder" icon="shield" tone="gold" />
      </div>
      <RegelsetStatus />
      <div className="panel">
        <PanelHeading title="Opgeslagen berekeningen" subtitle="Klik op een berekening om die te openen of aan te passen" />
        {records.wws.length === 0 ? (
          <EmptyState icon="calc" title="Nog geen berekeningen" text="Voer een berekening uit en sla die op om de maximale huurprijs vast te leggen." action={<button type="button" className="button" onClick={onCalculate}>Nieuwe berekening</button>} />
        ) : (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Object</th><th>Peildatum</th><th>Punten</th><th>Segment</th><th>Uitkomst</th><th className="right">Max. huur</th><th /></tr></thead>
              <tbody>
                {records.wws.map(item => (
                  <tr key={item.id}>
                    <td><button type="button" className="link-button strong" onClick={() => onOpen(item)} disabled={!item.invoer} title={item.invoer ? 'Openen' : 'Oudere berekening zonder invoergegevens'}>{item.label}</button></td>
                    <td>{formatDate(item.date)}</td>
                    <td>{item.points ?? '—'}</td>
                    <td>{item.segment?.split(' (')[0] || '—'}</td>
                    <td>{item.betrouwbaarheid ? <BetrouwbaarheidBadge value={item.betrouwbaarheid} /> : <span className="status tone-neutral">Oud model</span>}</td>
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
